export interface Vector3 {
  x: number;
  y: number;
  z: number;
}

export interface Vector2 {
  x: number;
  y: number;
}

export interface Quaternion {
  x: number;
  y: number;
  z: number;
  w: number;
}

export interface PlayerState {
  id: string;
  username?: string; // Player's display name
  avatar?: string; // Player's avatar (for future use)
  position: Vector3;
  rotation: Quaternion;
  health: number;
  maxHealth: number;
  isInvulnerable: boolean;
  isMoving: boolean;
  teleportCooldown: number;
  isTeleporting: boolean;
  homingMissileCooldown: number;
  laserBeamCooldown: number;
  invincibilityCooldown: number;
  attackCooldown: number;
  isAttacking: boolean;
  attackDirection?: Vector3;
  isDead: boolean;
  isFrozen?: boolean;
  kills?: number;
  deaths?: number;
  lastPlayerAlive?: number;
  color: number;
  activeEffects?: PlayerEffect[];
  hasShield?: boolean;
  lastDamageTime?: number;
  lastDamageAmount?: number;
}

export interface MissileState {
  id: string;
  ownerId: string; // ID of the player who fired the missile
  position: Vector3;
  rotation: Quaternion;
  targetId: string | null; // ID of the player being targeted, or null if directional
}

export interface LaserBeamState {
  id: string;
  ownerId: string; // Shooter player ID (for preventing self-damage)
  startPosition: Vector3;
  endPosition: Vector3;
  expiresAt: number; // Timestamp when beam disappears
}

export interface ItemState {
  id: string;
  type: string; // ItemType
  position: Vector3;
  isCollected: boolean;
  respawnAt?: number; // Timestamp when item will respawn
}

export interface PlayerEffect {
  type: string; // ItemType
  expiresAt: number; // Timestamp when effect expires
}

export interface GameState {
  players: PlayerState[];
  missiles: MissileState[];
  laserBeams: LaserBeamState[];
  items: ItemState[];
  timestamp: number;
  gameMode: string;
  currentRound: number;
  totalRounds: number;
  freezeTimeEnd?: number;
  winnerId?: string;
  roundWinnerId?: string;
  matchStartTime?: number;
  matchEndTime?: number;
  matchDuration?: number; // Duration of the match in milliseconds
  useTimerMode?: boolean;
  targetScore?: number; // Target kills to win the game
  endReason?: 'timer' | 'target' | 'rounds'; // How the game ended
  warmupEndTime?: number; // When warmup ends (for countdown)
}

export interface MapConfig {
  name: string;
  version: string;
  playableArea: {
    size: number;
  };
  spawnPoints: Vector3[];
  walls: {
    id: string;
    position: Vector3;
    dimensions: { width: number; height: number; depth: number };
    color: number;
  }[];
  boxes: {
    id: string;
    position: Vector3;
    dimensions: { width: number; height: number; depth: number };
    color: number;
  }[];
}

export interface InputState {
  keys: { [key: string]: boolean };
  mouse: { x: number; y: number; z: number; isMouseLeftDown?: boolean } | null;
}
