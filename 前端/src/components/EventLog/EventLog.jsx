import React, { useEffect, useRef } from 'react';
import styles from './EventLog.module.css';

export default function EventLog({ events }) {
    const endRef = useRef(null);

    useEffect(() => {
        endRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [events]);

    return (
        <div className={styles.container}>
            <h3 className={styles.header}>事件记载簿 (Event Log)</h3>
            <div className={styles.list}>
                {events.length === 0 && <div className={styles.empty}>暂无事件记录...</div>}
                {events.map((event, index) => (
                    <div key={index} className={styles.entry}>
                        <div className={styles.turn}>Turn {event.turn}</div>
                        <div className={styles.summary}>{event.summary}</div>
                    </div>
                ))}
                <div ref={endRef} />
            </div>
        </div>
    );
}
