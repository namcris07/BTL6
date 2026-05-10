import * as THREE from 'three';
import type { BotBrain, BotAction } from './BotBrain';
import type { ServerBot } from '../ServerBot';
import type { ServerEntityManager } from '../ServerEntityManager';
import { SkillType, BOT_CONFIG, BotArchetype, ItemType } from '../../common/constants';

/**
 * Aggressive Bot - Chases nearest player, uses offensive skills
 * Priority: Attack > Collect > Survive
 */
export class AggressiveBot implements BotBrain {
  getArchetype(): string {
    return BotArchetype.AGGRESSIVE;
  }

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
        nearestEnemy = {
          id: player.id,
          position: player.position.clone(),
          distance,
        };
      }
    }

    // No enemies found, idle
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
        // Teleport towards enemy
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

    // Low HP? Use invincibility before continuing attack
    if (bot.health < 40 && now >= bot.invincibilityCooldown) {
      return {
        type: 'USE_SKILL',
        skillType: SkillType.INVINCIBILITY,
      };
    }

    // Look for offensive items (damage boost) if nearby
    const desiredItems = [ItemType.DAMAGE_BOOST];
    const items = entityManager.getItems();
    let nearestItem: { position: THREE.Vector3; distance: number } | null = null;
    let nearestItemDist = BOT_CONFIG.ITEM_SEARCH_RANGE * 0.5; // Aggressive bots only grab very close items

    for (const item of items) {
      if (item.isCollected) continue;
      if (!desiredItems.includes(item.type)) continue;
      
      const dist = botPos.distanceTo(item.position);
      if (dist < nearestItemDist) {
        nearestItemDist = dist;
        nearestItem = { position: item.position.clone(), distance: dist };
      }
    }

    // Grab item if very close (won't detour much from chase)
    if (nearestItem && nearestItem.distance < 8) {
      return {
        type: 'MOVE',
        target: nearestItem.position,
      };
    }

    // Chase the enemy
    return {
      type: 'MOVE',
      target: nearestEnemy.position,
    };
  }
}

