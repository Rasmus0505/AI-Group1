import React, { useEffect, useRef } from 'react';
import styles from './Terminal.module.css';

export default function Terminal({ history }) {
    const bottomRef = useRef(null);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [history]);

    return (
        <div className={styles.terminal}>
            <div className={styles.content}>
                {history.map((entry) => (
                    <div
                        key={entry.id}
                        className={`${styles.entry} ${entry.type === 'player' ? styles.playerEntry : styles.systemEntry}`}
                    >
                        <span className={styles.prefix}>
                            {entry.type === 'player' ? '> ' : '# '}
                        </span>
                        <div className={styles.messageContent}>
                            <span className={styles.text}>{entry.text}</span>

                            {/* Logic Chain Display */}
                            {entry.logicChain && (
                                <details className={styles.logicChainDetails} style={{ marginTop: '10px', fontSize: '0.8rem', color: '#ff00ff' }}>
                                    <summary style={{ cursor: 'pointer', opacity: 0.8 }}>👁️ 查看 AI 思考过程 (逻辑链)</summary>
                                    <div style={{
                                        marginTop: '5px',
                                        padding: '10px',
                                        backgroundColor: 'rgba(0,0,0,0.5)',
                                        borderRadius: '4px',
                                        borderLeft: '2px solid #ff00ff',
                                        whiteSpace: 'pre-wrap',
                                        fontFamily: 'monospace'
                                    }}>
                                        {entry.logicChain}
                                    </div>
                                </details>
                            )}
                        </div>
                    </div>
                ))}
                <div ref={bottomRef} />
            </div>
        </div>
    );
}
