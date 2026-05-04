import * as THREE from 'three';
import { ServerPlayer } from './ServerPlayer';
import { ServerBot } from './ServerBot';
import { ServerMissile } from './ServerMissile';
import { ServerLaserBeam } from './ServerLaserBeam';
import { ServerItem } from './ServerItem';
import type { MapConfig } from '../common/types';
import { SKILL_CONFIG, SkillType, BotArchetype, ItemType, GameMode } from '../common/constants';

export class ServerEntityManager {
  public players: Map<string, ServerPlayer> = new Map();
  public bots: Map<string, ServerBot> = new Map();
  public missiles: ServerMissile[] = [];
  public laserBeams: ServerLaserBeam[] = [];
  public items: Map<string, ServerItem> = new Map();
  public obstacles: THREE.Box3[] = [];
  public spawnPositions: THREE.Vector2[] = [];
  private claimedSpawnPoints: Map<string, number> = new Map();
  private mapLimit: number = 35; // Default value, will be set from JSON
  private botIdCounter: number = 0;
  private itemIdCounter: number = 0;
  private itemSpawnPositions: THREE.Vector3[] = [];

  constructor() {}

  public loadMap(config: MapConfig) {
    this.obstacles = [];

    // Store map limit from playableArea.size (half size because it's centered at 0,0)
    this.mapLimit = config.playableArea.size / 2;

    // Walls
    config.walls.forEach(wall => {
      const pos = new THREE.Vector3(wall.position.x, wall.position.y, wall.position.z);
      const size = new THREE.Vector3(
        wall.dimensions.width,
        wall.dimensions.height,
        wall.dimensions.depth
      );
      const box = new THREE.Box3().setFromCenterAndSize(pos, size);
      this.obstacles.push(box);
    });

    // Boxes
    config.boxes.forEach(box => {
      const pos = new THREE.Vector3(box.position.x, box.position.y, box.position.z);
      const size = new THREE.Vector3(
        box.dimensions.width,
        box.dimensions.height,
        box.dimensions.depth
      );
      const box3 = new THREE.Box3().setFromCenterAndSize(pos, size);
      this.obstacles.push(box3);
    });

    // Spawn Points
    // Map JSON (x, y) to World (x, z)
    this.spawnPositions = config.spawnPoints.map(sp => new THREE.Vector2(sp.x, sp.y));

    // Shuffle spawn points
    for (let i = this.spawnPositions.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.spawnPositions[i], this.spawnPositions[j]] = [
        this.spawnPositions[j],
        this.spawnPositions[i],
      ];
    }

    // Generate item spawn positions (distributed across the map)
    this.generateItemSpawnPositions();

    // Spawn initial items
    this.spawnInitialItems();
  }

  /**
   * Generate positions where items can spawn
   */
  private generateItemSpawnPositions(): void {
    this.itemSpawnPositions = [];
    const gridSize = 12; // Space between potential spawn points
    const margin = 5; // Distance from map edge

    for (let x = -this.mapLimit + margin; x <= this.mapLimit - margin; x += gridSize) {
      for (let z = -this.mapLimit + margin; z <= this.mapLimit - margin; z += gridSize) {
        const pos = new THREE.Vector3(x, 0.5, z);
        
        // Check if position is valid (not inside obstacle)
        if (!this.isPositionInsideObstacle(pos)) {
          this.itemSpawnPositions.push(pos);
        }
      }
    }

    // Shuffle spawn positions
    for (let i = this.itemSpawnPositions.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.itemSpawnPositions[i], this.itemSpawnPositions[j]] = [
        this.itemSpawnPositions[j],
        this.itemSpawnPositions[i],
      ];
    }
  }

  /**
   * Check if a position is inside an obstacle
   */
  private isPositionInsideObstacle(pos: THREE.Vector3): boolean {
    const testBox = new THREE.Box3().setFromCenterAndSize(
      pos,
      new THREE.Vector3(2, 2, 2)
    );

    for (const obstacle of this.obstacles) {
      if (testBox.intersectsBox(obstacle)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Spawn initial set of items
   */
  private spawnInitialItems(): void {
    const itemTypes = [
      ItemType.HEALTH_PACK,
      ItemType.SPEED_BOOST,
      ItemType.DAMAGE_BOOST,
      ItemType.SHIELD,
    ];

    // Spawn 2-3 of each item type
    const itemsPerType = 2;
    let spawnIndex = 0;

    for (const itemType of itemTypes) {
      for (let i = 0; i < itemsPerType && spawnIndex < this.itemSpawnPositions.length; i++) {
        const pos = this.itemSpawnPositions[spawnIndex++];
        this.spawnItem(itemType, pos);
      }
    }
  }

  /**
   * Spawn a single item
   */
  public spawnItem(type: ItemType, position?: THREE.Vector3): ServerItem {
    const itemId = `item_${++this.itemIdCounter}`;
    
    let pos = position;
    if (!pos) {
      // Find a random available position
      const availablePositions = this.itemSpawnPositions.filter(p => {
        for (const item of this.items.values()) {
          if (!item.isCollected && item.position.distanceTo(p) < 3) {
            return false;
          }
        }
        return true;
      });

      if (availablePositions.length > 0) {
        pos = availablePositions[Math.floor(Math.random() * availablePositions.length)];
      } else {
        // Fallback to first position
        pos = this.itemSpawnPositions[0] || new THREE.Vector3(0, 0.5, 0);
      }
    }

    const item = new ServerItem(itemId, type, { x: pos.x, y: pos.y, z: pos.z });
    this.items.set(itemId, item);
    return item;
  }

  /**
   * Get all items
   */
  public getItems(): ServerItem[] {
    return Array.from(this.items.values());
  }

  public addPlayer(id: string): ServerPlayer {
    // Find spawn point
    const spawnPos = new THREE.Vector3(0, 0, 0);
    const claimedIndices = new Set(this.claimedSpawnPoints.values());

    let found = false;
    for (let i = 0; i < this.spawnPositions.length; i++) {
      if (!claimedIndices.has(i)) {
        this.claimedSpawnPoints.set(id, i);
        spawnPos.set(this.spawnPositions[i].x, 0, this.spawnPositions[i].y);
        found = true;
        break;
      }
    }

    if (!found) {
      // Find a safe random position instead of 0,0,0
      const safePositions = [
        new THREE.Vector3(15, 0, 15),
        new THREE.Vector3(-15, 0, 15),
        new THREE.Vector3(15, 0, -15),
        new THREE.Vector3(-15, 0, -15),
        new THREE.Vector3(0, 0, 20),
        new THREE.Vector3(0, 0, -20),
        new THREE.Vector3(20, 0, 0),
        new THREE.Vector3(-20, 0, 0),
      ];
      const randomSafe = safePositions[Math.floor(Math.random() * safePositions.length)];
      spawnPos.copy(randomSafe);
      console.warn(`No free spawn points for ${id}, spawning at safe position`);
    }

    const player = new ServerPlayer(
      id,
      { x: spawnPos.x, y: spawnPos.y, z: spawnPos.z },
      this.mapLimit
    );
    this.players.set(id, player);
    return player;
  }

  public removePlayer(id: string) {
    this.players.delete(id);
    this.bots.delete(id); // Also remove from bots if it was a bot
    this.claimedSpawnPoints.delete(id);
  }

  /**
   * Add a bot to the game
   */
  public addBot(archetype?: BotArchetype): ServerBot {
    const botId = `bot_${++this.botIdCounter}_${Date.now()}`;
    
    // Find spawn point
    const spawnPos = new THREE.Vector3(0, 0, 0);
    const claimedIndices = new Set(this.claimedSpawnPoints.values());

    let found = false;
    for (let i = 0; i < this.spawnPositions.length; i++) {
      if (!claimedIndices.has(i)) {
        this.claimedSpawnPoints.set(botId, i);
        spawnPos.set(this.spawnPositions[i].x, 0, this.spawnPositions[i].y);
        found = true;
        break;
      }
    }

    if (!found) {
      // Random position if no spawn points available
      const range = this.mapLimit * 0.8;
      spawnPos.set(
        (Math.random() - 0.5) * range * 2,
        0,
        (Math.random() - 0.5) * range * 2
      );
    }

    const bot = new ServerBot(
      botId,
      { x: spawnPos.x, y: spawnPos.y, z: spawnPos.z },
      this.mapLimit,
      archetype
    );

    this.players.set(botId, bot);
    this.bots.set(botId, bot);
    
    return bot;
  }

  /**
   * Remove a specific bot
   */
  public removeBot(id: string) {
    this.bots.delete(id);
    this.players.delete(id);
    this.claimedSpawnPoints.delete(id);
  }

  /**
   * Remove all bots
   */
  public removeAllBots() {
    for (const botId of this.bots.keys()) {
      this.players.delete(botId);
      this.claimedSpawnPoints.delete(botId);
    }
    this.bots.clear();
  }

  /**
   * Get all bots
   */
  public getBots(): ServerBot[] {
    return Array.from(this.bots.values());
  }

  /**
   * Check if a player ID is a bot
   */
  public isBot(id: string): boolean {
    return this.bots.has(id);
  }

  public getPlayer(id: string): ServerPlayer | undefined {
    return this.players.get(id);
  }

  public update(delta: number, gameMode?: string) {
    const allPlayers = Array.from(this.players.values());
    
    // Update all players (including bots)
    this.players.forEach(player => {
      player.update(delta, this.obstacles, allPlayers);
      player.updateEffects(); // Update item effects
    });

    // Update bot AI (skip if game is over or in warmup/freeze time)
    const shouldBotsThink = gameMode === GameMode.ROUND;
    if (shouldBotsThink) {
      this.bots.forEach(bot => {
        bot.think(this);
      });
    } else {
      // Stop all bot movement when not in active round
      this.bots.forEach(bot => {
        bot.stopMovement();
      });
    }

    // Update items - check for collection and respawn
    this.updateItems();

    // Update Missiles
    for (let i = this.missiles.length - 1; i >= 0; i--) {
      const missile = this.missiles[i];
      missile.update(delta, this);
      if (missile.shouldRemove()) {
        this.missiles.splice(i, 1);
      }
    }

    // Update Laser Beams
    for (let i = this.laserBeams.length - 1; i >= 0; i--) {
      const beam = this.laserBeams[i];

      // Check if expired
      if (beam.isExpired()) {
        this.laserBeams.splice(i, 1);
        continue;
      }

      // Check collisions with players
      this.players.forEach(player => {
        if (beam.checkCollision(player.position, player.id)) {
          const config = SKILL_CONFIG[SkillType.LASER_BEAM];
          player.takeDamage(config.damage, beam.ownerId, this);
        }
      });
    }
  }

  public addMissile(missile: ServerMissile) {
    this.missiles.push(missile);
  }

  public addLaserBeam(beam: ServerLaserBeam) {
    this.laserBeams.push(beam);
  }

  public getObstacles(): THREE.Box3[] {
    return this.obstacles;
  }

  public getPlayers(): ServerPlayer[] {
    return Array.from(this.players.values());
  }

  public getSpawnPointForPlayer(playerId: string): number {
    // Return the claimed spawn point for this player, or -1 if none
    return this.claimedSpawnPoints.get(playerId) ?? -1;
  }

  public getSpawnPosition(index: number): THREE.Vector2 | undefined {
    // Return the spawn position at the given index, or undefined if out of bounds
    return this.spawnPositions[index];
  }

  /**
   * Update items - check for collection and respawn
   */
  private updateItems(): void {
    for (const item of this.items.values()) {
      // Check for respawn
      if (item.shouldRespawn()) {
        item.respawn();
        continue;
      }

      // Skip collected items
      if (item.isCollected) continue;

      // Check for player collection
      for (const player of this.players.values()) {
        if (player.isDead) continue;

        if (item.canBeCollectedBy(player.position)) {
          // Collect item
          item.collect();
          player.applyItemEffect(item.type);
          break; // Only one player can collect
        }
      }
    }
  }

  public getState() {
    return {
      players: Array.from(this.players.values()).map(p => p.getState()),
      missiles: this.missiles.map(m => m.getState()),
      laserBeams: this.laserBeams.map(b => b.getState()),
      items: Array.from(this.items.values()).map(i => i.getState()),
      timestamp: Date.now(),
    };
  }
}
