import { memo } from 'react';
import { Button } from '@mantine/core';
import { Icon } from '@iconify/react';
import { rem } from '@mantine/core';
import Skills from './Skills';
import LiveScoreboard from './LiveScoreboard';
import type { GameState } from '../common/types';
import styles from './HUD.module.css';

interface HUDProps {
  gameState: GameState | null;
  localPlayerId: string | null;
  onLeaveGame?: () => void;
}

function HUD({ gameState, localPlayerId, onLeaveGame }: HUDProps) {
  const localPlayer = gameState?.players.find(p => p.id === localPlayerId);
  const isGameActive = gameState !== null;

  return (
    <div id="hud" className={styles.hud}>
      {localPlayer && (
        <div className={styles.stats}>
          <div className={styles.statItem}>
            <span className={styles.statLabel}>Kills:</span>
            <span className={styles.statValue}>{localPlayer.kills || 0}</span>
          </div>
          <div className={styles.statItem}>
            <span className={styles.statLabel}>Deaths:</span>
            <span className={styles.statValue}>{localPlayer.deaths || 0}</span>
          </div>
          <div className={styles.statItem}>
            <span className={styles.statLabel}>HP:</span>
            <span className={styles.statValue}>
              {localPlayer.health}/{localPlayer.maxHealth}
            </span>
          </div>
        </div>
      )}
      
      {onLeaveGame && gameState && (
        <div className={styles.leaveButton}>
          <Button
            color="red"
            variant="light"
            size="sm"
            leftSection={<Icon icon="tabler:door-exit" style={{ width: rem(14) }} />}
            onClick={onLeaveGame}
          >
            Leave
          </Button>
        </div>
      )}
      
      {/* Only show Skills when game is active (not in menu) */}
      {isGameActive && <Skills />}
      
      {/* Show live scoreboard during active gameplay */}
      {isGameActive && <LiveScoreboard gameState={gameState} localPlayerId={localPlayerId} />}
    </div>
  );
}

export default memo(HUD);
