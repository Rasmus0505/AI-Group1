import { eventManager, generateProgressOutput } from './eventSystem.js';

export const initialState = {
    companyName: "Nexus Corp",
    turn: 1,
    attributes: {
        cash: 1000,
        morale: 50,
        reputation: 50,
        innovation: 10
    },
    activeEvents: [], // 当前活跃事件
    systemPrompts: [], // 待注入的系统提示
    players: [
        {
            id: "player_human",
            name: "CEO (你)",
            type: "human",
            position: "ceo"
        },
        {
            id: "player_ai_tech",
            name: "CTO (AI)",
            type: "ai",
            position: "cto"
        },
        {
            id: "player_ai_market",
            name: "CMO (AI)",
            type: "ai",
            position: "cmo"
        }
    ],
    history: [
        {
            id: 0,
            type: 'system',
            text: "欢迎来到《凡墙皆是门》。你已被任命为 Nexus Corp 的首席执行官。"
        },
        {
            id: 1,
            type: 'system',
            text: "📜 公司背景："
        },
        {
            id: 2,
            type: 'system',
            text: "Nexus Corp 成立于2035年，专注于量子计算和神经接口技术开发。创始人在一次实验室事故中失踪，留下了这家处于转型期的科技公司。"
        },
        {
            id: 3,
            type: 'system',
            text: "💼 当前困境："
        },
        {
            id: 4,
            type: 'system',
            text: "- 资金链紧张：量子计算项目超支，现金储备仅够维持3个月\n- 团队分裂：研发部坚持继续量子项目，市场部要求转向更赚钱的神经接口\n- 声誉危机：媒体质疑公司的技术安全性，股价下跌20%\n- 创新停滞：核心团队流失，新想法难产"
        },
        {
            id: 5,
            type: 'system',
            text: "🌍 行业环境："
        },
        {
            id: 6,
            type: 'system',
            text: "科技巨头 Quantum Dynamics 正准备推出下一代量子计算机，将彻底改变行业格局。神经接口领域竞争激烈，多家初创公司获得大额融资。"
        },
        {
            id: 7,
            type: 'system',
            text: "🎯 你的任务："
        },
        {
            id: 8,
            type: 'system',
            text: "带领 Nexus Corp 走出困境，决定公司的未来方向。是坚持量子计算的长期愿景，还是转向更务实的神经接口业务？每一个决定都将影响公司的命运。"
        },
        {
            id: 9,
            type: 'system',
            text: "公司正处于十字路口，你的每一个决定都至关重要。"
        }
    ]
};

/**
 * 更新事件进度并生成输出
 * @param {Object} state - 当前游戏状态
 * @returns {Object} 包含事件相关的状态更新
 */
export function updateGameEvents(state) {
    // 更新所有事件进度
    const updateResult = eventManager.updateEvents();

    // 生成进度显示文本
    const progressOutput = generateProgressOutput(updateResult);

    // 获取待注入的系统提示
    const systemPrompts = eventManager.getSystemPrompts();

    // 清空系统提示（防止重复）
    eventManager.clearSystemPrompts();

    // 更新状态中的事件和提示信息
    const newState = {
        ...state,
        activeEvents: eventManager.getActiveEvents().map(e => ({
            id: e.id,
            description: e.description,
            currentRound: e.currentRound,
            totalRounds: e.totalRounds,
            progress: e.getProgress()
        })),
        systemPrompts: systemPrompts
    };

    return {
        state: newState,
        progressOutput,
        systemPrompts,
        updateResult
    };
}

export function processDecision(state, decision) {
    const newAttributes = { ...state.attributes };
    let resultText = "";

    // Apply effects
    if (decision.effects) {
        if (decision.effects.cash) newAttributes.cash += decision.effects.cash;
        if (decision.effects.morale) newAttributes.morale += decision.effects.morale;
        if (decision.effects.reputation) newAttributes.reputation += decision.effects.reputation;
        if (decision.effects.innovation) newAttributes.innovation += decision.effects.innovation;
    }

    // Generate result text (simple template)
    if (decision.customText) {
        resultText = `你决定：${decision.customText}。`;
    } else {
        resultText = `执行了计划：${decision.label}。`;
    }

    // Bounds checking
    newAttributes.morale = Math.min(100, Math.max(0, newAttributes.morale));
    newAttributes.reputation = Math.min(100, Math.max(0, newAttributes.reputation));

    const baseState = {
        ...state,
        turn: state.turn + 1,
        attributes: newAttributes,
        history: [
            ...state.history,
            { id: Date.now(), type: 'player', text: resultText },
            { id: Date.now() + 1, type: 'system', text: decision.resultNarrative || "由于你的决策，局势发生了变化。" }
        ]
    };

    // 更新事件进度并获取事件相关输出
    const eventUpdate = updateGameEvents(baseState);

    // 如果有事件进度更新，添加到历史记录中
    if (eventUpdate.progressOutput) {
        eventUpdate.state.history = [
            ...eventUpdate.state.history,
            { id: Date.now() + 2, type: 'system', text: eventUpdate.progressOutput }
        ];
    }

    return eventUpdate.state;
}