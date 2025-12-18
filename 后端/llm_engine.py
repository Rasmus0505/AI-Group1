import os
from openai import OpenAI, AsyncOpenAI
import json
import random
from datetime import datetime

GAME_MANUAL = """
【游戏规则核心】
游戏名称：《凡墙皆是门》
1. 核心逻辑：玩家通过文字指令经营公司，AI根据属性动态生成策略选项，文字互动生成式游戏。
2. 属性：现金(Cash)、士气(Morale)、声望(Reputation)、创新(Innovation)。
3. 判定原则：
   - 识别玩家指令是否是“决策”！禁止“效果类”“计划类”“预期类”指令（如“修复关系”是错的，“降低售价”是对的）。
   - 每一回合代表半年。
   - 允许非标准决策。
4. 周易起卦：每回合（或每年）利用周易六十四卦生成随机事件方向。
5. 因果链：前一回合的决策必须显著影响后续剧情，体现“蝴蝶效应”。
"""

HOST_INSTRUCTIONS = """
【主持人指令 - 核心逻辑链条】
1. **严格的因果链**：必须详细阅读所有历史记录，分析之前的决策如何导致了现在的局面。
2. **数值公式化**：
   - 每回合必须基于固定公式计算数值变动。
   - 基础公式：`下回合数值 = 当前数值 + 被动收益 - 被动支出 + 本回合决策影响 + 随机事件影响`
   - 你必须在思考过程中明确列出这个算式。
3. **幻觉抑制**：不要编造未发生的历史。
"""

class LLMEngine:
    def __init__(self):
        pass

    @staticmethod
    def _get_client(api_key: str):
        if not api_key:
            raise ValueError("API Key is missing")
        # Use DeepSeek API URL
        return OpenAI(api_key=api_key, base_url="https://api.deepseek.com/v1")

    @staticmethod
    def _get_async_client(api_key: str):
        if not api_key:
            raise ValueError("API Key is missing")
        return AsyncOpenAI(api_key=api_key, base_url="https://api.deepseek.com/v1")

    @staticmethod
    def _get_hexagram():
        hexagrams = [
            "乾为天 (元亨利贞)", "坤为地 (厚德载物)", "水雷屯 (万事开头难)", "山水蒙 (启蒙)",
            "水天需 (等待时机)", "天水讼 (争执)", "地水师 (兴师动众)", "水地比 (亲密无间)"
        ]
        return random.choice(hexagrams)

    @classmethod
    def init_game(cls, settings_text: str, api_key: str):
        prompt = f"""
{GAME_MANUAL}

【任务】
初始化游戏《凡墙皆是门》。

【用户设定】
{settings_text}

【要求】
1. 生成背景故事（600字左右），包含多方博弈。
2. **定义数值公式**：明确定义 Cash, Morale 等属性在每回合如何变化的数学公式（例如：Passive_Income = Innovation * 10）。
3. 设定初始属性。

【返回格式 (JSON only)】
{{
    "narrative": "...",
    "formulas": {{
        "cash_rule": "Cash_Next = Cash - 50 (Base Cost) + Innovation * 5 (Licensing) + Action_Effect",
        "morale_rule": "Morale_Next = Morale - 2 (Fatigue) + Action_Effect"
    }},
    "passive_rules": {{ "income_base": 100, "expense_base": 50 }},
    "initial_attributes": {{ "cash": 1000, "morale": 50, "reputation": 50, "innovation": 10 }},
    "first_options": [
        {{ 
            "id": "1", 
            "label": "...", 
            "desc": "...", 
            "cost": 100,
            "cost_desc": "Initial Setup: 100",
            "predicted_effect": "..." 
        }}
    ]
}}
"""
        return cls._call_llm(prompt, api_key)

    @classmethod
    def analyze_logic(cls, current_state: dict, player_action_text: str, api_key: str, player_position: str = "ceo"):
        """
        Phase 1: The Analyst (Logic Agent)
        - Fast, deterministic math & validity check.
        - Returns: Cost, Validity, Attribute Deltas, and Logic Chain keypoints.
        """
        full_history = current_state.get('history', [])
        recent_history_entries = full_history[-30:] 
        history_text = "\n".join([f"[{h['type'].upper()}] {h.get('playerPosition', 'CEO')}: {h['text']}" for h in recent_history_entries])
        
        attributes = current_state.get('attributes', {})
        formulas = current_state.get('formulas', "Standard Logic")
        
        # Player Info
        player_role = "CEO"
        if player_position == "cto": player_role = "CTO"
        elif player_position == "cmo": player_role = "CMO"
        
        prompt = f"""
{GAME_MANUAL}
{HOST_INSTRUCTIONS}

【当前状态】
- Turn: {current_state.get('turn', 1)}
- Attributes: {attributes}
- Formulas: {formulas}

【历史片段】
{history_text}

【玩家指令】
{player_role}: "{player_action_text}"

【任务: 逻辑演算 (The Analyst)】
你是一个纯粹的逻辑计算引擎。请执行以下步骤：
1. **合规检查**：指令是否有效？
2. **数学计算**：根据公式和指令，计算属性变化。
3. **成本推断**：如果玩家下达了自定义指令（如“举办派对”），必须根据常识推断并扣除成本。

【返回格式 (JSON only)】
{{
    "valid": true,
    "logic_chain": "1. 玩家指令分析... 2. 成本计算... 3. 结果...",
    "attribute_changes": {{ "cash": -500, "morale": +5, ... }},
    "event_summary": "一句话概括核心事件 (<10字)"
}}
"""
        # Fast call with lower max_tokens
        return cls._call_llm(prompt, api_key, max_tokens=300)

    @classmethod
    def stream_narrative(cls, current_state: dict, analyst_result: dict, player_action_text: str, api_key: str):
        """
        Phase 2: The Narrator (Creative Agent)
        - Streams narrative based on Analyst's math.
        """
        client = cls._get_client(api_key)
        
        attributes = current_state.get('attributes', {})
        hexagram = cls._get_hexagram()
        
        prompt = f"""
{GAME_MANUAL}

【当前状态】
- Attributes: {attributes}
- I Ching: {hexagram}

【逻辑演算结果 (不可更改，必须严格基于此生成剧情)】
{json.dumps(analyst_result, ensure_ascii=False, indent=2)}

【玩家指令】
"{player_action_text}"

【任务: 剧情生成 (The Narrator)】
1. 基于上述逻辑结果和卦象，创作一段引人入胜的剧情。
2. **剧情简述**: <200字，动作感强，不要啰嗦。
3. **生成选项**: 4个后续决策选项 (含成本)。

【返回格式 (JSON only)】
{{
    "narrative": "...",
    "next_options": [
         {{ "id": "1", "label": "...", "desc": "...", "cost": 100, "cost_desc": "...", "predicted_effect": "..." }},
         ...
    ]
}}
"""
        # Streaming Call
        response = client.chat.completions.create(
            model="deepseek-chat",
            messages=[
                {"role": "system", "content": "You are a Game Master Narrator. Output JSON."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.7,
            stream=True # ENABLE STREAMING
        )
        return response

    @classmethod
    async def analyze_logic_async(cls, current_state: dict, player_action_text: str, api_key: str, player_position: str = "ceo"):
        return await cls._run_in_executor(cls.analyze_logic, current_state, player_action_text, api_key, player_position)
=======
    "logic_chain": "1. ... 2. ...",
    "narrative": "剧情内容...",
    "event_summary": "一句话概括本回合发生的关键事件（用于侧边栏日志）...需包含本轮游戏的几个角色",
    "attribute_changes": {{ "cash": -100, "morale": -5, "reputation": 0, "innovation": 10 }},
    "next_options": [
         {{ 
           "id": "1", 
           "label": "选项简述", 
           "desc": "详细描述...", 
           "cost": 500, 
           "cost_desc": "研发投入: 500",
           "predicted_effect": "..." 
         }},
         {{ "id": "2", "cost": 0, "cost_desc": "无成本", ... }},
         {{ "id": "3", ... }},
         {{ "id": "4", ... }}
    ]
}}
"""
        response_data = cls._call_llm(prompt, api_key)
        
        if "system_note" not in response_data and "logic_chain" in response_data:
            response_data["system_note"] = response_data["logic_chain"]
            
        return response_data

    @classmethod
    async def process_turn_async(cls, current_state: dict, player_action_text: str, api_key: str, player_position: str = "ceo"):
        """Async version of process_turn"""
        return await cls._run_in_executor(cls.process_turn, current_state, player_action_text, api_key, player_position)
>>>>>>> origin/main

    
    @classmethod
    def generate_ai_decision(cls, current_state: dict, player_position: str, api_key: str):
        """
        为AI玩家生成决策
        :param current_state: 当前游戏状态
        :param player_position: AI玩家位置 (cto, cmo)
        :param api_key: API密钥
        :return: AI决策文本
        """
        full_history = current_state.get('history', [])
        recent_history_entries = full_history[-30:] 
        history_text = "\n".join([f"[{h['type'].upper()}] {h.get('playerPosition', 'CEO')}: {h['text']}" for h in recent_history_entries])
        
        attributes = current_state.get('attributes', {})
        formulas = current_state.get('formulas', "Standard Logic")
        hexagram = cls._get_hexagram()
        
        # AI角色信息
        ai_role = "CTO"
        ai_focus = "技术研发和创新方向"
        if player_position == "cmo":
            ai_role = "CMO"
            ai_focus = "市场营销和品牌管理方向"
        
        prompt = f"""
{GAME_MANUAL}

【当前状态】
- Turn: {current_state.get('turn', 1)}
- Attributes: {attributes}
- Formulas: {formulas}
- I Ching: {hexagram}

【完整历史记录】
{history_text}

【AI角色指令】
你是公司的{ai_role}，负责{ai_focus}。
请根据当前公司状态和历史决策，生成一个符合你角色定位的决策建议。
决策必须是具体的行动（如"增加研发投入"、"开展市场推广活动"等），而不是效果或计划。

【返回要求】
直接返回决策文本，不要包含任何额外信息或格式。
"""
        
        response = cls._call_llm(prompt, api_key)
        return response.get("narrative", "").strip()

    @classmethod
    async def generate_ai_decision_async(cls, current_state: dict, player_position: str, api_key: str):
        """Async version of generate_ai_decision"""
        return await cls._run_in_executor(cls.generate_ai_decision, current_state, player_position, api_key)

    @staticmethod
    async def _run_in_executor(func, *args):
        import asyncio
        loop = asyncio.get_running_loop()
        return await loop.run_in_executor(None, func, *args)


    @classmethod
<<<<<<< HEAD
    def _call_llm(cls, prompt, api_key, max_tokens=None):
=======
    def _call_llm(cls, prompt, api_key):
>>>>>>> origin/main
        try:
            client = cls._get_client(api_key)
            print(f"DEBUG: Calling LLM at {client.base_url} with model deepseek-chat...")
            response = client.chat.completions.create(
                model="deepseek-chat", # Using DeepSeek's chat model
                messages=[
                    {"role": "system", "content": "You are a Game Master Engine. Output STRICT JSON only. No markdown formatting like ```json."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.7,
                max_tokens=max_tokens,
                response_format={"type": "json_object"}
            )
            return json.loads(response.choices[0].message.content)
        except Exception as e:
            import traceback
            traceback.print_exc()
            print(f"LLM Error: {e}")
            return {
                "narrative": f"Error: {str(e)}",
                "attribute_changes": {},
                "next_options": []
            }
