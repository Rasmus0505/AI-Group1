import json
from typing import Any, Dict, List

from openai import OpenAI


"""
极简版 Python LLM 引擎
======================

设计目标：
1. 只做一件事：根据当前状态 + 多个玩家指令，生成一次“推演结果 JSON”；
2. JSON 协议尽量贴近你后续前端 UI 的需求，而不是贴旧逻辑；
3. 保持函数签名、字段命名清晰，方便以后扩展事件、遮蔽、可见性等高级玩法。

注意：
- 本文件不再承载旧版的 init_game / analyze_logic / 多阶段 Agent 等复杂逻辑；
- 只保留一个核心入口：`generate_turn`；
- 具体的数学公式、博弈规则、周易等，可以以后按需要一点点加回去。
"""


class NarrativeEngine:
    """
    极简叙事引擎：
    - 输入：当前游戏状态 + 本回合所有玩家指令；
    - 输出：严格 JSON，对应前端“电影式 UI 播放器”可直接消费的结构。
    """

    def __init__(self, api_key: str, base_url: str = "https://api.deepseek.com/v1"):
        """
        :param api_key: DeepSeek 或兼容 OpenAI 接口的 API Key
        :param base_url: 默认使用 DeepSeek 官方地址
        """
        if not api_key:
            raise ValueError("API Key is required for NarrativeEngine")
        self.client = OpenAI(api_key=api_key, base_url=base_url)

    # ------------------------
    # 对外核心方法
    # ------------------------

    def generate_turn(
        self,
        state: Dict[str, Any],
        actions: List[Dict[str, Any]],
        *,
        model: str = "deepseek-chat",
        max_tokens: int = 800,
        temperature: float = 0.7,
    ) -> Dict[str, Any]:
        """
        Generate one turn result in a JSON format that directly matches
        the frontend TurnResultDTO contract.

        :param state: current game state (resources, round index, history summary, etc.)
        :param actions: list of player commands for this turn, e.g.:
                        [{"player_id": "P1", "role": "CEO", "text": "cut price aggressively"}, ...]
        :param model: model name
        :param max_tokens: max output tokens
        :param temperature: sampling temperature
        :return: JSON object with the following shape (TurnResultDTO-compatible):
                 {
                   "narrative": "long narrative text",
                   "events": [
                     {
                       "keyword": "a keyword that appears in narrative",
                       "resource": "cash | marketShare | reputation | innovation | ...",
                       "newValue": 80,
                       "type": "mutation",
                       "description": "short explanation for this resource change"
                     }
                   ],
                   "redactedSegments": [
                     {
                       "start": 45,
                       "end": 60,
                       "reason": "private_deal"
                     }
                   ],
                   "perEntityPanel": [
                     {
                       "id": "A",
                       "name": "主体 A",
                       "cash": 1000,
                       "marketShare": 30,
                       "reputation": 70,
                       "innovation": 60,
                       "passiveIncome": 120,
                       "passiveExpense": 80,
                       "delta": {
                         "cash": -100,
                         "marketShare": 2
                       },
                       "broken": false,
                       "achievementsUnlocked": ["some_achievement_id"]
                     }
                   ],
                   "leaderboard": [
                     {
                       "id": "A",
                       "name": "主体 A",
                       "score": 86,
                       "rank": 1,
                       "rankChange": 1
                     }
                   ],
                   "riskCard": "short text about key risks this turn",
                   "opportunityCard": "short text about key opportunities this turn",
                   "benefitCard": "short text about current benefits / payoff this turn",
                    "achievements": [
                     {
                       "id": "achv_id",
                       "entityId": "A",
                       "title": "achievement title",
                       "description": "what decision unlocked this achievement"
                     }
                   ],
                  "hexagram": {
                    "name": "乾",
                    "omen": "positive | neutral | negative",
                    "lines": ["yang","yang","yang","yang","yang","yang"],
                    "text": "象曰：天行健，君子以自强不息。",
                    "colorHint": "#4ade80"
                  },
                  "options": [
                    {
                      "id": "1",
                      "title": "Option 1",
                      "description": "brief summary",
                      "expectedDelta": {"cash": 0.15, "marketShare": 0.02}
                    }
                  ],
                  "ledger": {
                    "startingCash": 1200,
                    "passiveIncome": 120,
                    "passiveExpense": 80,
                    "decisionCost": 150,
                    "balance": 1090
                  },
                  "branchingNarratives": [
                    "Line A: ...",
                    "Line B: ..."
                  ],
                  "nextRoundHints": "short hints for next round (do not decide for players)"
                 }
        """
        system_prompt = (
            "你是一个多人博弈推演引擎。"
            "每回合等价于一个季度（Q1/Q2/Q3/Q4），不要改成半年。"
            "实体数量由输入决定，不要假定固定 ABCD，也不要在标识符中使用 emoji。"
            "未给出指令的主体只结算被动收支，不主动替他们做决策。"
            "你必须严格输出 JSON 对象，不得包含任何多余文字、注释、代码块或 markdown。"
        )

        user_prompt = self._build_prompt(state, actions)

        try:
            response = self.client.chat.completions.create(
                model=model,
                messages=[
                    {
                        "role": "system",
                        "content": system_prompt,
                    },
                    {
                        "role": "user",
                        "content": user_prompt,
                    },
                ],
                temperature=temperature,
                max_tokens=max_tokens,
                # 使用 JSON Mode，强制模型返回 JSON
                response_format={"type": "json_object"},
            )

            content = response.choices[0].message.content
            data = json.loads(content)

            # Minimal defensive fill: make sure all keys expected by TurnResultDTO exist,
            # so that the frontend cinematic player and dashboard can consume them safely.
            return {
                "narrative": data.get("narrative", ""),
                "events": data.get("events", []) or [],
                "redactedSegments": data.get("redactedSegments", []) or [],
                "perEntityPanel": data.get("perEntityPanel", []) or [],
                "leaderboard": data.get("leaderboard", []) or [],
                "riskCard": data.get("riskCard", ""),
                "opportunityCard": data.get("opportunityCard", ""),
                "benefitCard": data.get("benefitCard", ""),
                "achievements": data.get("achievements", []) or [],
                "hexagram": data.get("hexagram"),
                "options": data.get("options"),
                "ledger": data.get("ledger"),
                "branchingNarratives": data.get("branchingNarratives"),
                "nextRoundHints": data.get("nextRoundHints", ""),
            }
        except Exception as e:
            # 极简错误兜底：返回一个带错误信息的结构，避免前端直接崩溃
            return {
                "narrative": f"[ERROR] 引擎调用失败：{str(e)}",
                "events": [],
                "redactedSegments": [],
                "perEntityPanel": [],
                "leaderboard": [],
                "riskCard": "",
                "opportunityCard": "",
                "benefitCard": "",
                "achievements": [],
                "hexagram": None,
                "options": [],
                "ledger": None,
                "branchingNarratives": [],
                "nextRoundHints": "",
            }

    # ------------------------
    # 内部辅助方法
    # ------------------------

    def _build_prompt(self, state: Dict[str, Any], actions: List[Dict[str, Any]]) -> str:
        """
        根据当前状态 + 玩家指令，拼出给 LLM 的 user prompt。

        这里特意保持逻辑非常简单，你可以按需求自己扩展：
        - 把资源数值、历史事件、回合信息展开为自然语言；
        - 把多个玩家指令按顺序列出，强调角色身份和博弈关系；
        - 也可以在外层就先做“规则筛查”，这里只负责描述。
        """
        # 1. 状态摘要
        turn = state.get("turn", 1)
        attributes = state.get("attributes", {})
        history_summary = state.get("history_summary", "")

        # 2. 玩家指令列表转成可读文本
        actions_lines: List[str] = []
        for a in actions:
            pid = a.get("player_id", "Unknown")
            role = a.get("role", "Player")
            text = a.get("text", "")
            actions_lines.append(f"- {pid}（{role}）：{text}")

        actions_block = "\n".join(actions_lines) if actions_lines else "（本回合暂无玩家指令）"

        # 3. 提示 LLM 严格按与前端 TurnResultDTO 对齐的 JSON 协议返回
        protocol_description = """
【Output JSON contract - MUST match frontend TurnResultDTO】
你必须严格返回一个 JSON 对象，字段名必须与下面示例完全一致（可以精简内容，但不要改字段名）：
{
  "narrative": "一段包含所有推演细节的长文本，用于前端打字机播放",
  "events": [
    {
      "keyword": "某个在 narrative 中必然出现的关键词",
      "resource": "cash | marketShare | reputation | innovation 等",
      "newValue": 80,
      "type": "mutation",
      "description": "对该资源变动的简短说明"
    }
  ],
  "redactedSegments": [
    {
      "start": 10,
      "end": 30,
      "reason": "private_deal"
    }
  ],
  "perEntityPanel": [
    {
      "id": "E1",
      "name": "主体 1",
      "cash": 1000,
      "marketShare": 30,
      "reputation": 70,
      "innovation": 60,
      "passiveIncome": 120,
      "passiveExpense": 80,
      "delta": {
        "cash": -100,
        "marketShare": 2
      },
      "broken": false,
      "achievementsUnlocked": ["some_achievement_id"],
      "creditRating": "AA",
      "paletteKey": "deepBlue",
      "accentColor": "#1f3b73"
    }
  ],
  "leaderboard": [
    {
      "id": "E1",
      "name": "主体 1",
      "score": 86,
      "rank": 1,
      "rankChange": 1
    }
  ],
  "riskCard": "简要描述本回合的主要风险点",
  "opportunityCard": "简要描述本回合的关键机会",
  "benefitCard": "简要描述当前整体效益/收益",
  "achievements": [
    {
      "id": "achv_id",
      "entityId": "E1",
      "title": "成就名称",
      "description": "由哪类决策触发了这个成就"
    }
  ],
  "hexagram": {
    "name": "乾",
    "omen": "positive | neutral | negative",
    "lines": ["yang","yang","yang","yang","yang","yang"],
    "text": "象曰：天行健，君子以自强不息。",
    "colorHint": "#4ade80"
  },
  "options": [
    {
      "id": "1",
      "title": "策略选项 1",
      "description": "简要说明",
      "expectedDelta": {"cash": 0.15, "marketShare": 0.02}
    }
  ],
  "ledger": {
    "startingCash": 1200,
    "passiveIncome": 120,
    "passiveExpense": 80,
    "decisionCost": 150,
    "balance": 1090
  },
  "branchingNarratives": [
    "分支 A：...",
    "分支 B：..."
  ],
  "nextRoundHints": "简要提示下一回合可关注的方向（不要替玩家做决策）"
}

重要约束：
- narrative 中必须真实包含 events 中每个 keyword；
- redactedSegments 使用的是 narrative 的字符下标（从 0 开始计数）；
- 不要输出任何 JSON 之外的多余文字（例如解释、问候、Markdown 代码块等）。
- 实体数量来自输入，id/name 不要硬编码 ABCD；标识符中不要使用 emoji。
- 现金流安全：若余额接近被动支出临界，请在 riskCard 或 events 中明确提示。
"""

        prompt = f"""
【当前回合（季度制）】第 {turn} 回合

【当前资源状态】
{json.dumps(attributes, ensure_ascii=False)}

【历史摘要】
{history_summary}

【本回合玩家指令】
{actions_block}

{protocol_description}
"""
        return prompt.strip()


