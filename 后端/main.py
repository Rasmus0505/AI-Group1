from fastapi import FastAPI, HTTPException, Header
from fastapi import Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import List, Optional, Dict, Annotated
import uvicorn
import time
import os
import sys
import json

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
    allow_origins=["*"],
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

import asyncio

@app.post("/api/action")
async def process_action(
    action: PlayerAction,
    request: Request,
    authorization: Annotated[str | None, Header()] = None,
):
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
    
    initial_attributes = current_state["attributes"].copy()
    accept = (request.headers.get("accept") or "").lower()
    wants_stream = "text/event-stream" in accept

    input_parts = []
    if action.label and action.label != "Custom Directive":
        input_parts.append(f"执行选项: [{action.label}]")
    if action.customText:
        input_parts.append(f"额外指令: {action.customText}")
    
    user_input = " + ".join(input_parts) if input_parts else "无操作"

    # --- Streaming Mode (SSE over POST) ---
    if wants_stream:
        async def event_generator():
            # --- PHASE 1: CEO Analyst (Logic) ---
            yield f"data: {json.dumps({'type': 'log', 'content': '📡 Connecting to Nexus-Link Analyst...'})}\n\n"

            analyst_result = await LLMEngine.analyze_logic_async(
                current_state,
                user_input,
                api_key,
                action.playerPosition,
            )

            changes = analyst_result.get("attribute_changes", {})
            logic_chain = analyst_result.get("logic_chain", "")
            event_summary = analyst_result.get("event_summary", "")

            new_attributes = current_state["attributes"].copy()
            for key, val in changes.items():
                if key in new_attributes:
                    new_attributes[key] += val
                    new_attributes[key] = max(0, new_attributes[key])

            # Send Deltas to Client (Instant Feedback)
            deltas = {}
            for key in new_attributes:
                diff = new_attributes[key] - current_state["attributes"].get(key, 0)
                if diff != 0:
                    deltas[key] = diff

            yield f"data: {json.dumps({'type': 'delta', 'data': deltas})}\n\n"
            yield f"data: {json.dumps({'type': 'log', 'content': '✅ Logic Validated. Applying effects...'})}\n\n"
            if logic_chain:
                yield f"data: {json.dumps({'type': 'thought', 'content': f'[{action.playerPosition.upper()}] ' + logic_chain})}\n\n"

            # --- PHASE 2: CEO Narrative (Streaming) ---
            yield f"data: {json.dumps({'type': 'log', 'content': '📖 Narrator Engine engaged. Generating story...'})}\n\n"

            stream_id = int(time.time() * 1000)
            yield f"data: {json.dumps({'type': 'narrative_begin', 'streamId': stream_id, 'actor': 'CEO'})}\n\n"

            narrator_stream = LLMEngine.stream_narrative_text(current_state, analyst_result, user_input, api_key)
            narrative_text = ""

            for chunk in narrator_stream:
                content = chunk.choices[0].delta.content
                if content:
                    narrative_text += content
                    yield f"data: {json.dumps({'type': 'token', 'content': content, 'streamId': stream_id})}\n\n"

            # --- PHASE 3: Finalize & Persist ---
            # We'll generate options after all agents finish (CEO + AI roles)

            new_history = current_state["history"].copy()
            new_history.append({
                "id": int(time.time()),
                "type": "player",
                "playerId": action.playerId,
                "playerPosition": action.playerPosition,
                "text": f"决策: {user_input}",
            })
            system_entry = {
                "id": int(time.time()) + 1,
                "type": "system",
                "text": narrative_text,
            }
            if logic_chain:
                system_entry["logicChain"] = logic_chain
            new_history.append(system_entry)

            # --- PHASE 4: Trigger AI players (CTO/CMO) and stream their outputs ---
            final_options = []
            if action.playerPosition == "ceo":
                # AI players see the state AFTER CEO move
                ai_state = {
                    "attributes": new_attributes,
                    "history": new_history,
                    "turn": current_state["turn"] + 1,
                    "formulas": current_state["formulas"],
                }

                async def run_ai(position: str, role_label: str):
                    nonlocal new_attributes, new_history, final_options

                    yield f"data: {json.dumps({'type': 'log', 'content': f'🤖 {role_label} 正在生成决策...'})}\n\n"
                    decision = await LLMEngine.generate_ai_decision_async(ai_state, position, api_key)
                    yield f"data: {json.dumps({'type': 'player', 'text': f'{role_label}决策: {decision}'})}\n\n"

                    ai_analyst = await LLMEngine.analyze_logic_async(ai_state, decision, api_key, position)
                    ai_changes = ai_analyst.get("attribute_changes", {}) or {}
                    ai_logic_chain = ai_analyst.get("logic_chain", "")

                    # Apply attribute changes
                    before = new_attributes.copy()
                    for k, v in ai_changes.items():
                        if k in new_attributes:
                            new_attributes[k] += v
                            new_attributes[k] = max(0, new_attributes[k])

                    # Delta vs before this AI step
                    ai_deltas = {}
                    for k in new_attributes:
                        diff = new_attributes[k] - before.get(k, 0)
                        if diff != 0:
                            ai_deltas[k] = diff
                    if ai_deltas:
                        yield f"data: {json.dumps({'type': 'delta', 'data': ai_deltas})}\n\n"

                    if ai_logic_chain:
                        yield f"data: {json.dumps({'type': 'thought', 'content': f'[{role_label}] ' + ai_logic_chain})}\n\n"

                    # Stream narrative text for this AI role
                    ai_stream_id = int(time.time() * 1000) + (0 if position == "cto" else 1)
                    yield f"data: {json.dumps({'type': 'narrative_begin', 'streamId': ai_stream_id, 'actor': role_label})}\n\n"
                    ai_narr_stream = LLMEngine.stream_narrative_text(ai_state, ai_analyst, decision, api_key)
                    ai_text = ""
                    for ch in ai_narr_stream:
                        c = ch.choices[0].delta.content
                        if c:
                            ai_text += c
                            yield f"data: {json.dumps({'type': 'token', 'content': c, 'streamId': ai_stream_id})}\n\n"

                    # Append to history
                    base_id = int(time.time() * 1000)
                    new_history.append({
                        "id": base_id,
                        "type": "player",
                        "playerId": f"player_ai_{position}",
                        "playerPosition": position,
                        "text": f"{role_label}决策: {decision}",
                    })
                    sys_entry = {"id": base_id + 1, "type": "system", "text": ai_text}
                    if ai_logic_chain:
                        sys_entry["logicChain"] = ai_logic_chain
                    new_history.append(sys_entry)

                    # Update ai_state for next AI role
                    ai_state["attributes"] = new_attributes
                    ai_state["history"] = new_history
                    ai_state["turn"] = ai_state["turn"] + 1

                # Run CTO then CMO sequentially for stable stream order
                async for evt in run_ai("cto", "CTO"):
                    yield evt
                async for evt in run_ai("cmo", "CMO"):
                    yield evt

                # Generate next options for the next CEO turn based on latest state
                final_state_for_options = {
                    "attributes": new_attributes,
                    "history": new_history,
                    "turn": current_state["turn"] + 2,
                    "formulas": current_state["formulas"],
                }
                final_options = LLMEngine.generate_next_options(final_state_for_options, analyst_result, user_input, api_key)

            # Persist final doc after all agents
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
                "formulas": current_state["formulas"],
            }
            db.push_new_state(new_doc)

            yield f"data: {json.dumps({'type': 'done', 'state': new_doc, 'event_summary': event_summary})}\n\n"

        return StreamingResponse(event_generator(), media_type="text/event-stream")
    
    print(f"[{STORAGE_MODE}] Action: {user_input} (Position: {action.playerPosition})")
    
    # CEO Turn (Serial)
    llm_result = await LLMEngine.process_turn_async(current_state, user_input, api_key, action.playerPosition)
    
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
    # logic chain is NO LONGER appended to text
    
    system_entry = {
        "id": int(time.time()) + 1,
        "type": "system",
        "text": sys_text
    }
    if "logic_chain" in llm_result:
        system_entry["logicChain"] = llm_result['logic_chain']
        
    new_history.append(system_entry)
    
    final_options = llm_result.get("next_options", [])

    # 4. If the action was from CEO (human), automatically trigger AI players' decisions in PARALLEL
    if action.playerPosition == "ceo":
        print(f"[{STORAGE_MODE}] Triggering AI players in parallel...")
        
        # Prepare state for AI (they see the state AFTER CEO's move)
        ai_input_state = {
            "attributes": new_attributes,
            "history": new_history,
            "turn": current_state["turn"] + 1,
            "formulas": current_state["formulas"]
        }

        # Define async task for an AI player
        async def run_ai_turn(role, position):
             print(f"[{STORAGE_MODE}] Generating {role} decision...")
             decision = await LLMEngine.generate_ai_decision_async(ai_input_state, position, api_key)
             
             print(f"[{STORAGE_MODE}] Processing {role} decision...")
             result = await LLMEngine.process_turn_async(ai_input_state, decision, api_key, position)
             
             return {
                 "role": role,
                 "position": position,
                 "decision": decision,
                 "result": result
             }

        # Run CTO and CMO in parallel
        results = await asyncio.gather(
            run_ai_turn("CTO", "cto"),
            run_ai_turn("CMO", "cmo")
        )
        
        # Apply results sequentially to ensure deterministic history order
        # (Though we could timestamp them, sequential append is safer for readability)
        timestamp_offset = 2
        
        for res in results:
            role = res["role"]
            position = res["position"]
            decision = res["decision"]
            ai_result = res["result"]
            
            # Update Attributes
            ai_changes = ai_result.get("attribute_changes", {})
            for key, val in ai_changes.items():
                if key in new_attributes:
                    new_attributes[key] += val
                    new_attributes[key] = max(0, new_attributes[key])
            
            # Append History
            new_history.append({
                "id": int(time.time()) + timestamp_offset,
                "type": "player",
                "playerId": f"player_ai_{position}",
                "playerPosition": position,
                "text": f"{role}决策: {decision}"
            })
            timestamp_offset += 1
            
            ai_sys_text = ai_result.get("narrative", "")
            ai_sys_entry = {
                "id": int(time.time()) + timestamp_offset,
                "type": "system",
                "text": ai_sys_text
            }
            if "logic_chain" in ai_result:
                ai_sys_entry["logicChain"] = ai_result['logic_chain']
            
            new_history.append(ai_sys_entry)
            timestamp_offset += 1
            
            # Update options (CMO's options usually overwrite, or valid valid logic)
            # using the last one is fine for now
            final_options = ai_result.get("next_options", [])

    # Calculate Deltas
    deltas = {}
    for key in new_attributes:
        diff = new_attributes[key] - initial_attributes.get(key, 0)
        if diff != 0:
            deltas[key] = diff

    # Extract Event Summary (Prefer CEO's turn summary)
    event_summary = llm_result.get("event_summary", None)
    print(f"[{STORAGE_MODE}] Retrieved event_summary from LLM: {event_summary}")

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
        "options": new_doc["current_options"],
        "deltas": deltas,  # Return deltas to frontend
        "event_summary": event_summary # Return event summary
    }

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
