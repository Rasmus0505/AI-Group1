import React from 'react';
import styles from './Dashboard.module.css';

const StatRow = ({ label, value, delta = 0, color = '#fff' }) => (
    <div className={styles.statRow}>
        <span className={styles.label} style={{ color: '#aaa' }}>{label}</span>
        <div className={styles.valueContainer}>
            <span className={styles.value} style={{ color: color }}>{value}</span>
            {delta !== 0 && (
                <span style={{
                    color: delta > 0 ? '#00ff9d' : '#ff0055',
                    fontSize: '0.8rem',
                    fontWeight: 'bold',
                    fontFamily: 'monospace'
                }}>
                    {delta > 0 ? `▲${delta}` : `▼${Math.abs(delta)}`}
                </span>
            )}
        </div>
    </div>
);

export default function Dashboard({ attributes, deltas = {} }) {
    return (
        <div className={styles.dashboard}>
            <h2 className={styles.title}>公司核心数据 (CORE DATA)</h2>

            {/* Stats Grid */}
            <div className={styles.grid}>
                <StatRow label="现金流 (万)" value={attributes.cash.toLocaleString()} color="#fff" delta={deltas.cash} />
                <StatRow label="士气" value={attributes.morale} color="#fff" delta={deltas.morale} />
                <StatRow label="声望" value={attributes.reputation} color="#fff" delta={deltas.reputation} />
                <StatRow label="创新" value={attributes.innovation} color="#fff" delta={deltas.innovation} />
            </div>
        </div>
    );
}
