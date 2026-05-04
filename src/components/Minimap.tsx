import { useRef, useEffect, memo } from 'react';
import type { GameState, MapConfig } from '../common/types';
import styles from './Minimap.module.css';

interface MinimapProps {
  gameState: GameState | null;
  localPlayerId: string | null;
  mapConfig?: MapConfig | null;
}

const MINIMAP_SIZE = 180;
const MINIMAP_PADDING = 10;

function Minimap({ gameState, localPlayerId, mapConfig }: MinimapProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Default map size if not provided
  const mapSize = mapConfig?.playableArea?.size || 70;
  const scale = (MINIMAP_SIZE - MINIMAP_PADDING * 2) / mapSize;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !gameState) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, MINIMAP_SIZE, MINIMAP_SIZE);

    // Draw background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(0, 0, MINIMAP_SIZE, MINIMAP_SIZE);

    // Draw arena boundary
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.lineWidth = 2;
    ctx.strokeRect(
      MINIMAP_PADDING,
      MINIMAP_PADDING,
      MINIMAP_SIZE - MINIMAP_PADDING * 2,
      MINIMAP_SIZE - MINIMAP_PADDING * 2
    );

    // Helper to convert world coords to minimap coords
    const worldToMinimap = (x: number, z: number) => {
      const halfMap = mapSize / 2;
      const minimapX = MINIMAP_PADDING + ((x + halfMap) / mapSize) * (MINIMAP_SIZE - MINIMAP_PADDING * 2);
      const minimapY = MINIMAP_PADDING + ((z + halfMap) / mapSize) * (MINIMAP_SIZE - MINIMAP_PADDING * 2);
      return { x: minimapX, y: minimapY };
    };

    // Draw walls/obstacles from map config
    if (mapConfig) {
      ctx.fillStyle = 'rgba(100, 100, 100, 0.8)';
      
      // Draw walls
      mapConfig.walls?.forEach(wall => {
        const pos = worldToMinimap(wall.position.x, wall.position.z);
        const width = wall.dimensions.width * scale;
        const depth = wall.dimensions.depth * scale;
        ctx.fillRect(pos.x - width / 2, pos.y - depth / 2, width, depth);
      });

      // Draw boxes
      ctx.fillStyle = 'rgba(139, 119, 101, 0.8)';
      mapConfig.boxes?.forEach(box => {
        const pos = worldToMinimap(box.position.x, box.position.z);
        const width = box.dimensions.width * scale;
        const depth = box.dimensions.depth * scale;
        ctx.fillRect(pos.x - width / 2, pos.y - depth / 2, width, depth);
      });
    }

    // Draw players
    gameState.players.forEach(player => {
      const pos = worldToMinimap(player.position.x, player.position.z);
      const isLocal = player.id === localPlayerId;
      const isDead = player.isDead;

      // Player dot size
      const dotSize = isLocal ? 6 : 5;

      // Set color based on state
      if (isDead) {
        ctx.fillStyle = 'rgba(128, 128, 128, 0.5)'; // Gray for dead
      } else if (isLocal) {
        ctx.fillStyle = '#00ff00'; // Green for local player
      } else {
        ctx.fillStyle = '#ff4444'; // Red for other players
      }

      // Draw player dot
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, dotSize, 0, Math.PI * 2);
      ctx.fill();

      // Draw direction indicator for local player
      if (isLocal && !isDead) {
        ctx.strokeStyle = '#00ff00';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, dotSize + 3, 0, Math.PI * 2);
        ctx.stroke();
      }
    });

    // Draw missiles
    if (gameState.missiles) {
      ctx.fillStyle = '#ffaa00';
      gameState.missiles.forEach(missile => {
        const pos = worldToMinimap(missile.position.x, missile.position.z);
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, 3, 0, Math.PI * 2);
        ctx.fill();
      });
    }

  }, [gameState, localPlayerId, mapConfig, mapSize, scale]);

  if (!gameState) return null;

  return (
    <div className={styles.minimapContainer}>
      <canvas
        ref={canvasRef}
        width={MINIMAP_SIZE}
        height={MINIMAP_SIZE}
        className={styles.minimapCanvas}
      />
      <div className={styles.minimapLabel}>MAP</div>
    </div>
  );
}

export default memo(Minimap);

