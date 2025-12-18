/**
 * 事件系统集成测试工具
 * 用于验证长周期事件监控系统是否正确集成
 */

import { eventManager } from './eventSystem.js';

/**
 * 测试套件：验证事件系统的完整功能
 */
export class EventSystemTestSuite {
    constructor() {
        this.results = [];
    }

    /**
     * 测试 1: 事件创建
     */
    testEventCreation() {
        console.log('🧪 [测试 1] 事件创建...');
        
        eventManager.reset();
        const initialCount = eventManager.getActiveEvents().length;
        
        eventManager.createAndAddEvent(
            'test_create',
            '创建测试事件',
            5,
            '测试完成'
        );
        
        const afterCount = eventManager.getActiveEvents().length;
        const passed = afterCount === initialCount + 1;
        
        console.log(passed ? '✅ 通过' : '❌ 失败');
        console.log(`   - 事件数: ${initialCount} → ${afterCount}`);
        
        this.results.push({ test: '事件创建', passed });
        return passed;
    }

    /**
     * 测试 2: 事件进度更新
     */
    testEventProgressUpdate() {
        console.log('🧪 [测试 2] 事件进度更新...');
        
        eventManager.reset();
        const event = eventManager.createAndAddEvent(
            'test_progress',
            '进度测试事件',
            3,
            '进度完成'
        );
        
        const initialProgress = event.getProgress();
        const updateResult = eventManager.updateEvents();
        const afterProgress = event.getProgress();
        
        const passed = afterProgress > initialProgress && !event.isCompleted;
        
        console.log(passed ? '✅ 通过' : '❌ 失败');
        console.log(`   - 进度: ${initialProgress}% → ${afterProgress}%`);
        console.log(`   - 完成: ${event.isCompleted}`);
        
        this.results.push({ test: '事件进度更新', passed });
        return passed;
    }

    /**
     * 测试 3: 事件完成检测
     */
    testEventCompletion() {
        console.log('🧪 [测试 3] 事件完成检测...');
        
        eventManager.reset();
        const event = eventManager.createAndAddEvent(
            'test_completion',
            '完成测试事件',
            2,
            '完成提示'
        );
        
        // 执行足够的更新以完成事件
        let isCompleted = false;
        for (let i = 0; i < 5; i++) {
            const result = eventManager.updateEvents();
            if (event.isCompleted) {
                isCompleted = true;
                break;
            }
        }
        
        const activeCount = eventManager.getActiveEvents().length;
        const completedCount = eventManager.getCompletedEvents().length;
        
        const passed = isCompleted && activeCount === 0 && completedCount === 1;
        
        console.log(passed ? '✅ 通过' : '❌ 失败');
        console.log(`   - 事件完成: ${isCompleted}`);
        console.log(`   - 活跃事件: ${activeCount}`);
        console.log(`   - 完成事件: ${completedCount}`);
        
        this.results.push({ test: '事件完成检测', passed });
        return passed;
    }

    /**
     * 测试 4: 系统提示生成
     */
    testSystemPromptGeneration() {
        console.log('🧪 [测试 4] 系统提示生成...');
        
        eventManager.reset();
        const completionPrompt = '这是一个测试完成提示';
        
        eventManager.createAndAddEvent(
            'test_prompt',
            '提示测试事件',
            1,
            completionPrompt
        );
        
        // 更新直到完成
        for (let i = 0; i < 3; i++) {
            eventManager.updateEvents();
        }
        
        const prompts = eventManager.getSystemPrompts();
        const hasPrompt = prompts.length > 0 && prompts[0].includes(completionPrompt);
        
        console.log(hasPrompt ? '✅ 通过' : '❌ 失败');
        console.log(`   - 生成提示数: ${prompts.length}`);
        if (hasPrompt) {
            console.log(`   - 提示内容: "${prompts[0]}"`);
        }
        
        this.results.push({ test: '系统提示生成', passed: hasPrompt });
        return hasPrompt;
    }

    /**
     * 测试 5: 事件摘要生成
     */
    testEventSummary() {
        console.log('🧪 [测试 5] 事件摘要生成...');
        
        eventManager.reset();
        
        eventManager.createAndAddEvent('test_1', '事件1', 5, '提示1');
        eventManager.createAndAddEvent('test_2', '事件2', 3, '提示2');
        
        const summary = eventManager.getEventSummary();
        
        const passed = 
            summary.activeCount === 2 &&
            summary.completedCount === 0 &&
            summary.events.length === 2 &&
            summary.events[0].progress !== undefined;
        
        console.log(passed ? '✅ 通过' : '❌ 失败');
        console.log(`   - 活跃事件数: ${summary.activeCount}`);
        console.log(`   - 完成事件数: ${summary.completedCount}`);
        console.log(`   - 事件详情数: ${summary.events.length}`);
        
        this.results.push({ test: '事件摘要生成', passed });
        return passed;
    }

    /**
     * 测试 6: 多事件并行处理
     */
    testMultipleEventsConcurrent() {
        console.log('🧪 [测试 6] 多事件并行处理...');
        
        eventManager.reset();
        
        // 创建3个不同长度的事件
        eventManager.createAndAddEvent('test_fast', '快速事件', 1, '快完成');
        eventManager.createAndAddEvent('test_medium', '中速事件', 3, '中完成');
        eventManager.createAndAddEvent('test_slow', '缓速事件', 5, '慢完成');
        
        // 执行多个回合
        const rounds = [];
        for (let i = 0; i < 6; i++) {
            const result = eventManager.updateEvents();
            rounds.push({
                round: i + 1,
                activeCount: eventManager.getActiveEvents().length,
                completedCount: eventManager.getCompletedEvents().length
            });
        }
        
        const passed = 
            rounds[0].activeCount === 3 &&  // 开始时3个活跃
            rounds[0].completedCount === 0 &&
            rounds[5].activeCount === 0 &&  // 结束时所有完成
            rounds[5].completedCount === 3;
        
        console.log(passed ? '✅ 通过' : '❌ 失败');
        console.log('   - 回合进度:');
        rounds.forEach(r => {
            console.log(`     回合 ${r.round}: ${r.activeCount} 活跃, ${r.completedCount} 完成`);
        });
        
        this.results.push({ test: '多事件并行处理', passed });
        return passed;
    }

    /**
     * 运行所有测试
     */
    runAllTests() {
        console.log('╔════════════════════════════════════════════════════╗');
        console.log('║     事件系统集成测试套件                            ║');
        console.log('╚════════════════════════════════════════════════════╝\n');
        
        this.testEventCreation();
        console.log();
        
        this.testEventProgressUpdate();
        console.log();
        
        this.testEventCompletion();
        console.log();
        
        this.testSystemPromptGeneration();
        console.log();
        
        this.testEventSummary();
        console.log();
        
        this.testMultipleEventsConcurrent();
        console.log();
        
        // 打印总结
        this.printSummary();
    }

    /**
     * 打印测试总结
     */
    printSummary() {
        const passed = this.results.filter(r => r.passed).length;
        const total = this.results.length;
        const percentage = Math.round((passed / total) * 100);
        
        console.log('╔════════════════════════════════════════════════════╗');
        console.log('║                  测试总结                            ║');
        console.log('╠════════════════════════════════════════════════════╣');
        console.log(`║ 通过: ${passed}/${total} (${percentage}%)`.padEnd(55) + '║');
        console.log('╠════════════════════════════════════════════════════╣');
        
        this.results.forEach(result => {
            const status = result.passed ? '✅' : '❌';
            const line = `║ ${status} ${result.test}`.padEnd(55) + '║';
            console.log(line);
        });
        
        console.log('╚════════════════════════════════════════════════════╝');
        
        return percentage === 100;
    }
}

/**
 * 快速测试函数
 */
export function quickEventSystemTest() {
    const suite = new EventSystemTestSuite();
    suite.runAllTests();
}

/**
 * 使用示例：
 * 在浏览器控制台中运行：
 * import { quickEventSystemTest } from './eventSystemIntegrationTest.js';
 * quickEventSystemTest();
 */
