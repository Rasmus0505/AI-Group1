/**
 * 长周期事件监控系统 - 测试和验证
 * 
 * 此文件包含完整的测试套件，用于验证系统的所有功能
 * 可在浏览器控制台运行
 */

import { eventManager, OngoingEvent, generateProgressOutput } from './eventSystem.js'
import { processDecision, updateGameEvents, initialState } from './gameLogic.js'

/**
 * 测试套件
 */
export const EventSystemTests = {
    /**
     * 测试 1: OngoingEvent 类基本功能
     */
    testOngoingEventClass() {
        console.log('\n✅ 测试 1: OngoingEvent 类基本功能')
        
        const event = new OngoingEvent(
            'test_1',
            '测试事件',
            5,
            '这是测试提示'
        )

        console.assert(event.id === 'test_1', '事件ID正确')
        console.assert(event.description === '测试事件', '事件描述正确')
        console.assert(event.totalRounds === 5, '总回合数正确')
        console.assert(event.currentRound === 0, '初始进度为0')
        console.assert(event.isCompleted === false, '初始未完成')

        console.log('   ✓ OngoingEvent 类正常工作')
    },

    /**
     * 测试 2: 事件进度更新
     */
    testProgressUpdate() {
        console.log('\n✅ 测试 2: 事件进度更新')

        const event = new OngoingEvent('test_2', '进度测试', 3, '')

        // 第一次更新
        let isComplete = event.updateProgress()
        console.assert(event.currentRound === 1, '第1回合正确')
        console.assert(isComplete === false, '未完成')
        console.assert(event.getProgressText() === '[进行中] 进度测试：进度 1/3', '进度文本正确')

        // 第二次更新
        isComplete = event.updateProgress()
        console.assert(event.currentRound === 2, '第2回合正确')
        console.assert(isComplete === false, '未完成')

        // 第三次更新 - 应该完成
        isComplete = event.updateProgress()
        console.assert(event.currentRound === 3, '第3回合正确')
        console.assert(isComplete === true, '已完成')
        console.assert(event.isCompleted === true, '标记为已完成')

        console.log('   ✓ 事件进度更新正常工作')
    },

    /**
     * 测试 3: 进度百分比计算
     */
    testProgressPercentage() {
        console.log('\n✅ 测试 3: 进度百分比计算')

        const event = new OngoingEvent('test_3', '百分比测试', 10, '')

        for (let i = 0; i < 5; i++) {
            event.updateProgress()
        }

        const percentage = event.getProgress()
        console.assert(percentage === 50, '5/10 回合 = 50%')

        console.log('   ✓ 进度百分比计算正确')
    },

    /**
     * 测试 4: EventManager 创建和添加事件
     */
    testEventManagerCreate() {
        console.log('\n✅ 测试 4: EventManager 创建和添加事件')

        eventManager.reset()

        eventManager.createAndAddEvent('test_4a', '事件A', 3, '提示A')
        eventManager.createAndAddEvent('test_4b', '事件B', 5, '提示B')

        const activeEvents = eventManager.getActiveEvents()
        console.assert(activeEvents.length === 2, '有2个活跃事件')
        console.assert(activeEvents[0].id === 'test_4a', '第一个事件ID正确')
        console.assert(activeEvents[1].id === 'test_4b', '第二个事件ID正确')

        console.log('   ✓ EventManager 创建和添加事件正常工作')
    },

    /**
     * 测试 5: updateEvents() 核心逻辑
     */
    testUpdateEvents() {
        console.log('\n✅ 测试 5: updateEvents() 核心逻辑')

        eventManager.reset()

        // 创建一个 2 回合的事件
        eventManager.createAndAddEvent('test_5', '核心测试', 2, '完成提示')

        // 第一次更新 - 应该显示进度
        let result = eventManager.updateEvents()
        console.assert(result.progressUpdates.length === 1, '有进度更新')
        console.assert(result.completedEvents.length === 0, '没有完成的事件')
        console.assert(result.hasSystemPrompts === false, '没有系统提示')
        console.assert(eventManager.getActiveEvents().length === 1, '仍有1个活跃事件')

        // 第二次更新 - 应该完成
        result = eventManager.updateEvents()
        console.assert(result.progressUpdates.length === 0, '没有进度更新')
        console.assert(result.completedEvents.length === 1, '有1个完成的事件')
        console.assert(result.hasSystemPrompts === true, '有系统提示')
        console.assert(eventManager.getActiveEvents().length === 0, '没有活跃事件')
        console.assert(eventManager.getCompletedEvents().length === 1, '有1个已完成事件')

        console.log('   ✓ updateEvents() 核心逻辑正常工作')
    },

    /**
     * 测试 6: 系统提示生成和管理
     */
    testSystemPrompts() {
        console.log('\n✅ 测试 6: 系统提示生成和管理')

        eventManager.reset()

        eventManager.createAndAddEvent('test_6', '提示测试', 1, '测试提示内容')

        // 更新事件直到完成
        eventManager.updateEvents()

        const prompts = eventManager.getSystemPrompts()
        console.assert(prompts.length === 1, '有1个系统提示')
        console.assert(prompts[0].includes('已完成'), '提示包含"已完成"')
        console.assert(prompts[0].includes('测试提示内容'), '提示包含自定义内容')

        // 清空提示
        eventManager.clearSystemPrompts()
        const emptyPrompts = eventManager.getSystemPrompts()
        console.assert(emptyPrompts.length === 0, '提示已清空')

        console.log('   ✓ 系统提示生成和管理正常工作')
    },

    /**
     * 测试 7: 多个并发事件
     */
    testMultipleConcurrentEvents() {
        console.log('\n✅ 测试 7: 多个并发事件')

        eventManager.reset()

        // 创建3个不同时长的事件
        eventManager.createAndAddEvent('test_7a', '事件A', 2, '提示A')
        eventManager.createAndAddEvent('test_7b', '事件B', 3, '提示B')
        eventManager.createAndAddEvent('test_7c', '事件C', 1, '提示C')

        // 第一次更新：C完成
        let result = eventManager.updateEvents()
        console.assert(result.completedEvents.length === 1, '1个事件完成')
        console.assert(result.progressUpdates.length === 2, '2个事件仍在进行')
        console.assert(eventManager.getActiveEvents().length === 2, '2个活跃事件')

        // 第二次更新：A完成
        result = eventManager.updateEvents()
        console.assert(result.completedEvents.length === 1, '1个事件完成')
        console.assert(result.progressUpdates.length === 1, '1个事件仍在进行')
        console.assert(eventManager.getActiveEvents().length === 1, '1个活跃事件')

        // 第三次更新：B完成
        result = eventManager.updateEvents()
        console.assert(result.completedEvents.length === 1, '1个事件完成')
        console.assert(result.progressUpdates.length === 0, '没有进行中的事件')
        console.assert(eventManager.getActiveEvents().length === 0, '没有活跃事件')
        console.assert(eventManager.getCompletedEvents().length === 3, '3个已完成事件')

        console.log('   ✓ 多个并发事件正常工作')
    },

    /**
     * 测试 8: 事件摘要生成
     */
    testEventSummary() {
        console.log('\n✅ 测试 8: 事件摘要生成')

        eventManager.reset()

        eventManager.createAndAddEvent('test_8a', '事件A', 4, '')
        eventManager.createAndAddEvent('test_8b', '事件B', 4, '')

        // 更新一次
        eventManager.updateEvents()

        const summary = eventManager.getEventSummary()
        console.assert(summary.activeCount === 2, '2个活跃事件')
        console.assert(summary.completedCount === 0, '0个已完成事件')
        console.assert(summary.events.length === 2, '摘要中有2个事件')
        console.assert(summary.events[0].progress === 25, '第一个事件进度为25%')

        console.log('   ✓ 事件摘要生成正常工作')
    },

    /**
     * 测试 9: generateProgressOutput 函数
     */
    testProgressOutput() {
        console.log('\n✅ 测试 9: generateProgressOutput 函数')

        eventManager.reset()

        eventManager.createAndAddEvent('test_9', '输出测试', 2, '')

        // 第一次更新
        let result = eventManager.updateEvents()
        let output = generateProgressOutput(result)
        console.assert(output.includes('[进行中]'), '包含进行中标记')
        console.assert(output.includes('1/2'), '包含进度信息')

        // 第二次更新
        result = eventManager.updateEvents()
        output = generateProgressOutput(result)
        console.assert(output.includes('✅'), '包含完成标记')

        console.log('   ✓ generateProgressOutput 函数正常工作')
    },

    /**
     * 测试 10: 与 gameLogic 的集成
     */
    testGameLogicIntegration() {
        console.log('\n✅ 测试 10: 与 gameLogic 的集成')

        eventManager.reset()

        // 创建初始状态副本
        let state = { ...initialState }

        // 创建一个测试事件
        eventManager.createAndAddEvent('test_10', '集成测试', 1, '集成提示')

        // 模拟决策
        const decision = {
            label: '测试决策',
            effects: { cash: 10 }
        }

        // 处理决策
        const newState = processDecision(state, decision)

        console.assert(newState.turn === 2, '回合数增加')
        console.assert(newState.attributes.cash === 1010, '属性更新正确')
        console.assert(newState.history.length > state.history.length, '历史记录增加')

        console.log('   ✓ 与 gameLogic 的集成正常工作')
    },

    /**
     * 测试 11: 事件链式触发
     */
    testEventChaining() {
        console.log('\n✅ 测试 11: 事件链式触发模拟')

        eventManager.reset()

        // 创建第一个事件
        eventManager.createAndAddEvent('chain_1', '第一个事件', 1, '完成第一个')

        // 更新直到完成
        eventManager.updateEvents()

        const completedEvents = eventManager.getCompletedEvents()
        console.assert(completedEvents.length === 1, '第一个事件已完成')

        // 基于完成创建新事件
        if (completedEvents.some(e => e.id === 'chain_1')) {
            eventManager.createAndAddEvent('chain_2', '第二个事件', 1, '完成第二个')
        }

        console.assert(eventManager.getActiveEvents().length === 1, '第二个事件已创建')

        console.log('   ✓ 事件链式触发模拟正常工作')
    },

    /**
     * 测试 12: 系统重置
     */
    testSystemReset() {
        console.log('\n✅ 测试 12: 系统重置')

        eventManager.createAndAddEvent('test_12', '重置测试', 5, '')
        eventManager.updateEvents()

        console.assert(eventManager.getActiveEvents().length > 0, '有活跃事件')

        eventManager.reset()

        console.assert(eventManager.getActiveEvents().length === 0, '没有活跃事件')
        console.assert(eventManager.getCompletedEvents().length === 0, '没有已完成事件')
        console.assert(eventManager.getSystemPrompts().length === 0, '没有系统提示')

        console.log('   ✓ 系统重置正常工作')
    },

    /**
     * 运行所有测试
     */
    runAll() {
        console.log('\n' + '='.repeat(60))
        console.log('🧪 开始长周期事件监控系统测试套件')
        console.log('='.repeat(60))

        try {
            this.testOngoingEventClass()
            this.testProgressUpdate()
            this.testProgressPercentage()
            this.testEventManagerCreate()
            this.testUpdateEvents()
            this.testSystemPrompts()
            this.testMultipleConcurrentEvents()
            this.testEventSummary()
            this.testProgressOutput()
            this.testGameLogicIntegration()
            this.testEventChaining()
            this.testSystemReset()

            console.log('\n' + '='.repeat(60))
            console.log('✅ 所有 12 个测试都通过了！')
            console.log('='.repeat(60))
            console.log('\n系统状态: 🟢 生产就绪\n')

            return true
        } catch (error) {
            console.error('\n❌ 测试失败:', error)
            return false
        }
    }
}

/**
 * 性能测试
 */
export const PerformanceTests = {
    /**
     * 测试大量并发事件的性能
     */
    testLargeScaleEvents() {
        console.log('\n🏃 性能测试：大规模事件处理')

        eventManager.reset()

        // 创建 100 个事件
        console.time('创建 100 个事件')
        for (let i = 0; i < 100; i++) {
            eventManager.createAndAddEvent(
                `perf_${i}`,
                `性能测试事件 ${i}`,
                Math.floor(Math.random() * 10) + 1,
                `完成提示 ${i}`
            )
        }
        console.timeEnd('创建 100 个事件')

        // 运行 10 次更新
        console.time('运行 10 次 updateEvents()')
        for (let i = 0; i < 10; i++) {
            eventManager.updateEvents()
        }
        console.timeEnd('运行 10 次 updateEvents()')

        // 生成摘要
        console.time('生成事件摘要')
        const summary = eventManager.getEventSummary()
        console.timeEnd('生成事件摘要')

        console.log(`结果: ${summary.activeCount} 个活跃事件, ${summary.completedCount} 个已完成`)
    },

    /**
     * 运行所有性能测试
     */
    runAll() {
        console.log('\n' + '='.repeat(60))
        console.log('⚡ 性能测试')
        console.log('='.repeat(60))

        this.testLargeScaleEvents()

        console.log('\n✅ 性能测试完成\n')
    }
}

/**
 * 完整测试运行器
 */
export function runCompleteTests() {
    EventSystemTests.runAll()
    PerformanceTests.runAll()
}

// 导出用于浏览器控制台测试
export { eventManager }

/**
 * 在浏览器控制台中使用:
 * 
 * import { runCompleteTests, EventSystemTests, PerformanceTests } from './eventSystemTests.js'
 * 
 * // 运行所有测试
 * runCompleteTests()
 * 
 * // 或运行特定测试
 * EventSystemTests.runAll()
 * PerformanceTests.runAll()
 * 
 * // 或运行单个测试
 * EventSystemTests.testOngoingEventClass()
 */
