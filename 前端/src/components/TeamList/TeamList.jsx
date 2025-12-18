import React from 'react';
import styles from './TeamList.module.css';

const PlayerRow = ({ player }) => {
    const getPositionIcon = (position) => {
        switch (position) {
            case 'ceo': return '👑';
            case 'cto': return '💻';
            case 'cmo': return '📈';
            default: return '👤';
        }
    };

    return (
        <div className={styles.playerRow}>
            <span>{getPositionIcon(player.position)}</span>
            <span className={styles.playerName} style={{ color: player.type === 'human' ? '#00ff9d' : '#00f0ff' }}>{player.name}</span>
            <span className={styles.playerPosition}>({player.position.toUpperCase()})</span>
        </div>
    )
}

export default function TeamList({ players }) {
    return (
        <div className={styles.container}>
            <h3 className={styles.title}>团队成员 (TEAM)</h3>
            <div className={styles.list}>
                {players.map(player => (
                    <PlayerRow key={player.id} player={player} />
                ))}
            </div>
        </div>
    );
}
