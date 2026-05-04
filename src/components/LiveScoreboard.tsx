import { memo } from 'react';
import type { GameState } from '../common/types';
import styles from './LiveScoreboard.module.css';

interface LiveScoreboardProps {
  gameState: GameState | null;
  localPlayerId: string | null;
}

function LiveScoreboard({ gameState, localPlayerId }: LiveScoreboardProps) {
  if (!gameState || gameState.players.length === 0) {
    return null;
  }

  // Sort players by kills (descending) and take top 3
  const topPlayers = [...gameState.players]
    .sort((a, b) => (b.kills || 0) - (a.kills || 0))
    .slice(0, 3);

  return (
    <div className={styles.liveScoreboard}>
      <div className={styles.header}>TOP PLAYERS</div>
      <div className={styles.playerList}>
        {topPlayers.map((player, index) => {
          const isLocalPlayer = player.id === localPlayerId;
          const rank = index + 1;
          const displayName = player.username || player.id.substring(0, 8);
          
          return (
            <div
              key={player.id}
              className={`${styles.playerRow} ${isLocalPlayer ? styles.localPlayer : ''}`}
            >
              <span className={styles.rank}>#{rank}</span>
              <span className={styles.name}>{displayName}</span>
              <span className={styles.kills}>{player.kills || 0}</span>
            </div>
          );
        })}
      </div>
      {gameState.targetScore && (
        <div className={styles.target}>
          Target: {gameState.targetScore} kills
        </div>
      )}
    </div>
  );
}

export default memo(LiveScoreboard);
