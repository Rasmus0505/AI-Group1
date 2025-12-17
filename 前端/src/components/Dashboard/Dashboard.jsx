import React from 'react';
import styles from './Dashboard.module.css';

const StatBar = ({ label, value, max = 100, color = 'var(--color-accent)' }) => (
    <div className={styles.statRow}>
        <span className={styles.label}>{label}</span>
        <div className={styles.barContainer}>
            <div
                className={styles.barFill}
                style={{ width: `${(value / max) * 100}%`, backgroundColor: color }}
            ></div>
        </div>
        <span className={styles.value}>{value}</span>
    </div>
);

const PlayerCard = ({ player }) => {
    const getPositionIcon = (position) => {
        switch (position) {
            case 'ceo': return '👑';
            case 'cto': return '💻';
            case 'cmo': return '📈';
            default: return '👤';
        }
    };

    return (
        <div className={styles.playerCard}>
            <span className={styles.playerIcon}>{getPositionIcon(player.position)}</span>
            <div className={styles.playerInfo}>
                <div className={styles.playerName}>{player.name}</div>
                <div className={styles.playerType}>
                    {player.type === 'human' ? '🤖 玩家' : '🧠 AI'}
                </div>
            </div>
        </div>
    );
};

export default function Dashboard({ attributes, players }) {
    return (
        <div className={styles.dashboard}>
            <h2 className={styles.title}>公司状态</h2>
            <div className={styles.grid}>
                <StatBar label="现金流 (Cash)" value={attributes.cash} max={2000} color="#00ff9d" />
                <StatBar label="士气 (Morale)" value={attributes.morale} color="#00f0ff" />
                <StatBar label="声望 (Reputation)" value={attributes.reputation} color="#ff0055" />
                <StatBar label="创新 (Innovation)" value={attributes.innovation} color="#bf00ff" />
            </div>
            
            <h2 className={styles.title}>团队成员</h2>
            <div className={styles.playersGrid}>
                {players.map(player => (
                    <PlayerCard key={player.id} player={player} />
                ))}
            </div>
        </div>
    );
}
