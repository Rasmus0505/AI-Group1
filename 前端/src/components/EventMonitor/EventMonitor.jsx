/**
 * 长周期事件监控系统 - React 集成示例
 * 这是一个可以直接集成到 React 应用中的事件显示组件
 */

import React, { useState, useEffect } from 'react'
import styles from './EventMonitor.module.css'
import { eventManager } from '../../engine/eventSystem.js'

/**
 * EventMonitor 组件 - 显示所有正在进行的事件及其进度
 */
export function EventMonitor() {
    const [eventSummary, setEventSummary] = useState({
        activeCount: 0,
        completedCount: 0,
        events: []
    })

    // 监听事件系统的变化，每秒更新一次
    useEffect(() => {
        const updateDisplay = () => {
            setEventSummary(eventManager.getEventSummary())
        }

        // 初始更新
        updateDisplay()

        // 设置实时更新定时器 - 每1000ms更新一次
        const timer = setInterval(updateDisplay, 1000)
        
        // 清理定时器
        return () => clearInterval(timer)
    }, [])

    if (eventSummary.activeCount === 0) {
        return (
            <div className={styles.container}>
                <div className={styles.emptyState}>
                    <span>📭 暂无进行中的事件</span>
                </div>
            </div>
        )
    }

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <h3>🎯 事件跟踪</h3>
                <span className={styles.count}>
                    {eventSummary.activeCount} 个活跃
                </span>
            </div>

            <div className={styles.eventList}>
                {eventSummary.events.map(event => (
                    <EventCard key={event.id} event={event} />
                ))}
            </div>

            {eventSummary.completedCount > 0 && (
                <div className={styles.footer}>
                    已完成 {eventSummary.completedCount} 个事件
                </div>
            )}
        </div>
    )
}

/**
 * EventCard 组件 - 单个事件卡片
 */
function EventCard({ event }) {
    const percentage = event.progress

    return (
        <div className={styles.card}>
            <div className={styles.cardHeader}>
                <h4>{event.description}</h4>
            </div>

            <div className={styles.progressContainer}>
                <div className={styles.progressBar}>
                    <div
                        className={styles.progressFill}
                        style={{ width: `${percentage}%` }}
                    />
                </div>
                <span className={styles.progressText}>
                    {event.currentRound}/{event.totalRounds}
                </span>
            </div>

            <div className={styles.progressDetail}>
                {generateProgressSteps(event.currentRound, event.totalRounds)}
            </div>
        </div>
    )
}

/**
 * 生成进度步骤指示器
 */
function generateProgressSteps(current, total) {
    const steps = []

    for (let i = 1; i <= total; i++) {
        const isCompleted = i <= current
        steps.push(
            <div
                key={i}
                className={`${styles.step} ${
                    isCompleted ? styles.stepCompleted : styles.stepPending
                }`}
                title={`第 ${i} 回合${isCompleted ? ' ✓' : ''}`}
            >
                {i}
            </div>
        )
    }

    return <div className={styles.stepContainer}>{steps}</div>
}

/**
 * 高级事件面板 - 带有详细信息
 */
export function AdvancedEventPanel() {
    const [activeTab, setActiveTab] = useState('active')
    const activeEvents = eventManager.getActiveEvents()
    const completedEvents = eventManager.getCompletedEvents()

    return (
        <div className={styles.advancedPanel}>
            <div className={styles.tabs}>
                <button
                    className={`${styles.tab} ${
                        activeTab === 'active' ? styles.active : ''
                    }`}
                    onClick={() => setActiveTab('active')}
                >
                    进行中 ({activeEvents.length})
                </button>
                <button
                    className={`${styles.tab} ${
                        activeTab === 'completed' ? styles.active : ''
                    }`}
                    onClick={() => setActiveTab('completed')}
                >
                    已完成 ({completedEvents.length})
                </button>
            </div>

            <div className={styles.tabContent}>
                {activeTab === 'active' ? (
                    <ActiveEventsView events={activeEvents} />
                ) : (
                    <CompletedEventsView events={completedEvents} />
                )}
            </div>
        </div>
    )
}

/**
 * 进行中事件视图
 */
function ActiveEventsView({ events }) {
    if (events.length === 0) {
        return (
            <div className={styles.emptyView}>
                <p>暂无进行中的事件</p>
            </div>
        )
    }

    return (
        <div className={styles.eventDetailList}>
            {events.map(event => (
                <div key={event.id} className={styles.eventDetail}>
                    <div className={styles.eventTitle}>
                        <span className={styles.icon}>⏳</span>
                        <h4>{event.description}</h4>
                    </div>

                    <div className={styles.eventInfo}>
                        <p>
                            <strong>进度：</strong> {event.currentRound} / {event.totalRounds} 回合
                        </p>
                        <p>
                            <strong>完成度：</strong> {Math.round(event.progress)}%
                        </p>
                        <p>
                            <strong>事件ID：</strong>
                            <code>{event.id}</code>
                        </p>
                    </div>

                    <div className={styles.detailedProgressBar}>
                        <div
                            className={styles.detailedFill}
                            style={{ width: `${event.progress}%` }}
                        />
                    </div>

                    <div className={styles.estimatedTime}>
                        预计还需 {event.totalRounds - event.currentRound} 个回合完成
                    </div>
                </div>
            ))}
        </div>
    )
}

/**
 * 已完成事件视图
 */
function CompletedEventsView({ events }) {
    if (events.length === 0) {
        return (
            <div className={styles.emptyView}>
                <p>暂无已完成的事件</p>
            </div>
        )
    }

    return (
        <div className={styles.eventDetailList}>
            {events.map(event => (
                <div key={event.id} className={styles.completedEvent}>
                    <div className={styles.eventTitle}>
                        <span className={styles.icon}>✅</span>
                        <h4>{event.description}</h4>
                    </div>

                    <div className={styles.eventInfo}>
                        <p>
                            <strong>总用时：</strong> {event.totalRounds} 回合
                        </p>
                        <p>
                            <strong>完成提示词：</strong>
                            <em>{event.completionPrompt || '无'}</em>
                        </p>
                        <p>
                            <strong>事件ID：</strong>
                            <code>{event.id}</code>
                        </p>
                    </div>
                </div>
            ))}
        </div>
    )
}

/**
 * 迷你事件提示 - 用于头部或角落显示
 */
export function MiniEventIndicator() {
    const summary = eventManager.getEventSummary()

    if (summary.activeCount === 0) {
        return null
    }

    return (
        <div className={styles.miniIndicator}>
            <span className={styles.badge}>{summary.activeCount}</span>
            <span className={styles.label}>事件中</span>
        </div>
    )
}

/**
 * 事件通知 - 显示最近完成的事件
 */
export function EventNotification({ notification }) {
    if (!notification) return null

    return (
        <div className={`${styles.notification} ${styles.notificationSuccess}`}>
            <span className={styles.notificationIcon}>✅</span>
            <div className={styles.notificationContent}>
                <p className={styles.notificationTitle}>事件完成</p>
                <p className={styles.notificationMessage}>
                    {notification.description}已完成！
                </p>
                {notification.completionPrompt && (
                    <p className={styles.notificationPrompt}>
                        {notification.completionPrompt}
                    </p>
                )}
            </div>
        </div>
    )
}
