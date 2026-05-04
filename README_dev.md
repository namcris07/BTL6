# Neon Ninja Arena - Developer Documentation
## Assignment 5: .io Arena (AI + Networking, 3D)

This document provides detailed implementation references for all assignment requirements with code snippets from the codebase.

---

## Table of Contents
- [Core Loop](#core-loop)
- [Controls & Camera](#controls--camera)
- [3D Presentation (3 pts)](#3d-presentation-3-pts)
- [Networking (3 pts)](#networking-3-pts)
- [AI + Game (4 pts)](#ai--game-4-pts)
  - [Single-player Mode](#single-player-mode-1-pt)
  - [Items/Power-ups](#itemspower-ups-1-pt)
  - [Multiple Bot Archetypes](#multiple-bot-archetypes-2-pts)

---

## Core Loop

### Spawn into Shared Arena
Players spawn at random positions within the map boundaries when joining a game.

```typescript
// src/server/GameServer.ts:84-118
case 'JOIN_REQUEST': {
  const player = this.entityManager.addPlayer(playerId);
  const isHost = playerId === this.networkManager.peerId;

  // Set player username if available
  if (message.username) {
    player.username = message.username;
  } else if (isHost && this.networkManager.playerName) {
    player.username = this.networkManager.playerName;
  }

  // Send join response
  this.networkManager.sendToClient(playerId, {
    type: 'JOIN_RESPONSE',
    success: true,
    mapConfig: this.mapConfig,
    playerId: playerId,
    spawnPosition: player.position,
  });
  
  // Broadcast updated player list to all clients
  this.broadcastPlayerList();
  break;
}
```

### Movement System
Players can move using WASD keys with mouse look for aiming direction.

```typescript
// src/server/GameServer.ts:166-199
case 'PLAYER_INPUT': {
  const p = this.entityManager.getPlayer(playerId);
  if (p) {
    // Don't process input if player is dead or frozen
    if (p.isDead || p.isFrozen) {
      return;
    }

    // Handle mouse look (player faces cursor)
    if (message.mouseTarget) {
      const mousePos = new THREE.Vector3(
        message.mouseTarget.x,
        message.mouseTarget.y,
        message.mouseTarget.z
      );
      const direction = new THREE.Vector3()
        .subVectors(mousePos, p.position)
        .normalize();
      direction.y = 0; // Keep rotation on horizontal plane
      
      if (direction.length() > 0.01) {
        // Calculate rotation angle around Y axis
        const angle = Math.atan2(direction.x, direction.z);
        p.rotation.setFromAxisAngle(new THREE.Vector3(0, 1, 0), angle);
      }
    }

    if (message.direction) {
      // WASD direction-based movement
      p.setMovementDirection(
        new THREE.Vector3(message.direction.x, message.direction.y, message.direction.z)
      );
    }
  }
}
```

### Power-up Collection
Players automatically collect items when they get close enough.

```typescript
// src/server/ServerItem.ts:19-26
public canBeCollectedBy(playerPosition: THREE.Vector3, collectionRadius: number = 1.5): boolean {
  if (this.isCollected) return false;
  
  const distance = this.position.distanceTo(playerPosition);
  return distance <= collectionRadius;
}

public collect(): void {
  this.isCollected = true;
  const config = ITEM_CONFIG[this.type];
  this.respawnAt = Date.now() + config.respawnTime;
}
```

### Scoring Model
Game tracks frags (kills), deaths, and survival time displayed on live HUD.

```typescript
// src/server/ServerPlayer.ts:33-36
public kills: number = 0;
public deaths: number = 0;
public lastPlayerAlive: number = 0;
public aliveStartTime: number = 0;
```

### Session Timer & End Condition
Game ends after 90 seconds or when target score is reached.

```typescript
// src/common/constants.ts:15-24
export const GAME_CONFIG = {
  ROUNDS_TO_WIN: 15,
  FREEZE_TIME_DURATION: 5000, // 5 seconds
  ROUND_END_DURATION: 3000, // 3 seconds
  MIN_PLAYERS_TO_START: 2,
  MATCH_TIMER_DURATION: 90000, // 1:30 (90 seconds) in milliseconds
  TARGET_SCORE_MULTIPLIER: 2,
  GAME_OVER_RETURN_DELAY: 10000, // 10 seconds before returning to lobby
};
```

### Scoreboard & Lobby Transition
After game ends, results screen shows final scores with automatic return to lobby.

```typescript
// src/App.tsx:125-137
useEffect(() => {
  if (!gameState) {
    setResultsOpened(false);
    return;
  }

  if (gameState.gameMode === 'GAME_OVER') {
    console.log('GAME_OVER detected, opening ResultsScreen');
    setResultsOpened(true);
  } else {
    setResultsOpened(false);
  }
}, [gameState]);
```

---

## Controls & Camera

### Keyboard/Mouse Controls (WASD + Mouse Look)
Players use WASD for movement and mouse cursor for aiming/rotation.

```typescript
// src/client/GameClient.ts:166-196
window.addEventListener('keydown', e => {
  const key = e.key.toLowerCase();
  
  // WASD movement (lowercase only)
  if (key === 'w' || key === 'a' || key === 's' || key === 'd') {
    this.handleWASDKeyDown(key);
    return;
  }
  
  // Skills (Q, Space, E, R)
  if (key === 'q') {
    this.entityManager.setSkillTargeting(SkillType.TELEPORT, true);
  } else if (e.code === 'Space') {
    e.preventDefault();
    this.fireHomingMissile();
  } else if (key === 'e') {
    this.fireLaserBeam();
  } else if (key === 'r') {
    this.activateInvincibility();
  }
  
  if (e.key === 'Tab') {
    e.preventDefault();
    this.toggleTabMenu();
  } else if (e.key === 'Escape') {
    e.preventDefault();
    this.toggleSettingsMenu();
  }
});
```

### Configurable Sensitivity Settings
Camera follow speed can be adjusted in settings menu.

```typescript
// src/client/GameClient.ts:76-87
public getCameraSensitivity(): number {
  // Return as percentage (0-100)
  return Math.round(((this.cameraLerpFactor - CAMERA_CONFIG.MIN_LERP_FACTOR) / 
    (CAMERA_CONFIG.MAX_LERP_FACTOR - CAMERA_CONFIG.MIN_LERP_FACTOR)) * 100);
}

public setCameraSensitivity(value: number) {
  // Convert from percentage (0-100) to lerp factor range
  this.cameraLerpFactor = CAMERA_CONFIG.MIN_LERP_FACTOR + 
    (value / 100) * (CAMERA_CONFIG.MAX_LERP_FACTOR - CAMERA_CONFIG.MIN_LERP_FACTOR);
}
```

### Top-Down 3D Camera with Smooth Follow
Camera follows player from above with configurable smooth interpolation.

```typescript
// src/common/constants.ts:131-137
export const CAMERA_CONFIG = {
  DEFAULT_LERP_FACTOR: 0.1, // Default camera follow speed (0.0-1.0)
  MIN_LERP_FACTOR: 0.01, // Minimum camera follow speed
  MAX_LERP_FACTOR: 0.5, // Maximum camera follow speed
  DISTANCE: 15, // Distance from player
};
```

```typescript
// src/core/Renderer.ts:20-28
this.camera = new THREE.PerspectiveCamera(
  60, // Reduced FOV from 75 to 60 for wider view
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);
this.camera.position.set(0, 30, 15); // Increased height from 20 to 30
this.camera.lookAt(0, 0, 0);
```

### Mobile Controls (Optional)
Responsive on-screen joystick and skill buttons for mobile devices.

```typescript
// src/components/MobileControls.tsx:58-89
const updateJoystick = useCallback((clientX: number, clientY: number) => {
  if (!joystickRef.current) return;

  const rect = joystickRef.current.getBoundingClientRect();
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;

  // Calculate raw deltas from touch position to center
  const rawDeltaX = clientX - centerX;
  const rawDeltaY = clientY - centerY;
  const distance = Math.sqrt(rawDeltaX * rawDeltaX + rawDeltaY * rawDeltaY);
  const maxDistance = rect.width / 2 - 30;

  const clampedDistance = Math.min(distance, maxDistance);
  
  // Visual position should match where finger is
  const visualX = distance > 0 ? (rawDeltaX / distance) * clampedDistance : 0;
  const visualY = distance > 0 ? (rawDeltaY / distance) * clampedDistance : 0;

  setJoystickPosition({ x: visualX, y: visualY });

  // Calculate movement direction
  const deltaX = rawDeltaX;
  const deltaY = centerY - clientY;
  const movementDistance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
  
  const normalizedX = movementDistance > 0 ? (deltaX / movementDistance) * (clampedDistance / maxDistance) : 0;
  const normalizedZ = movementDistance > 0 ? (-deltaY / movementDistance) * (clampedDistance / maxDistance) : 0;

  onMove({ x: normalizedX, z: normalizedZ });
}, [onMove]);
```

---

## 3D Presentation (3 pts)

### 3D-Capable Pipeline (Three.js)
Uses Three.js WebGL renderer with real 3D models and camera.

```typescript
// src/core/Renderer.ts:17-46
constructor() {
  this.scene = new THREE.Scene();
  this.scene.background = new THREE.Color(0x1a1a1a);

  this.camera = new THREE.PerspectiveCamera(
    60,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
  );
  this.camera.position.set(0, 30, 15);
  this.camera.lookAt(0, 0, 0);

  this.renderer = new THREE.WebGLRenderer({ 
    antialias: false,
    powerPreference: 'high-performance',
    stencil: false,
    depth: true,
  });
  this.renderer.setSize(window.innerWidth, window.innerHeight);
  this.renderer.shadowMap.enabled = true;
  this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const container = document.getElementById('game-container');
  if (container) {
    container.appendChild(this.renderer.domElement);
  } else {
    document.body.appendChild(this.renderer.domElement);
  }
}
```

### Simple Lighting & Shadows
Ambient and directional lighting with shadow mapping enabled.

```typescript
// src/core/Renderer.ts:47-66
// Lights
const ambientLight = new THREE.AmbientLight(0x404040);
this.scene.add(ambientLight);

this.directionalLight = new THREE.DirectionalLight(0xffffff, 1);
this.directionalLight.position.set(10, 20, 10);
this.directionalLight.castShadow = true;

// Configure shadow camera to cover the entire map area
this.updateShadowCamera(70);

// Shadow map resolution
this.directionalLight.shadow.mapSize.width = 512;
this.directionalLight.shadow.mapSize.height = 512;

// Shadow bias to prevent shadow acne
this.directionalLight.shadow.bias = -0.0001;

this.scene.add(this.directionalLight);
```

### Consistent World Scale
All entities use consistent scale with configurable map boundaries.

```typescript
// src/server/ServerPlayer.ts:72-86
constructor(id: string, startPosition: Vector3, mapLimit: number = 35) {
  this.id = id;
  this.mapLimit = mapLimit;
  this.position = new THREE.Vector3(startPosition.x, startPosition.y, startPosition.z);
  this.rotation = new THREE.Quaternion();

  // Assign random color for bandana
  const hue = Math.random();
  const saturation = 0.8 + Math.random() * 0.2; // 0.8 - 1.0
  const lightness = 0.4 + Math.random() * 0.2; // 0.4 - 0.6
  const color = new THREE.Color().setHSL(hue, saturation, lightness);
  this.color = color.getHex();
}
```

### Minimap / Player Indicator
Real-time minimap showing player positions, walls, and obstacles.

```typescript
// src/components/Minimap.tsx:45-73
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
```

---

## Networking (3 pts)

### Real-time Multiplayer (WebRTC via PeerJS)
Uses PeerJS for peer-to-peer WebRTC connections with low latency.

```typescript
// src/network/NetworkManager.ts:45-58
constructor() {
  this.peer = new Peer();
  this.setupPeerEvents();
}

public hostGame() {
  this._isHost = true;
}

public joinGame(hostId: string) {
  this._isHost = false;
  const conn = this.peer.connect(hostId);
  this.handleConnection(conn);
}
```

### Server-Authoritative State
Host runs server-side game logic, validates all actions, and broadcasts state updates.

```typescript
// src/server/GameServer.ts:9-51
export class GameServer {
  private entityManager: ServerEntityManager;
  private networkManager: NetworkManager;
  private intervalId: number | null = null;
  private mapConfig: MapConfig;

  // Game state
  private gameMode: string = GameMode.WARMUP;
  private currentRound: number = 0;
  private totalRounds: number = GAME_CONFIG.ROUNDS_TO_WIN;
  
  constructor(networkManager: NetworkManager, mapConfig: MapConfig, offlineConfig?: { botCount: number }) {
    this.networkManager = networkManager;
    this.mapConfig = mapConfig;

    // Setup offline mode
    if (offlineConfig) {
      this.isOfflineMode = true;
      this.botCount = offlineConfig.botCount;
    }

    this.entityManager = new ServerEntityManager();
    this.entityManager.loadMap(this.mapConfig);

    this.setupNetworkHandlers();
  }
}
```

### Lobby/Room System
Create/join rooms with visible player list, kick/leave functionality, and session persistence.

```typescript
// src/server/GameServer.ts:104-122
// Add to connected players list
this.connectedPlayers.set(playerId, {
  id: playerId,
  username: player.username,
  isHost,
});

// Send join response
this.networkManager.sendToClient(playerId, {
  type: 'JOIN_RESPONSE',
  success: true,
  mapConfig: this.mapConfig,
  playerId: playerId,
  spawnPosition: player.position,
});

// Broadcast updated player list to all clients
this.broadcastPlayerList();
```

```typescript
// src/server/GameServer.ts:131-151
case 'KICK_PLAYER': {
  // Only host can kick
  if (playerId === this.networkManager.peerId && message.playerId) {
    const kickedId = message.playerId;
    if (kickedId !== this.networkManager.peerId) {
      // Remove player from game
      this.entityManager.removePlayer(kickedId);
      this.connectedPlayers.delete(kickedId);
      
      // Notify kicked player
      this.networkManager.sendToClient(kickedId, {
        type: 'PLAYER_DIED',
        id: kickedId,
      });

      // Broadcast updated player list
      this.broadcastPlayerList();
    }
  }
  break;
}
```

### Server Tick Rate & Client Interpolation
Server runs at 32 Hz tick rate; client renders at 60 FPS with smooth interpolation.

```typescript
// src/common/constants.ts:1-3
export const TICK_RATE = 32;
export const TICK_INTERVAL = 1 / TICK_RATE;
```

```typescript
// src/client/GameClient.ts:89-92
// Network throttling
private lastMovementSendTime: number = 0;
private movementSendInterval: number = TICK_INTERVAL * 1000; // Send at tick rate
```

### Server-Side Validation
Server validates all player actions and rejects illegal moves.

```typescript
// src/server/GameServer.ts:166-172
case 'PLAYER_INPUT': {
  const p = this.entityManager.getPlayer(playerId);
  if (p) {
    // Don't process input if player is dead or frozen
    if (p.isDead || p.isFrozen) {
      return;
    }
    // Process valid input...
  }
}
```

---

## AI + Game (4 pts)

### Single-player Mode (1 pt)

Players can play offline against AI bots with basic competency.

```typescript
// src/server/GameServer.ts:30-45
// Offline/Single-player mode
private isOfflineMode: boolean = false;
private botCount: number = 0;

constructor(networkManager: NetworkManager, mapConfig: MapConfig, offlineConfig?: { botCount: number }) {
  this.networkManager = networkManager;
  this.mapConfig = mapConfig;

  // Setup offline mode
  if (offlineConfig) {
    this.isOfflineMode = true;
    this.botCount = offlineConfig.botCount;
  }

  this.entityManager = new ServerEntityManager();
  this.entityManager.loadMap(this.mapConfig);
}
```

### Items/Power-ups (1 pt)

Four types of collectible power-ups with clear pickup and expiry feedback.

```typescript
// src/common/constants.ts:56-92
// Item Types
export const ItemType = {
  HEALTH_PACK: 'HEALTH_PACK',
  SPEED_BOOST: 'SPEED_BOOST',
  DAMAGE_BOOST: 'DAMAGE_BOOST',
  SHIELD: 'SHIELD',
} as const;

// Item Configuration
export const ITEM_CONFIG = {
  [ItemType.HEALTH_PACK]: {
    healAmount: 50,
    duration: 0, // Instant
    respawnTime: 15000, // 15 seconds
    color: 0x00ff00, // Green
  },
  [ItemType.SPEED_BOOST]: {
    speedMultiplier: 1.5,
    duration: 5000, // 5 seconds
    respawnTime: 20000,
    color: 0x00aaff, // Blue
  },
  [ItemType.DAMAGE_BOOST]: {
    damageMultiplier: 1.5,
    duration: 10000, // 10 seconds
    respawnTime: 25000,
    color: 0xff4400, // Orange-Red
  },
  [ItemType.SHIELD]: {
    blockHits: 2,
    duration: 10000, // 10 seconds or until hit
    respawnTime: 20000,
    color: 0xffff00, // Yellow
  },
};
```

```typescript
// src/server/ServerItem.ts:19-35
public canBeCollectedBy(playerPosition: THREE.Vector3, collectionRadius: number = 1.5): boolean {
  if (this.isCollected) return false;
  
  const distance = this.position.distanceTo(playerPosition);
  return distance <= collectionRadius;
}

public collect(): void {
  this.isCollected = true;
  const config = ITEM_CONFIG[this.type];
  this.respawnAt = Date.now() + config.respawnTime;
}

public shouldRespawn(): boolean {
  return this.isCollected && Date.now() >= this.respawnAt;
}
```

### Multiple Bot Archetypes (2 pts)

Three distinct bot types with unique behaviors, stats, and AI strategies.

#### Bot Factory & Architecture

```typescript
// src/server/bots/BotFactory.ts:10-27
export class BotFactory {
  private static archetypes: Map<BotArchetype, () => BotBrain> = new Map([
    [BotArchetype.AGGRESSIVE, () => new AggressiveBot()],
    [BotArchetype.DEFENSIVE, () => new DefensiveBot()],
    [BotArchetype.BALANCED, () => new BalancedBot()],
  ]);

  static createBrain(archetype: BotArchetype): BotBrain {
    const factory = this.archetypes.get(archetype);
    if (!factory) {
      return new BalancedBot();
    }
    return factory();
  }

  static createRandomBrain(): BotBrain {
    const archetypes = [BotArchetype.AGGRESSIVE, BotArchetype.DEFENSIVE, BotArchetype.BALANCED];
    const randomArchetype = archetypes[Math.floor(Math.random() * archetypes.length)];
    return this.createBrain(randomArchetype);
  }
}
```

#### Bot Configuration

```typescript
// src/common/constants.ts:35-54
// Bot Archetypes
export const BotArchetype = {
  AGGRESSIVE: 'AGGRESSIVE',
  DEFENSIVE: 'DEFENSIVE',
  BALANCED: 'BALANCED',
} as const;

// Bot Configuration
export const BOT_CONFIG = {
  THINK_INTERVAL: 300, // ms between AI decisions
  SKILL_USE_CHANCE: 0.2, // Base chance to use a skill when available
  REACTION_TIME: 200, // ms delay before reacting
  CHASE_DISTANCE: 25, // Distance to start chasing
  FLEE_DISTANCE: 10, // Distance to start fleeing
  ATTACK_RANGE: 15, // Range to attempt attacks
  TELEPORT_ESCAPE_HP_THRESHOLD: 30, // HP threshold to teleport escape
  ITEM_SEARCH_RANGE: 20, // Range to search for items
};
```

#### Aggressive Bot (Light/Fast Chaser)
Prioritizes attacking enemies, uses offensive skills aggressively.

```typescript
// src/server/bots/AggressiveBot.ts:7-66
/**
 * Aggressive Bot - Chases nearest player, uses offensive skills
 * Priority: Attack > Collect > Survive
 */
export class AggressiveBot implements BotBrain {
  think(bot: ServerBot, entityManager: ServerEntityManager): BotAction {
    const players = entityManager.getPlayers();
    const botPos = bot.position.clone();

    // Find nearest alive enemy player
    let nearestEnemy: { id: string; position: THREE.Vector3; distance: number } | null = null;
    let minDistance = Infinity;

    for (const player of players) {
      if (player.id === bot.id || player.isDead) continue;

      const distance = botPos.distanceTo(player.position);
      if (distance < minDistance) {
        minDistance = distance;
        nearestEnemy = { id: player.id, position: player.position.clone(), distance };
      }
    }

    if (!nearestEnemy) {
      return { type: 'IDLE' };
    }

    const now = Date.now();

    // Try to use offensive skills if enemy is in range
    if (nearestEnemy.distance <= BOT_CONFIG.ATTACK_RANGE) {
      // Try Laser Beam first (highest damage, instant)
      if (now >= bot.laserBeamCooldown && Math.random() < BOT_CONFIG.SKILL_USE_CHANCE * 1.5) {
        const direction = new THREE.Vector3()
          .subVectors(nearestEnemy.position, botPos)
          .normalize();
        return {
          type: 'USE_SKILL',
          skillType: SkillType.LASER_BEAM,
          direction,
        };
      }

      // Try Homing Missile
      if (now >= bot.homingMissileCooldown && Math.random() < BOT_CONFIG.SKILL_USE_CHANCE * 1.2) {
        return {
          type: 'USE_SKILL',
          skillType: SkillType.HOMING_MISSILE,
          target: nearestEnemy.position,
        };
      }
    }

    // Use teleport to close distance if far away
    if (nearestEnemy.distance > BOT_CONFIG.CHASE_DISTANCE) {
      if (now >= bot.teleportCooldown && Math.random() < BOT_CONFIG.SKILL_USE_CHANCE) {
        const direction = new THREE.Vector3()
          .subVectors(nearestEnemy.position, botPos)
          .normalize();
        const teleportTarget = botPos.clone().add(direction.multiplyScalar(15));
        return {
          type: 'USE_SKILL',
          skillType: SkillType.TELEPORT,
          target: teleportTarget,
        };
      }
    }
```

#### Defensive Bot (Heavy Slow Bruiser)
Prioritizes survival, keeps distance from enemies, and uses defensive skills.

```typescript
// src/server/bots/DefensiveBot.ts:42-207
/**
 * Defensive Bot - Keeps distance, uses shield, avoids combat
 * Priority: Survive > Collect > Attack
 */
export class DefensiveBot implements BotBrain {
  think(bot: ServerBot, entityManager: ServerEntityManager): BotAction {
    const players = entityManager.getPlayers();
    const botPos = bot.position.clone();
    const now = Date.now();

    // Find nearest alive enemy player
    let nearestEnemy: { id: string; position: THREE.Vector3; distance: number } | null = null;
    let minDistance = Infinity;

    for (const player of players) {
      if (player.id === bot.id || player.isDead) continue;
      const distance = botPos.distanceTo(player.position);
      if (distance < minDistance) {
        minDistance = distance;
        nearestEnemy = { id: player.id, position: player.position.clone(), distance };
      }
    }

    // Low HP - emergency escape
    if (bot.health < BOT_CONFIG.TELEPORT_ESCAPE_HP_THRESHOLD) {
      // Use invincibility first
      if (now >= bot.invincibilityCooldown) {
        return {
          type: 'USE_SKILL',
          skillType: SkillType.INVINCIBILITY,
        };
      }

      // Teleport away from danger
      if (nearestEnemy && now >= bot.teleportCooldown) {
        const awayDirection = new THREE.Vector3()
          .subVectors(botPos, nearestEnemy.position)
          .normalize();
        const escapeTarget = clampTarget(botPos.clone().add(awayDirection.multiplyScalar(20)), botPos);
        return {
          type: 'USE_SKILL',
          skillType: SkillType.TELEPORT,
          target: escapeTarget,
        };
      }
    }

    // Enemy too close - run away
    if (nearestEnemy && nearestEnemy.distance < BOT_CONFIG.FLEE_DISTANCE) {
      const awayDirection = new THREE.Vector3()
        .subVectors(botPos, nearestEnemy.position)
        .normalize();
      
      // Add randomness to avoid predictable paths
      awayDirection.x += (Math.random() - 0.5) * 0.3;
      awayDirection.z += (Math.random() - 0.5) * 0.3;
      awayDirection.normalize();

      const escapeTarget = clampTarget(botPos.clone().add(awayDirection.multiplyScalar(15)), botPos);

      // Use teleport to escape if available
      if (now >= bot.teleportCooldown && Math.random() < 0.5) {
        return {
          type: 'USE_SKILL',
          skillType: SkillType.TELEPORT,
          target: escapeTarget,
        };
      }

      // Run away
      return {
        type: 'MOVE',
        target: escapeTarget,
      };
    }

    // If we have distance, attack opportunistically from safe range
    if (nearestEnemy && nearestEnemy.distance > BOT_CONFIG.FLEE_DISTANCE * 1.5) {
      // Safe distance - fire long-range attack
      if (now >= bot.laserBeamCooldown && Math.random() < BOT_CONFIG.SKILL_USE_CHANCE * 0.5) {
        const direction = new THREE.Vector3()
          .subVectors(nearestEnemy.position, botPos)
          .normalize();
        return {
          type: 'USE_SKILL',
          skillType: SkillType.LASER_BEAM,
          direction,
        };
      }

      if (now >= bot.homingMissileCooldown && Math.random() < BOT_CONFIG.SKILL_USE_CHANCE * 0.3) {
        return {
          type: 'USE_SKILL',
          skillType: SkillType.HOMING_MISSILE,
          target: nearestEnemy.position,
        };
      }
    }

    // Look for defensive items (health, speed boost, shield)
    const desiredItems = [ItemType.HEALTH_PACK, ItemType.SPEED_BOOST, ItemType.SHIELD];
    const items = entityManager.getItems();
    let nearestItem: { position: THREE.Vector3; distance: number } | null = null;
    let nearestItemDist = BOT_CONFIG.ITEM_SEARCH_RANGE;

    for (const item of items) {
      if (item.isCollected) continue;
      if (!desiredItems.includes(item.type)) continue;
      
      // Prioritize health pack if HP is low
      if (item.type !== ItemType.HEALTH_PACK && bot.health < 50) continue;
      
      const dist = botPos.distanceTo(item.position);
      if (dist < nearestItemDist) {
        nearestItemDist = dist;
        nearestItem = { position: item.position.clone(), distance: dist };
      }
    }

    // Collect item if found and safe to do so
    if (nearestItem && (!nearestEnemy || nearestEnemy.distance > BOT_CONFIG.FLEE_DISTANCE)) {
      return {
        type: 'MOVE',
        target: nearestItem.position,
      };
    }

    // No immediate threat - move to center (safer position)
    if (!nearestEnemy || nearestEnemy.distance > BOT_CONFIG.CHASE_DISTANCE) {
      const centerBias = new THREE.Vector3(0, 0, 0);
      const toCenter = new THREE.Vector3().subVectors(centerBias, botPos);
      
      if (toCenter.length() > 5) {
        const target = botPos.clone().add(toCenter.normalize().multiplyScalar(5));
        return { type: 'MOVE', target };
      }
    }

    // Keep distance from nearest enemy
    if (nearestEnemy) {
      const awayDirection = new THREE.Vector3()
        .subVectors(botPos, nearestEnemy.position)
        .normalize();
      const safeTarget = clampTarget(botPos.clone().add(awayDirection.multiplyScalar(10)), botPos);
      
      return { type: 'MOVE', target: safeTarget };
    }

    return { type: 'IDLE' };
  }
}
```

#### Balanced Bot (Mid-range Ranger)
Adaptive bot that switches between aggressive and defensive based on HP level.

```typescript
// src/server/bots/BalancedBot.ts:37-249
/**
 * Balanced Bot - Adapts behavior based on HP and situation
 * HP > 50%: More aggressive
 * HP <= 50%: More defensive
 */
export class BalancedBot implements BotBrain {
  think(bot: ServerBot, entityManager: ServerEntityManager): BotAction {
    const players = entityManager.getPlayers();
    const botPos = bot.position.clone();
    const now = Date.now();

    // Determine behavior mode based on HP
    const hpPercent = (bot.health / bot.maxHealth) * 100;
    const isAggressive = hpPercent > 50;

    // Find nearest alive enemy player
    let nearestEnemy: { id: string; position: THREE.Vector3; distance: number; health: number } | null = null;
    let minDistance = Infinity;

    for (const player of players) {
      if (player.id === bot.id || player.isDead) continue;
      const distance = botPos.distanceTo(player.position);
      if (distance < minDistance) {
        minDistance = distance;
        nearestEnemy = {
          id: player.id,
          position: player.position.clone(),
          distance,
          health: player.health,
        };
      }
    }

    if (!nearestEnemy) {
      return { type: 'IDLE' };
    }

    // Critical HP (< 25%) - emergency mode
    if (hpPercent < 25) {
      // Use invincibility immediately
      if (now >= bot.invincibilityCooldown) {
        return {
          type: 'USE_SKILL',
          skillType: SkillType.INVINCIBILITY,
        };
      }

      // Teleport away from danger
      if (now >= bot.teleportCooldown) {
        const awayDirection = new THREE.Vector3()
          .subVectors(botPos, nearestEnemy.position)
          .normalize();
        const escapeTarget = clampTarget(botPos.clone().add(awayDirection.multiplyScalar(20)), botPos);
        return {
          type: 'USE_SKILL',
          skillType: SkillType.TELEPORT,
          target: escapeTarget,
        };
      }

      // Run away
      const awayDirection = new THREE.Vector3()
        .subVectors(botPos, nearestEnemy.position)
        .normalize();
      return {
        type: 'MOVE',
        target: clampTarget(botPos.clone().add(awayDirection.multiplyScalar(15)), botPos),
      };
    }

    // Aggressive mode (HP > 50%)
    if (isAggressive) {
      // Enemy in attack range
      if (nearestEnemy.distance <= BOT_CONFIG.ATTACK_RANGE) {
        // Use offensive skills
        if (now >= bot.laserBeamCooldown && Math.random() < BOT_CONFIG.SKILL_USE_CHANCE) {
          const direction = new THREE.Vector3()
            .subVectors(nearestEnemy.position, botPos)
            .normalize();
          return {
            type: 'USE_SKILL',
            skillType: SkillType.LASER_BEAM,
            direction,
          };
        }

        if (now >= bot.homingMissileCooldown && Math.random() < BOT_CONFIG.SKILL_USE_CHANCE) {
          return {
            type: 'USE_SKILL',
            skillType: SkillType.HOMING_MISSILE,
            target: nearestEnemy.position,
          };
        }
      }

      // Chase enemy
      if (nearestEnemy.distance > 5) {
        // Use teleport to close gap sometimes
        if (nearestEnemy.distance > 15 && now >= bot.teleportCooldown && Math.random() < 0.3) {
          const direction = new THREE.Vector3()
            .subVectors(nearestEnemy.position, botPos)
            .normalize();
          const teleportTarget = botPos.clone().add(direction.multiplyScalar(12));
          return {
            type: 'USE_SKILL',
            skillType: SkillType.TELEPORT,
            target: teleportTarget,
          };
        }

        return { type: 'MOVE', target: nearestEnemy.position };
      }
    } else {
      // Defensive mode (HP <= 50%)
      
      // Use invincibility if enemy is close
      if (nearestEnemy.distance < BOT_CONFIG.FLEE_DISTANCE && now >= bot.invincibilityCooldown) {
        return {
          type: 'USE_SKILL',
          skillType: SkillType.INVINCIBILITY,
        };
      }

      // Keep distance but still attack from afar (kiting strategy)
      if (nearestEnemy.distance < BOT_CONFIG.FLEE_DISTANCE * 1.5) {
        // Shoot while retreating
        if (now >= bot.laserBeamCooldown && Math.random() < BOT_CONFIG.SKILL_USE_CHANCE * 0.7) {
          const direction = new THREE.Vector3()
            .subVectors(nearestEnemy.position, botPos)
            .normalize();
          return {
            type: 'USE_SKILL',
            skillType: SkillType.LASER_BEAM,
            direction,
          };
        }

        // Move away while engaging
        const awayDirection = new THREE.Vector3()
          .subVectors(botPos, nearestEnemy.position)
          .normalize();
        return {
          type: 'MOVE',
          target: clampTarget(botPos.clone().add(awayDirection.multiplyScalar(10)), botPos),
        };
      }

      // Safe distance - take pot shots
      if (now >= bot.homingMissileCooldown && Math.random() < BOT_CONFIG.SKILL_USE_CHANCE * 0.5) {
        return {
          type: 'USE_SKILL',
          skillType: SkillType.HOMING_MISSILE,
          target: nearestEnemy.position,
        };
      }
    }

    // Look for items based on current mode
    const desiredItems = isAggressive 
      ? [ItemType.SPEED_BOOST, ItemType.DAMAGE_BOOST]  // Offensive items
      : [ItemType.HEALTH_PACK, ItemType.SPEED_BOOST, ItemType.SHIELD];  // Defensive items
    
    const items = entityManager.getItems();
    let nearestItem: { position: THREE.Vector3; distance: number } | null = null;
    let nearestItemDist = BOT_CONFIG.ITEM_SEARCH_RANGE;

    for (const item of items) {
      if (item.isCollected) continue;
      if (!desiredItems.includes(item.type)) continue;
      
      const dist = botPos.distanceTo(item.position);
      if (dist < nearestItemDist) {
        nearestItemDist = dist;
        nearestItem = { position: item.position.clone(), distance: dist };
      }
    }

    // Collect item if safe to do so
    const safeDistance = isAggressive ? 8 : BOT_CONFIG.FLEE_DISTANCE;
    if (nearestItem && (!nearestEnemy || nearestEnemy.distance > safeDistance)) {
      return { type: 'MOVE', target: nearestItem.position };
    }

    // Default: maintain optimal distance based on mode
    const optimalDistance = isAggressive ? 8 : 15;
    if (nearestEnemy.distance < optimalDistance) {
      const awayDirection = new THREE.Vector3()
        .subVectors(botPos, nearestEnemy.position)
        .normalize();
      return {
        type: 'MOVE',
        target: clampTarget(botPos.clone().add(awayDirection.multiplyScalar(5)), botPos),
      };
    } else if (nearestEnemy.distance > optimalDistance + 5) {
      return { type: 'MOVE', target: nearestEnemy.position };
    }

    return { type: 'IDLE' };
  }
}
```

---

## Technology Stack

### Frontend
- **React 19** with TypeScript
- **Three.js** for 3D rendering
- **Mantine UI** for components
- **Vite** for build tooling

```json
// package.json:41-53
"dependencies": {
  "@mantine/core": "^8.3.9",
  "@mantine/hooks": "^8.3.9",
  "@mantine/notifications": "^8.3.9",
  "peerjs": "^1.5.5",
  "postcss": "^8.5.6",
  "postcss-preset-mantine": "^1.18.0",
  "postcss-simple-vars": "^7.0.1",
  "react": "^19.0.0",
  "react-dom": "^19.0.0",
  "three": "^0.181.2",
  "uuid": "^13.0.0"
}
```

### Networking
- **PeerJS** for WebRTC peer-to-peer connections

```typescript
// src/network/NetworkManager.ts:1-4
import Peer from 'peerjs';
import type { DataConnection } from 'peerjs';
import type { NetworkMessage } from '../common/messages';
```

### Development
- **TypeScript 5.9** for type safety
- **ESLint** for code quality
- **Prettier** for code formatting

```json
// package.json:20-39
"devDependencies": {
  "@types/peerjs": "^0.0.30",
  "@types/react": "^19.0.1",
  "@types/react-dom": "^19.0.1",
  "@types/three": "^0.181.0",
  "@typescript-eslint/eslint-plugin": "^7.3.1",
  "@typescript-eslint/parser": "^7.3.1",
  "eslint": "^8.57.0",
  "prettier": "^3.2.5",
  "typescript": "~5.9.3",
  "vite": "^7.2.4"
}
```

---

## Project Structure

```
A5/
├── src/
│   ├── client/          # Client-side rendering & effects
│   │   ├── GameClient.ts
│   │   ├── ClientEntityManager.ts
│   │   ├── AudioManager.ts
│   │   └── effects/     # Visual effects
│   ├── server/          # Server-side game logic
│   │   ├── GameServer.ts
│   │   ├── ServerEntityManager.ts
│   │   ├── ServerPlayer.ts
│   │   ├── ServerBot.ts
│   │   ├── ServerItem.ts
│   │   └── bots/        # AI implementations
│   ├── network/         # Networking layer
│   │   └── NetworkManager.ts
│   ├── core/            # Core systems
│   │   ├── Renderer.ts
│   │   ├── InputManager.ts
│   │   ├── UIManager.ts
│   │   └── MapLoader.ts
│   ├── common/          # Shared types & constants
│   │   ├── constants.ts
│   │   ├── types.ts
│   │   └── messages.ts
│   ├── components/      # React UI components
│   │   ├── Menu.tsx
│   │   ├── HUD.tsx
│   │   ├── Scoreboard.tsx
│   │   ├── Settings.tsx
│   │   ├── Minimap.tsx
│   │   └── MobileControls.tsx
│   ├── App.tsx          # Main application
│   └── main.tsx         # Entry point
├── public/              # Static assets
├── package.json
├── tsconfig.json
└── vite.config.ts
```

---

## Key Features Summary

### ✅ Core Loop
- Shared arena spawning
- Real-time movement with WASD + mouse look
- Power-up collection system
- Scoring with kills, deaths, and survival time
- Timed match sessions (90 seconds)
- End-of-session scoreboard
- Lobby transition

### ✅ Controls & Camera
- WASD + mouse look controls
- Configurable camera sensitivity
- Top-down 3D perspective
- Smooth camera follow with interpolation
- Mobile-responsive touch controls
- On-screen joystick and action buttons

### ✅ 3D Presentation (3 pts)
- Three.js WebGL rendering pipeline
- PerspectiveCamera with 3D scene
- Ambient and directional lighting
- Real-time shadow mapping
- Consistent world scale (±35 units)
- Real-time minimap with player indicators

### ✅ Networking (3 pts)
- WebRTC via PeerJS for low-latency P2P
- Server-authoritative game state
- Lobby/room system with player management
- Kick/leave functionality
- 32 Hz server tick rate
- 60 FPS client rendering with interpolation
- Server-side input validation

### ✅ AI + Game (4 pts)
- **Single-player mode** (1 pt): Offline play with AI bots
- **Items/Power-ups** (1 pt): 4 types with clear feedback
  - Health Pack (instant heal)
  - Speed Boost (temporary movement speed)
  - Damage Boost (increased attack power)
  - Shield (block incoming hits)
- **Multiple Bot Archetypes** (2 pts):
  - Aggressive Bot: Light/fast chaser with offensive skills
  - Defensive Bot: Heavy/slow bruiser focused on survival
  - Balanced Bot: Mid-range tactical player

---

## Running the Project

### Development
```bash
pnpm install
pnpm dev
```

### Production Build
```bash
pnpm build
```

### Linting & Formatting
```bash
pnpm lint
pnpm format
```

---

## Controls

| Action | Control |
|--------|---------|
| Move | **WASD** keys |
| Look/Aim | **Mouse cursor** |
| Basic Attack | **Left-click** |
| Teleport | **Q** |
| Homing Missile | **Space** |
| Laser Beam | **E** |
| Invincibility | **R** |
| Scoreboard | **Tab** |
| Settings | **Esc** |

---

## Connection & Disconnection Handling

### Overview
The game implements graceful handling for player connections and disconnections, providing clear feedback to all players about lobby state changes.

### Player Join Notifications

When a new player joins the game, all existing players receive a notification.

**Implementation:**

```typescript
// src/server/GameServer.ts:132-141
// Notify all OTHER players about the new player joining (don't notify the joining player)
const otherPlayers = Array.from(this.connectedPlayers.keys()).filter(id => id !== playerId);
otherPlayers.forEach(otherPlayerId => {
  this.networkManager.sendToClient(otherPlayerId, {
    type: 'PLAYER_JOINED_NOTIFICATION',
    playerId: playerId,
    username: player.username
  });
});
```

```typescript
// src/App.tsx:139-151
const handlePlayerJoinedNotification = (e: CustomEvent<{ playerId: string; username?: string }>) => {
  const { username } = e.detail;
  const displayName = username || 'A player';
  
  // Show toast notification when a player joins
  notifications.show({
    title: 'Player Joined',
    message: `${displayName} has joined the game`,
    color: 'green',
    autoClose: 5000,
  });
};
```

**User Experience:**
- **Notification Type:** Toast notification
- **Color:** Green (positive event)
- **Message:** "[Player Name] has joined the game"
- **Duration:** 5 seconds auto-close

### Host Disconnection Handling

When the host leaves or disconnects, all clients are immediately notified and returned to the main menu.

**Implementation:**

```typescript
// src/client/GameClient.ts:124-133
// Handle player disconnections (including host)
window.addEventListener('player-disconnected', () => {
  // If we're not the host and the disconnected player is the host, notify user
  if (!this.networkManager.isHost) {
    // Dispatch a custom event that App.tsx can listen to
    window.dispatchEvent(new CustomEvent('host-disconnected'));
  }
});
```

```typescript
// src/App.tsx:97-125
const handleHostDisconnected = () => {
  // Host disconnected - kick all clients back to menu
  if (gameClient) {
    gameClient.stop();
  }
  
  setGameStarted(false);
  setSettingsOpened(false);
  setResultsOpened(false);
  setGameState(null);
  setLocalPlayerId(null);

  // Clear query string from URL
  const newUrl = window.location.pathname;
  window.history.replaceState({ path: newUrl }, '', newUrl);

  // Show notification
  notifications.show({
    title: 'Host Disconnected',
    message: 'The host has disconnected. The game is no longer available.',
    color: 'red',
    autoClose: false,
  });

  // Reload after a short delay
  setTimeout(() => {
    window.location.reload();
  }, 3000);
};
```

**User Experience:**
- **Notification Type:** Modal-style (doesn't auto-close)
- **Color:** Red (critical issue)
- **Message:** "The host has disconnected. The game is no longer available."
- **Action:** Automatic page reload after 3 seconds

### Non-Host Player Disconnection

When a regular player leaves, all remaining players are notified but the game continues.

**Implementation:**

```typescript
// src/server/GameServer.ts:72-91
window.addEventListener('player-disconnected', (e: CustomEvent<string>) => {
  if (!this.networkManager.isHost) return;
  const disconnectedId = e.detail;
  
  // Get player info before removing
  const playerInfo = this.connectedPlayers.get(disconnectedId);
  
  // Remove player from game
  this.entityManager.removePlayer(disconnectedId);
  this.connectedPlayers.delete(disconnectedId);
  
  // Notify all remaining players about the disconnection
  this.networkManager.broadcast({ 
    type: 'PLAYER_DISCONNECTED_NOTIFICATION',
    playerId: disconnectedId,
    username: playerInfo?.username
  });
  
  this.broadcastPlayerList();
});
```

```typescript
// src/App.tsx:127-138
const handlePlayerDisconnectedNotification = (e: CustomEvent<{ playerId: string; username?: string }>) => {
  const { username } = e.detail;
  const displayName = username || 'A player';
  
  // Show toast notification during gameplay
  notifications.show({
    title: 'Player Disconnected',
    message: `${displayName} has disconnected from the game`,
    color: 'orange',
    autoClose: 5000,
  });
};
```

**User Experience:**
- **Notification Type:** Toast notification
- **Color:** Orange (warning)
- **Message:** "[Player Name] has disconnected from the game"
- **Duration:** 5 seconds auto-close
- **Impact:** Game continues for remaining players

### Waiting Message for Non-Host Players

Non-host players in warmup mode see a message indicating they're waiting for the host to start.

**Implementation:**

```typescript
// src/components/GameModeDisplay.tsx:168-174
{/* Show waiting message for non-host players in warmup */}
{!isHost && gameState.gameMode === GameMode.WARMUP && (
  <Text size="sm" c="dimmed" ta="center" style={{ fontStyle: 'italic' }}>
    Waiting for host to start the game...
  </Text>
)}
```

**User Experience:**
- Displays below the "Warmup" text
- Only visible to non-host players
- Dimmed, italic styling
- Disappears once game starts

### Message Types

```typescript
// src/common/messages.ts:104-118
export interface HostDisconnectedMessage extends BaseMessage {
  type: 'HOST_DISCONNECTED';
}

export interface PlayerDisconnectedNotificationMessage extends BaseMessage {
  type: 'PLAYER_DISCONNECTED_NOTIFICATION';
  playerId: string;
  username?: string;
}

export interface PlayerJoinedNotificationMessage extends BaseMessage {
  type: 'PLAYER_JOINED_NOTIFICATION';
  playerId: string;
  username?: string;
}
```

### Event Flow

#### Player Join:
1. New player sends `JOIN_REQUEST` to server
2. GameServer adds player to the game
3. GameServer sends `JOIN_RESPONSE` to the new player
4. GameServer sends `PLAYER_JOINED_NOTIFICATION` to all OTHER existing players
5. All existing clients receive the message
6. GameClient dispatches `player-joined-notification` event
7. App.tsx shows green toast notification to existing players

#### Host Disconnection:
1. Host closes connection/leaves
2. PeerJS fires `close` event on client connections
3. NetworkManager dispatches `player-disconnected` event
4. GameClient detects it's not the host and dispatches `host-disconnected` event
5. App.tsx shows red notification and reloads page

#### Non-Host Disconnection:
1. Player closes connection/leaves
2. PeerJS fires `close` event on host
3. NetworkManager dispatches `player-disconnected` event
4. GameServer retrieves player info and broadcasts `PLAYER_DISCONNECTED_NOTIFICATION`
5. All clients receive the message
6. GameClient dispatches `player-disconnected-notification` event
7. App.tsx shows orange toast notification

### Error Handling

```typescript
// src/network/NetworkManager.ts:80-84
conn.on('error', (err) => {
  console.error('Connection error:', err);
  this.connections = this.connections.filter(c => c !== conn);
  window.dispatchEvent(new CustomEvent('player-disconnected', { detail: conn.peer }));
});
```

- Connection errors are caught and treated as disconnections
- All disconnection paths properly clean up resources
- Player state is removed from server before broadcasting notifications

---

## Multiplayer Game Flow & Stage Progression

### Overview

The game implements a structured stage progression system for both single-player and multiplayer modes, ensuring consistent gameplay flow and proper synchronization between host and clients.

### Problem Statement

**Original Issue:** In multiplayer mode, when a host created a game and players joined, the game remained stuck in the WARMUP stage indefinitely. The START GAME button was only accessible through the scoreboard (Tab key), which was not intuitive. Additionally, the multiplayer flow did not follow the same stage progression as single-player mode (WARMUP → WARMUP_COUNTDOWN → FREEZE_TIME → ROUND).

**Expected Behavior:** 
1. Host creates game → enters WARMUP stage
2. START GAME button visible and accessible in the game UI
3. Button disabled when < 2 players (with tooltip explanation)
4. Button enabled when ≥ 2 players
5. Clicking START GAME triggers the same progression as single-player:
   - **WARMUP_COUNTDOWN** (10s) - players can move freely, no scoring
   - **FREEZE_TIME** (5s) - players frozen at spawn points
   - **ROUND** (90s) - actual match with scoring

### Solution Architecture

The fix involved moving the START GAME button from the pre-game lobby to the in-game UI, making it accessible during the WARMUP stage while players are already in the game world.

#### Key Components Modified

1. **GameModeDisplay Component** (`src/components/GameModeDisplay.tsx`)
   - Added `isHost` and `onStartGame` props
   - Displays START GAME button during WARMUP mode
   - Shows different UI for host vs non-host players

2. **App Component** (`src/App.tsx`)
   - Passes `isHost` and `onStartGame` handler to GameModeDisplay
   - Handles START_GAME message sending

3. **LobbyControls Component** (`src/components/LobbyControls.tsx`)
   - Originally attempted to add button here (pre-game lobby)
   - Kept for reference but button moved to in-game UI

### Implementation Details

#### 1. GameModeDisplay - Button Logic

```typescript
// src/components/GameModeDisplay.tsx:14-30
export default function GameModeDisplay({ gameState, visible, isHost, onStartGame }: GameModeDisplayProps) {
  if (!gameState || !visible) {
    return null;
  }

  let modeText = '';
  const playerCount = gameState.players.length;
  const canStartGame = isHost && playerCount >= 2;
  const showStartButton = isHost && gameState.gameMode === GameMode.WARMUP;

  // ... mode text logic ...
}
```

**Logic Breakdown:**
- `playerCount`: Tracks current number of players in game
- `canStartGame`: Button enabled only when host AND ≥2 players
- `showStartButton`: Button visible only for host during WARMUP mode

#### 2. GameModeDisplay - UI Rendering

```typescript
// src/components/GameModeDisplay.tsx:144-175
return (
  <Paper className={styles.gameModeDisplay} p="md" withBorder>
    <Stack gap="md" align="center">
      <Text size="xl" fw={700} ta="center">
        {modeText}
      </Text>
      
      {/* Show "Start Game" button for host in warmup */}
      {showStartButton && onStartGame && (
        <Tooltip
          label={canStartGame ? "Start the game" : `Need at least 2 players to start (${playerCount}/2)`}
          position="bottom"
        >
          <Button
            color="green"
            variant="filled"
            size="lg"
            leftSection={<Icon icon="tabler:player-play" style={{ fontSize: '20px' }} />}
            onClick={onStartGame}
            disabled={!canStartGame}
          >
            Start Game
          </Button>
        </Tooltip>
      )}
      
      {/* Show waiting message for non-host players in warmup */}
      {!isHost && gameState.gameMode === GameMode.WARMUP && (
        <Text size="sm" c="dimmed" ta="center" style={{ fontStyle: 'italic' }}>
          Waiting for host to start the game...
        </Text>
      )}
    </Stack>
  </Paper>
);
```

**UI Features:**
- **Host View (WARMUP)**: Shows START GAME button with dynamic tooltip
  - Disabled: "Need at least 2 players to start (1/2)"
  - Enabled: "Start the game"
- **Non-Host View (WARMUP)**: Shows waiting message
- **All Players (Other Modes)**: Shows only mode text

#### 3. App Component - Event Handling

```typescript
// src/App.tsx:139-145
const handleStartGame = () => {
  if (gameClient && networkManager.isHost) {
    networkManager.sendToHost({
      type: 'START_GAME',
    });
  }
};
```

```typescript
// src/App.tsx:163
{gameStarted && <GameModeDisplay gameState={gameState} visible={gameStarted} isHost={networkManager.isHost} onStartGame={handleStartGame} />}
```

**Flow:**
1. User clicks START GAME button
2. `handleStartGame` called
3. Sends `START_GAME` message to server (host)
4. Server processes message and transitions game stages

### Game Stage Progression

#### Stage Definitions

```typescript
// src/common/constants.ts:5-12
export const GameMode = {
  WARMUP: 'WARMUP',
  WARMUP_COUNTDOWN: 'WARMUP_COUNTDOWN',
  ROUND: 'ROUND',
  FREEZE_TIME: 'FREEZE_TIME',
  ROUND_END: 'ROUND_END',
  GAME_OVER: 'GAME_OVER',
} as const;
```

#### Stage Durations

```typescript
// src/common/constants.ts:17-23
export const GAME_CONFIG = {
  WARMUP_COUNTDOWN_DURATION: 10000, // 10 seconds
  FREEZE_TIME_DURATION: 5000, // 5 seconds
  MATCH_TIMER_DURATION: 90000, // 90 seconds
  MIN_PLAYERS_TO_START: 2,
  TARGET_SCORE_MULTIPLIER: 2,
};
```

#### Complete Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│ MULTIPLAYER GAME FLOW                                       │
└─────────────────────────────────────────────────────────────┘

1. HOST CREATES GAME
   ↓
   [WARMUP Stage]
   - Players can join
   - Players can move freely
   - No scoring
   - START GAME button visible (disabled if < 2 players)
   
2. PLAYER JOINS
   ↓
   [WARMUP Stage - Updated]
   - START GAME button enabled (≥ 2 players)
   - Host can click to start
   
3. HOST CLICKS START GAME
   ↓
   [WARMUP_COUNTDOWN Stage - 10 seconds]
   - Display: "Game Starting in 10s..."
   - Players can move freely
   - No scoring yet
   - Countdown visible to all
   
4. COUNTDOWN EXPIRES
   ↓
   [FREEZE_TIME Stage - 5 seconds]
   - Display: "Freeze Time (5s)"
   - Players frozen at spawn points
   - Players reset (health, position, stats)
   - All players respawned at assigned spawn points
   
5. FREEZE TIME EXPIRES
   ↓
   [ROUND Stage - 90 seconds]
   - Display: Match timer "1:30"
   - Players unfrozen
   - Scoring enabled (kills/deaths tracked)
   - Match timer counts down
   - Game ends when:
     * Timer reaches 0:00, OR
     * Player reaches target score (playerCount × 2)
   
6. MATCH ENDS
   ↓
   [GAME_OVER Stage]
   - Display winner
   - Show final scores
   - Results screen appears
   - Auto-return to lobby after 10 seconds
```

#### Server-Side Stage Transitions

```typescript
// src/server/GameServer.ts:346-367
private updateGameState() {
  const now = Date.now();

  // Handle warmup countdown transition
  if (this.gameMode === GameMode.WARMUP_COUNTDOWN && now > this.warmupEndTime) {
    this.startFreezeTime();
  }

  // Handle freeze time transition
  if (this.gameMode === GameMode.FREEZE_TIME && now > this.freezeTimeEnd) {
    this.gameMode = GameMode.ROUND;
    this.matchStartTime = now;
    
    // Set match end time if using timer mode
    if (this.useTimerMode) {
      this.matchEndTime = this.matchStartTime + GAME_CONFIG.MATCH_TIMER_DURATION;
    }
    
    // Enable player movement after freeze time
    this.entityManager.getPlayers().forEach(player => {
      player.isFrozen = false;
      player.kills = 0; // Reset kills for the match
      player.deaths = 0; // Reset deaths for the match
    });
  }
}
```

#### Freeze Time Implementation

```typescript
// src/server/GameServer.ts:426-446
private startFreezeTime() {
  this.gameMode = GameMode.FREEZE_TIME;
  this.freezeTimeEnd = Date.now() + GAME_CONFIG.FREEZE_TIME_DURATION;

  // Reset all players and respawn them at their assigned spawn points
  this.entityManager.getPlayers().forEach(player => {
    player.reset();
    player.isFrozen = true; // Freeze players during freeze time
    player.aliveStartTime = Date.now(); // Start tracking alive time

    // Respawn player at their assigned spawn point
    const spawnIndex = this.entityManager.getSpawnPointForPlayer(player.id);
    if (spawnIndex !== -1) {
      const spawnPos = this.entityManager.getSpawnPosition(spawnIndex);
      if (spawnPos) {
        player.position.set(spawnPos.x, 0, spawnPos.y);
      }
    }
  });
}
```

### Single-Player vs Multiplayer Comparison

#### Single-Player Flow

```typescript
// src/components/Menu.tsx:257-281
const handleStartSinglePlayer = async (botCount: number) => {
  networkManager.hostGame();
  setIsHosting(true);

  const mapConfig = await MapLoader.loadMap('/maps/default_map.json');
  const server = new GameServer(networkManager, mapConfig, { botCount });
  server.start();

  // Set warmup end time (10 seconds from now)
  server.setWarmupEndTime(Date.now() + 10000);
  
  // Wait 10 seconds warmup, then start game
  setTimeout(() => {
    server.startGame(true);
  }, 10000); // 10 seconds warmup

  gameClient.joinGame(networkManager.peerId);
};
```

**Single-Player Characteristics:**
- Auto-starts after 10-second warmup
- No manual START GAME button needed
- Minimum 1 player (human + bots)
- Immediate progression to WARMUP_COUNTDOWN

#### Multiplayer Flow

```typescript
// src/server/GameServer.ts:448-480
public startGame(useTimer: boolean = false) {
  // In offline mode, allow starting with just 1 human player + bots
  const minPlayers = this.isOfflineMode ? 1 : GAME_CONFIG.MIN_PLAYERS_TO_START;
  const totalPlayers = this.entityManager.getPlayers().length;
  
  if (this.gameMode !== GameMode.WARMUP || totalPlayers < minPlayers) {
    return false;
  }

  // Start with warmup countdown (10 seconds)
  this.gameMode = GameMode.WARMUP_COUNTDOWN;
  this.warmupEndTime = Date.now() + GAME_CONFIG.WARMUP_COUNTDOWN_DURATION;
  this.useTimerMode = useTimer;
  this.currentRound = 1;
  this.playerRespawnEnabled = true;
  
  // Calculate target score based on player count
  this.targetScore = totalPlayers * GAME_CONFIG.TARGET_SCORE_MULTIPLIER;

  // Reset all player stats when game starts
  this.entityManager.getPlayers().forEach(player => {
    player.kills = 0;
    player.deaths = 0;
    player.lastPlayerAlive = 0;
    player.isFrozen = false; // Allow movement during countdown
  });

  return true;
}
```

**Multiplayer Characteristics:**
- Manual START GAME button required
- Minimum 2 players (human players)
- Host controls game start
- Same stage progression as single-player after start

### User Experience Improvements

#### Host Experience
1. **Clear Visual Feedback**
   - Green START GAME button prominently displayed
   - Button state changes based on player count
   - Tooltip provides context

2. **Player Count Awareness**
   - Real-time player count in tooltip
   - Button disabled until minimum players met
   - Clear indication of requirement (2/2)

3. **Smooth Transitions**
   - Countdown visible to all players
   - Freeze time prevents early combat
   - Synchronized start for fair gameplay

#### Non-Host Experience
1. **Status Visibility**
   - "Waiting for host to start the game..." message
   - No confusing buttons or options
   - Clear indication of waiting state

2. **Synchronized Experience**
   - All players see same countdown
   - All players frozen simultaneously
   - All players start match together

### Testing Scenarios

#### Scenario 1: Solo Host (< 2 Players)
```
1. Host creates game
2. Enters WARMUP stage
3. START GAME button visible but DISABLED
4. Tooltip: "Need at least 2 players to start (1/2)"
5. Button cannot be clicked
```

#### Scenario 2: Host + 1 Player (≥ 2 Players)
```
1. Host creates game (1/2)
2. Player joins (2/2)
3. START GAME button ENABLED
4. Tooltip: "Start the game"
5. Host clicks button
6. WARMUP_COUNTDOWN starts (10s)
7. FREEZE_TIME (5s)
8. ROUND starts (90s)
```

#### Scenario 3: Player Disconnects During Warmup
```
1. Host + Player in WARMUP (2/2)
2. Player disconnects
3. Button becomes DISABLED (1/2)
4. Tooltip updates: "Need at least 2 players to start (1/2)"
5. Host must wait for another player
```

### Code Quality & Maintainability

#### Type Safety
All components use TypeScript with strict typing:

```typescript
interface GameModeDisplayProps {
  gameState: GameState | null;
  visible: boolean;
  isHost?: boolean;
  onStartGame?: () => void;
}
```

#### Separation of Concerns
- **UI Logic**: GameModeDisplay handles button rendering
- **Event Handling**: App component manages callbacks
- **Game Logic**: GameServer handles stage transitions
- **Network**: NetworkManager sends messages

#### Reusability
The START GAME button logic is:
- Self-contained in GameModeDisplay
- Configurable via props
- Reusable for different game modes
- Easy to extend or modify

---

## Assignment Checklist

### Core Loop (Required)
- ✅ Spawn into shared arena
- ✅ Movement system (WASD + mouse look)
- ✅ Power-up collection
- ✅ Player interactions (combat)
- ✅ Scoring model (kills/deaths/survival)
- ✅ Live HUD with scores
- ✅ Session timer (90 seconds)
- ✅ End-of-session scoreboard
- ✅ Lobby transition

### Controls & Camera (Required)
- ✅ Keyboard/mouse controls (WASD + mouse look)
- ✅ Configurable sensitivity
- ✅ Top-down 3D camera
- ✅ Arena bounds clamping
- ✅ Smooth camera follow
- ✅ Mobile controls (optional)

### 3D Presentation (3 pts)
- ✅ 3D-capable pipeline (Three.js WebGL)
- ✅ Simple lighting & shadows
- ✅ Consistent world scale
- ✅ Minimap with player indicators

### Networking (3 pts)
- ✅ Real-time multiplayer (WebRTC/PeerJS)
- ✅ Server-authoritative state
- ✅ Lobby/room system
- ✅ Create/join rooms
- ✅ Player list visibility
- ✅ Kick/leave functionality
- ✅ Session persistence
- ✅ Server tick ~32 Hz
- ✅ Client render 60 FPS with interpolation
- ✅ Server-side validation

### AI + Game (4 pts)
- ✅ Single-player mode (1 pt)
- ✅ Items/power-ups (1 pt) - 4 types
- ✅ Multiple bot archetypes (2 pts) - 3 distinct types

**Total: 10 points**

---

## Notes

- All code is written in TypeScript with strict typing
- Client-server architecture with clear separation
- Modular design with reusable components
- Performance optimizations (shadow map size, antialias, tick rate)
- Mobile-responsive UI with touch controls
- Audio system with background music and sound effects

---

## License

Creative Commons Attribution-NonCommercial 4.0 International License (CC BY-NC 4.0)
