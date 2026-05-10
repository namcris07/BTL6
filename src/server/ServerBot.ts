import * as THREE from 'three';
import { ServerPlayer } from './ServerPlayer';
import type { ServerEntityManager } from './ServerEntityManager';
import type { BotBrain } from './bots/BotBrain';
import { BotFactory } from './bots/BotFactory';
import { BOT_CONFIG, BotArchetype, SkillType } from '../common/constants';
import type { Vector3 } from '../common/types';

/**
 * ServerBot extends ServerPlayer with AI decision-making capabilities
 */
export class ServerBot extends ServerPlayer {
  private brain: BotBrain;
  private lastThinkTime: number = 0;
  private isBot: boolean = true;
  public archetype: BotArchetype;

  constructor(
    id: string,
    startPosition: Vector3,
    mapLimit: number = 35,
    archetype?: BotArchetype
  ) {
    super(id, startPosition, mapLimit);

    // Set bot username
    this.archetype = archetype || this.getRandomArchetype();
    this.username = this.generateBotName();

    // Create brain based on archetype
    this.brain = BotFactory.createBrain(this.archetype);
  }

  private getRandomArchetype(): BotArchetype {
    const archetypes = [BotArchetype.AGGRESSIVE, BotArchetype.DEFENSIVE, BotArchetype.BALANCED];
    return archetypes[Math.floor(Math.random() * archetypes.length)];
  }

  private generateBotName(): string {
    const prefixes: Record<BotArchetype, string[]> = {
      [BotArchetype.AGGRESSIVE]: ['Fury', 'Rage', 'Storm', 'Blaze', 'Thunder'],
      [BotArchetype.DEFENSIVE]: ['Shield', 'Guard', 'Fortress', 'Sentinel', 'Bastion'],
      [BotArchetype.BALANCED]: ['Shadow', 'Ghost', 'Ninja', 'Phantom', 'Stealth'],
    };

    const suffixes = ['Bot', 'AI', 'X', '99', 'Pro'];
    const prefix = prefixes[this.archetype][Math.floor(Math.random() * prefixes[this.archetype].length)];
    const suffix = suffixes[Math.floor(Math.random() * suffixes.length)];
    
    return `${prefix}${suffix}`;
  }

  /**
   * Returns whether this entity is a bot
   */
  public getIsBot(): boolean {
    return this.isBot;
  }

  /**
   * Think and act - called by the server on each tick
   */
  public think(entityManager: ServerEntityManager): void {
    // Don't think if dead or frozen
    if (this.isDead) return;

    const now = Date.now();

    // Throttle thinking to reduce CPU usage
    if (now - this.lastThinkTime < BOT_CONFIG.THINK_INTERVAL) {
      return;
    }
    this.lastThinkTime = now;

    // Get action from brain
    const action = this.brain.think(this, entityManager);

    // Execute action
    switch (action.type) {
      case 'MOVE':
        if (action.target) {
          this.setDestination(action.target);
        }
        break;

      case 'USE_SKILL':
        if (action.skillType) {
          this.executeSkill(action.skillType, action.target, action.direction, entityManager);
        }
        break;

      case 'STOP':
        this.stopMovement();
        break;

      case 'IDLE':
      default:
        // Do nothing, maybe stop if currently moving
        if (Math.random() < 0.1) {
          this.stopMovement();
        }
        break;
    }
  }

  /**
   * Execute a skill action
   */
  private executeSkill(
    skillType: SkillType,
    target: THREE.Vector3 | undefined,
    direction: THREE.Vector3 | undefined,
    entityManager: ServerEntityManager
  ): void {
    switch (skillType) {
      case SkillType.TELEPORT:
        if (target) {
          this.attemptTeleport(
            { x: target.x, y: target.y, z: target.z },
            entityManager.getObstacles(),
            entityManager.getPlayers()
          );
        }
        break;

      case SkillType.HOMING_MISSILE:
        if (target) {
          this.attemptHomingMissile(
            { x: target.x, y: target.y, z: target.z },
            entityManager
          );
        }
        break;

      case SkillType.LASER_BEAM:
        if (direction) {
          this.attemptLaserBeam(
            { x: direction.x, y: direction.y, z: direction.z },
            entityManager
          );
        }
        break;

      case SkillType.INVINCIBILITY:
        this.attemptInvincibility();
        break;
    }
  }
}

