import { useState, useEffect } from 'react';
import { Icon } from '@iconify/react';
import { rem } from '@mantine/core';
import { ItemType } from '../common/constants';
import type { GameState } from '../common/types';
import styles from './ActiveEffects.module.css';

interface ActiveEffectsProps {
  gameState?: GameState | null;
  localPlayerId?: string | null;
  isGameActive: boolean;
}

const EFFECT_CONFIG: Record<string, { icon: string; style?: React.CSSProperties }> = {
  [ItemType.DAMAGE_BOOST]: { icon: 'fluent-emoji:fire' },
  [ItemType.SHIELD]: { icon: 'fluent-emoji:shield' },
  [ItemType.HEALTH_PACK]: { icon: 'fluent-emoji:green-heart' },
};

export default function ActiveEffects({
  gameState,
  localPlayerId,
  isGameActive,
}: ActiveEffectsProps) {
  // Get active effects for local player
  const localPlayer = gameState?.players.find(p => p.id === localPlayerId);
  const activeEffects = localPlayer?.activeEffects || [];
  const [currentTime, setCurrentTime] = useState(Date.now());

  // Update time every 100ms for countdown timers
  useEffect(() => {
    if (!isGameActive || activeEffects.length === 0) return;

    const interval = setInterval(() => {
      setCurrentTime(Date.now());
    }, 100);

    return () => clearInterval(interval);
  }, [isGameActive, activeEffects.length]);

  const getEffectTimeRemaining = (expiresAt: number): number => {
    return Math.max(0, Math.ceil((expiresAt - currentTime) / 1000));
  };

  if (!isGameActive || activeEffects.length === 0) return null;

  return (
    <div className={styles.activeEffects}>
      {activeEffects.map((effect, index) => {
        const timeRemaining = getEffectTimeRemaining(effect.expiresAt);
        const config = EFFECT_CONFIG[effect.type] || { icon: 'fluent-emoji:sparkles' };
        
        return (
          <div key={`${effect.type}-${index}`} className={styles.effectItem}>
            <Icon 
              icon={config.icon} 
              style={{ 
                width: rem(20), 
                height: rem(20),
                ...config.style
              }} 
            />
            <span className={styles.effectTime}>{timeRemaining}s</span>
          </div>
        );
      })}
    </div>
  );
}
