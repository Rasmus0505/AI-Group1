from fastapi import FastAPI, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional, Dict, Annotated
import uvicorn
import time
import os
import sys

# Custom Modules
from cloud_connector import CloudBridge
from local_connector import LocalBridge
from llm_engine import LLMEngine

# --- STORAGE SELECTION LOGIC ---
STORAGE_MODE = os.getenv("STORAGE_MODE", "LOCAL") 
if len(sys.argv) > 1 and sys.argv[1] == "--cloud":
    STORAGE_MODE = "CLOUD"

print(f"🚀 [Backend] Launching in {STORAGE_MODE} mode...")

if STORAGE_MODE == "CLOUD":
    db = CloudBridge()
    if not db.client:
        # User requested to be able to test connection without crashing
        print("⚠️ [Cloud] Connection failed. Please check SSH tunnel.")
else:
    db = LocalBridge()

app = FastAPI(
    title=f"Every Wall Is A Door - {STORAGE_MODE} Mode",
    description="Backend connected to Storage and OpenAI",
    version="3.2.0"
)

app.add_middleware(
    CORSMiddleware,
    # Explicitly list ports to allow credentials to work properly
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:5174", 
        "http://localhost:5175",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:5174",
        "http://127.0.0.1:5175"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Models
class InitSettings(BaseModel):
    settings: str

class PlayerAction(BaseModel):
    label: str
    customText: Optional[str] = None
    gameId: str = "default_room"
    playerId: str = "player_human"
    playerPosition: str = "ceo" 

def get_api_key(authorization: str | None = Header(None)) -> str:
    """Extract API Key from Bearer token"""
    if not authorization:
        raise HTTPException(status_code=401, detail="Missing API Key in Authorization header")
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid Authorization header format. Expected 'Bearer <key>'")
    return authorization.replace("Bearer ", "")

@app.get("/")
def read_root():
    status = "connected"
    if STORAGE_MODE == "CLOUD":
        status = "connected" if db.client else "disconnected"
    
    return {
        "status": "online", 
        "storage_mode": STORAGE_MODE,
        "db_connection": status, 
        "version": "3.2.0"
    }

@app.post("/api/toggle_mode")
def toggle_mode(mode: str):
    global db, STORAGE_MODE
    mode = mode.upper()
    if mode == "CLOUD":
        STORAGE_MODE = "CLOUD"
        db = CloudBridge()
        return {"message": "Switched to CLOUD mode. Check console for connection status."}
    else:
        STORAGE_MODE = "LOCAL"
        db = LocalBridge()
        return {"message": "Switched to LOCAL mode."}

@app.post("/api/init")
def init_game(payload: InitSettings, authorization: Annotated[str | None, Header()] = None):
    # Get Key from Header
    api_key = get_api_key(authorization)
    
    print(f"[{STORAGE_MODE}] Initializing game...")
    initial_data = LLMEngine.init_game(payload.settings, api_key)
    
    new_state = {
        "game_id": "default_room",
        "round_id": 1,
        "company_name": "Nexus Corp",
        "turn": 1,
        "attributes": initial_data.get("initial_attributes", {
            "cash": 1000,
            "morale": 50,
            "reputation": 50,
            "innovation": 10
        }),
        "players": [
            {
                "id": "player_human",
                "name": "CEO (玩家)",
                "type": "human",
                "position": "ceo"
            },
            {
                "id": "player_ai_tech",
                "name": "CTO (AI)",
                "type": "ai",
                "position": "cto"
            },
            {
                "id": "player_ai_market",
                "name": "CMO (AI)",
                "type": "ai",
                "position": "cmo"
            }
        ],
        "history": [
            {
                "id": int(time.time()), 
                "type": "system", 
                "text": initial_data.get("narrative", "欢迎来到《凡墙皆是门》。你已被任命为 Nexus Corp 的首席执行官。")
            }
        ],
        "current_options": initial_data.get("first_options", [
            {
                "id": "1",
                "label": "增加研发投入",
                "desc": "投入更多资源到研发部门，提升创新能力",
                "predicted_effect": "创新 +10, 现金 -200"
            },
            {
                "id": "2",
                "label": "开展市场推广",
                "desc": "增加市场营销预算，提升品牌知名度",
                "predicted_effect": "声誉 +10, 现金 -150"
            },
            {
                "id": "3",
                "label": "优化内部流程",
                "desc": "改善公司内部管理流程，提高效率",
                "predicted_effect": "士气 +5, 现金 -100"
            }
        ]),
        "passive_rules": initial_data.get("passive_rules", {"income_base": 100, "expense_base": 50}),
        "formulas": initial_data.get("formulas", {
            "cash_rule": "Cash_Next = Cash - 50 (Base Cost) + Innovation * 5 (Licensing) + Action_Effect",
            "morale_rule": "Morale_Next = Morale - 2 (Fatigue) + Action_Effect"
        })
    }
    
    db.push_new_state(new_state)

    return {
        "state": {
            "companyName": new_state["company_name"],
            "turn": new_state["turn"],
            "attributes": new_state["attributes"],
            "players": new_state["players"],
            "history": new_state["history"]
        },
        "options": new_state["current_options"]
    }

@app.post("/api/action")
def process_action(action: PlayerAction, authorization: Annotated[str | None, Header()] = None):
    # Get Key from Header
    api_key = get_api_key(authorization)
    game_id = action.gameId
    
    # 1. Fetch State
    last_state_doc = db.pull_latest_state(game_id)
    
    if not last_state_doc:
        raise HTTPException(status_code=404, detail="Game session not found.")
    
    current_state = {
        "attributes": last_state_doc.get("attributes"),
        "history": last_state_doc.get("history", []),
        "turn": last_state_doc.get("turn", 1),
        "formulas": last_state_doc.get("formulas", "")
    }
    
    # 2. Call LLM for human player (CEO)
    user_input = action.customText if action.customText else action.label
    print(f"[{STORAGE_MODE}] Action: {user_input} (Position: {action.playerPosition})")
    
    llm_result = LLMEngine.process_turn(current_state, user_input, api_key, action.playerPosition)
    
    # 3. Update Logic for human player's decision
    new_attributes = current_state["attributes"].copy()
    changes = llm_result.get("attribute_changes", {})
    
    for key, val in changes.items():
        if key in new_attributes:
            new_attributes[key] += val
            new_attributes[key] = max(0, new_attributes[key])
    
    new_history = current_state["history"].copy()
    new_history.append({
        "id": int(time.time()),
        "type": "player",
        "playerId": action.playerId,
        "playerPosition": action.playerPosition,
        "text": f"决策: {user_input}"
    })
    
    sys_text = llm_result.get("narrative", "")
    if "logic_chain" in llm_result:
         sys_text += f"\n\n[逻辑链] {llm_result['logic_chain']}"
         
    new_history.append({
        "id": int(time.time()) + 1,
        "type": "system",
        "text": sys_text
    })
    
    # 4. If the action was from CEO (human), automatically trigger AI players' decisions
    if action.playerPosition == "ceo":
        # AI Player 1: CTO
        print("[{STORAGE_MODE}] Generating CTO decision...")
        cto_decision = LLMEngine.generate_ai_decision({
            "attributes": new_attributes,
            "history": new_history,
            "turn": current_state["turn"] + 1,
            "formulas": current_state["formulas"]
        }, "cto", api_key)
        
        # Process CTO decision
        cto_llm_result = LLMEngine.process_turn({
            "attributes": new_attributes,
            "history": new_history,
            "turn": current_state["turn"] + 1,
            "formulas": current_state["formulas"]
        }, cto_decision, api_key, "cto")
        
        # Update attributes for CTO decision
        cto_changes = cto_llm_result.get("attribute_changes", {})
        for key, val in cto_changes.items():
            if key in new_attributes:
                new_attributes[key] += val
                new_attributes[key] = max(0, new_attributes[key])
        
        # Add CTO decision to history
        new_history.append({
            "id": int(time.time()) + 2,
            "type": "player",
            "playerId": "player_ai_tech",
            "playerPosition": "cto",
            "text": f"CTO决策: {cto_decision}"
        })
        
        cto_sys_text = cto_llm_result.get("narrative", "")
        if "logic_chain" in cto_llm_result:
            cto_sys_text += f"\n\n[CTO逻辑链] {cto_llm_result['logic_chain']}"
            
        new_history.append({
            "id": int(time.time()) + 3,
            "type": "system",
            "text": cto_sys_text
        })
        
        # AI Player 2: CMO
        print("[{STORAGE_MODE}] Generating CMO decision...")
        cmo_decision = LLMEngine.generate_ai_decision({
            "attributes": new_attributes,
            "history": new_history,
            "turn": current_state["turn"] + 1,
            "formulas": current_state["formulas"]
        }, "cmo", api_key)
        
        # Process CMO decision
        cmo_llm_result = LLMEngine.process_turn({
            "attributes": new_attributes,
            "history": new_history,
            "turn": current_state["turn"] + 1,
            "formulas": current_state["formulas"]
        }, cmo_decision, api_key, "cmo")
        
        # Update attributes for CMO decision
        cmo_changes = cmo_llm_result.get("attribute_changes", {})
        for key, val in cmo_changes.items():
            if key in new_attributes:
                new_attributes[key] += val
                new_attributes[key] = max(0, new_attributes[key])
        
        # Add CMO decision to history
        new_history.append({
            "id": int(time.time()) + 4,
            "type": "player",
            "playerId": "player_ai_market",
            "playerPosition": "cmo",
            "text": f"CMO决策: {cmo_decision}"
        })
        
        cmo_sys_text = cmo_llm_result.get("narrative", "")
        if "logic_chain" in cmo_llm_result:
            cmo_sys_text += f"\n\n[CMO逻辑链] {cmo_llm_result['logic_chain']}"
            
        new_history.append({
            "id": int(time.time()) + 5,
            "type": "system",
            "text": cmo_sys_text
        })
        
        # Use the last AI result's options for next turn
        final_options = cmo_llm_result.get("next_options", [])
    else:
        # If it's not CEO's turn, use the original result's options
        final_options = llm_result.get("next_options", [])
    
    new_doc = {
        "game_id": game_id,
        "round_id": last_state_doc.get("round_id", 0) + 1,
        "company_name": last_state_doc.get("company_name"),
        "turn": current_state["turn"] + 1,
        "attributes": new_attributes,
        "players": last_state_doc.get("players", []),
        "history": new_history,
        "current_options": final_options,
        "passive_rules": last_state_doc.get("passive_rules", {}),
        "formulas": last_state_doc.get("formulas", "")
    }
    
    db.push_new_state(new_doc)
    
    return {
        "state": {
            "companyName": new_doc["company_name"],
            "turn": new_doc["turn"],
            "attributes": new_doc["attributes"],
            "players": new_doc["players"],
            "history": new_doc["history"]
        },
        "options": new_doc["current_options"]
    }

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
