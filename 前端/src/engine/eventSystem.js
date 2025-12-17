/**
 * 长周期事件监控系统
 * 用于管理需要多回合才能完成的事件
 */

/**
 * OngoingEvent 类 - 代表一个正在进行的事件
 */
export class OngoingEvent {
    /**
     * @param {string} id - 事件唯一ID
     * @param {string} description - 事件描述
     * @param {number} totalRounds - 总持续回合数
     * @param {string} completionPrompt - 完成后的提示词指令
     */
    constructor(id, description, totalRounds, completionPrompt = "") {
        this.id = id;
        this.description = description;
        this.totalRounds = totalRounds;
        this.currentRound = 0; // 当前进度回合
        this.completionPrompt = completionPrompt;
        this.isCompleted = false;
        this.createdAt = Date.now();
    }

    /**
     * 获取事件进度百分比
     */
    getProgress() {
        return (this.currentRound / this.totalRounds) * 100;
    }

    /**
     * 获取进度显示文本
     */
    getProgressText() {
        return `[进行中] ${this.description}：进度 ${this.currentRound}/${this.totalRounds}`;
    }

    /**
     * 更新事件进度
     * @returns {boolean} 是否已完成
     */
    updateProgress() {
        if (this.isCompleted) return false;

        this.currentRound++;

        if (this.currentRound >= this.totalRounds) {
            this.isCompleted = true;
            return true; // 事件已完成
        }

        return false;
    }
}

/**
 * EventManager - 全局事件管理器
 */
export class EventManager {
    constructor() {
        this.activeEvents = []; // 存储正在进行的事件
        this.completedEvents = []; // 存储已完成的事件
        this.systemPrompts = []; // 待注入的系统提示
    }

    /**
     * 添加新事件
     * @param {OngoingEvent} event
     */
    addEvent(event) {
        this.activeEvents.push(event);
    }

    /**
     * 通过参数创建并添加事件
     * @param {string} id
     * @param {string} description
     * @param {number} totalRounds
     * @param {string} completionPrompt
     */
    createAndAddEvent(id, description, totalRounds, completionPrompt = "") {
        const event = new OngoingEvent(id, description, totalRounds, completionPrompt);
        this.addEvent(event);
        return event;
    }

    /**
     * 获取活跃事件列表
     */
    getActiveEvents() {
        return this.activeEvents;
    }

    /**
     * 获取已完成事件列表
     */
    getCompletedEvents() {
        return this.completedEvents;
    }

    /**
     * 获取待注入的系统提示
     */
    getSystemPrompts() {
        return this.systemPrompts;
    }

    /**
     * 清空系统提示（在注入后调用）
     */
    clearSystemPrompts() {
        this.systemPrompts = [];
    }

    /**
     * 每回合更新事件进度 (核心逻辑)
     * @returns {Object} 包含进度更新信息和系统提示
     */
    updateEvents() {
        const progressUpdates = [];
        const newCompletedEvents = [];

        // 遍历所有活跃事件
        for (let i = this.activeEvents.length - 1; i >= 0; i--) {
            const event = this.activeEvents[i];
            const isCompleted = event.updateProgress();

            if (isCompleted) {
                // 事件已完成，移到已完成列表
                newCompletedEvents.push(event);
                this.activeEvents.splice(i, 1);

                // 生成完成提示
                const completionSystemPrompt = `【系统提示】玩家的"${event.description}"事件已完成！${event.completionPrompt}`;
                this.systemPrompts.push(completionSystemPrompt);
            } else {
                // 事件仍在进行中，收集进度文本
                progressUpdates.push(event.getProgressText());
            }
        }

        // 将完成的事件添加到已完成列表
        this.completedEvents.push(...newCompletedEvents);

        return {
            progressUpdates,
            completedEvents: newCompletedEvents,
            hasSystemPrompts: this.systemPrompts.length > 0
        };
    }

    /**
     * 获取所有进度显示文本（用于输出到UI）
     */
    getAllProgressText() {
        return this.activeEvents.map(event => event.getProgressText());
    }

    /**
     * 检查是否有未完成的事件
     */
    hasActiveEvents() {
        return this.activeEvents.length > 0;
    }

    /**
     * 获取事件摘要（用于UI显示）
     */
    getEventSummary() {
        return {
            activeCount: this.activeEvents.length,
            completedCount: this.completedEvents.length,
            events: this.activeEvents.map(e => ({
                id: e.id,
                description: e.description,
                currentRound: e.currentRound,
                totalRounds: e.totalRounds,
                progress: e.getProgress()
            }))
        };
    }

    /**
     * 移除已完成的事件（可选）
     */
    removeCompletedEvent(eventId) {
        this.completedEvents = this.completedEvents.filter(e => e.id !== eventId);
    }

    /**
     * 重置管理器
     */
    reset() {
        this.activeEvents = [];
        this.completedEvents = [];
        this.systemPrompts = [];
    }
}

// 创建全局事件管理器实例
export const eventManager = new EventManager();

/**
 * 生成进度更新文本，用于添加到系统输出中
 * @param {Object} updateResult - updateEvents() 的返回结果
 * @returns {string} 格式化的进度文本
 */
export function generateProgressOutput(updateResult) {
    if (updateResult.progressUpdates.length === 0 && updateResult.completedEvents.length === 0) {
        return "";
    }

    let output = "";

    // 添加完成事件的提示
    if (updateResult.completedEvents.length > 0) {
        for (const event of updateResult.completedEvents) {
            output += `✅ ${event.description}已完成！\n`;
        }
    }

    // 添加进行中事件的进度
    if (updateResult.progressUpdates.length > 0) {
        output += updateResult.progressUpdates.join("\n");
    }

    return output;
}
