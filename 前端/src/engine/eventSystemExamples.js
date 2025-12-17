/**
 * 长周期事件监控系统 - 使用示例
 * 
 * 此文件展示如何在游戏中创建和管理长周期事件
 */

import { eventManager, OngoingEvent } from './eventSystem.js';
import { processDecision, updateGameEvents } from './gameLogic.js';
import { sendAction } from './api.js';

/**
 * 示例 1: 创建一个"修炼内功"事件
 * 该事件需要 5 个回合来完成，完成后会提示 AI 推演修炼结果
 */
export function createCultivationEvent() {
    const completionPrompt = "请根据当前的创新属性和公司状态，推演修炼成果对公司的影响。推演应包括：1) 技术创新的提升；2) 员工能力的增强；3) 对公司长期竞争力的影响。";

    eventManager.createAndAddEvent(
        'cultivation',
        '修炼内功',
        5,
        completionPrompt
    );
}

/**
 * 示例 2: 创建一个"市场调研"事件
 * 该事件需要 3 个回合完成
 */
export function createMarketResearchEvent() {
    const completionPrompt = "市场调研已完成。请根据调研结果，为公司未来的市场策略提出建议，考虑当前的现金流和名誉度。";

    eventManager.createAndAddEvent(
        'market_research',
        '市场调研',
        3,
        completionPrompt
    );
}

/**
 * 示例 3: 创建一个"融资谈判"事件
 * 该事件需要 4 个回合完成
 */
export function createFundraisingEvent() {
    const completionPrompt = "融资谈判阶段完成！请根据当前公司状况和现金状态，决定融资成功与否，以及对股权的影响。";

    eventManager.createAndAddEvent(
        'fundraising',
        '融资谈判',
        4,
        completionPrompt
    );
}

/**
 * 示例 4: 在处理玩家决策时集成事件系统
 * 
 * @param {Object} state - 当前游戏状态
 * @param {Object} decision - 玩家的决策
 * @param {Array<string>} systemPrompts - 来自事件系统的系统提示
 */
export async function handlePlayerDecisionWithEvents(state, decision, systemPrompts = []) {
    // 处理玩家决策
    const newState = processDecision(state, decision);

    // 获取事件系统的系统提示
    const eventSystemPrompts = newState.systemPrompts || [];
    const allSystemPrompts = [...systemPrompts, ...eventSystemPrompts];

    // 发送到后端 AI，将系统提示注入到 Context 中
    try {
        const response = await sendAction(decision, allSystemPrompts);
        return response;
    } catch (error) {
        console.error("处理决策失败:", error);
        throw error;
    }
}

/**
 * 示例 5: 在游戏初始化时创建初始事件
 * 可以在游戏开始时触发某些预定义的长周期事件
 */
export function initializeGameEvents() {
    // 随机在游戏开始时创建一个事件
    const randomEvent = Math.floor(Math.random() * 3);

    switch (randomEvent) {
        case 0:
            createCultivationEvent();
            console.log("游戏开始：触发'修炼内功'事件");
            break;
        case 1:
            createMarketResearchEvent();
            console.log("游戏开始：触发'市场调研'事件");
            break;
        case 2:
            createFundraisingEvent();
            console.log("游戏开始：触发'融资谈判'事件");
            break;
    }
}

/**
 * 示例 6: 获取事件摘要用于UI显示
 */
export function getEventStatus() {
    return eventManager.getEventSummary();
}

/**
 * 示例 7: 显示所有进度信息
 */
export function displayEventProgress() {
    const summary = eventManager.getEventSummary();

    if (summary.activeCount === 0) {
        console.log("当前没有正在进行的事件");
        return;
    }

    console.log(`📋 当前事件进度 (${summary.activeCount} 个活跃事件):`);
    summary.events.forEach(event => {
        const progressBar = generateProgressBar(event.progress);
        console.log(
            `  ${event.description}: ${progressBar} ${event.currentRound}/${event.totalRounds}`
        );
    });
}

/**
 * 辅助函数: 生成进度条
 */
function generateProgressBar(percentage, length = 20) {
    const filled = Math.round((percentage / 100) * length);
    const empty = length - filled;
    return '[' + '█'.repeat(filled) + '░'.repeat(empty) + ']';
}

/**
 * 示例 8: 完整的游戏回合流程
 */
export async function completeGameRound(state, playerDecision) {
    console.log(`\n=== 第 ${state.turn} 回合 ===`);

    // 1. 处理玩家决策
    let newState = processDecision(state, playerDecision);

    // 2. 获取系统提示（来自事件系统）
    const systemPrompts = newState.systemPrompts || [];

    // 3. 发送到 AI 处理
    const aiResponse = await sendAction(playerDecision, systemPrompts);

    // 4. 显示事件进度
    console.log("\n📊 事件进度:");
    displayEventProgress();

    // 5. 如果有完成的事件，输出完成信息
    if (systemPrompts.length > 0) {
        console.log("\n✅ 事件完成通知:");
        systemPrompts.forEach(prompt => console.log(`  ${prompt}`));
    }

    return aiResponse;
}

/**
 * 示例 9: 导出事件数据（用于保存/调试）
 */
export function exportEventData() {
    return {
        activeEvents: eventManager.getActiveEvents().map(e => ({
            id: e.id,
            description: e.description,
            progress: e.currentRound,
            total: e.totalRounds,
            completed: e.isCompleted
        })),
        completedEvents: eventManager.getCompletedEvents().map(e => ({
            id: e.id,
            description: e.description,
            completedAt: e.createdAt + (e.totalRounds * 1000) // 近似值
        }))
    };
}

// 导出事件管理器供其他模块使用
export { eventManager };
