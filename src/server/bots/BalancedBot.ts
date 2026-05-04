import * as THREE from 'three';
import type { BotBrain, BotAction } from './BotBrain';
import type { ServerBot } from '../ServerBot';
import type { ServerEntityManager } from '../ServerEntityManager';
import { SkillType, BOT_CONFIG, BotArchetype, ItemType } from '../../common/constants';

const MAP_BOUNDARY = 32;

/**
 * Clamp target to map bounds and redirect toward center if near edges
 */
function clampTarget(target: THREE.Vector3, botPos: THREE.Vector3): THREE.Vector3 {
  const result = target.clone();
  
  const isNearEdgeX = Math.abs(botPos.x) > MAP_BOUNDARY - 5;
  const isNearEdgeZ = Math.abs(botPos.z) > MAP_BOUNDARY - 5;
  
  if (isNearEdgeX || isNearEdgeZ) {
    const toCenter = new THREE.Vector3(0, 0, 0).sub(botPos).normalize();
    const originalDir = target.clone().sub(botPos).normalize();
    
    const blendFactor = 0.7;
    result.copy(botPos).add(
      originalDir.multiplyScalar(1 - blendFactor)
        .add(toCenter.multiplyScalar(blendFactor))
        .normalize()
        .multiplyScalar(10)
    );
  }
  
  result.x = Math.max(-MAP_BOUNDARY, Math.min(MAP_BOUNDARY, result.x));
  result.z = Math.max(-MAP_BOUNDARY, Math.min(MAP_BOUNDARY, result.z));
  
  return result;
}

/**
 * Balanced Bot - Adapts behavior based on HP and situation
 * HP > 50%: More aggressive
 * HP <= 50%: More defensive
 */
export class BalancedBot implements BotBrain {
  getArchetype(): string {
    return BotArchetype.BALANCED;
  }

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

    // No enemies, idle
    if (!nearestEnemy) {
      return { type: 'IDLE' };
    }

    // Critical HP - emergency mode
    if (hpPercent < 25) {
      // Use invincibility immediately
      if (now >= bot.invincibilityCooldown) {
        return {
          type: 'USE_SKILL',
          skillType: SkillType.INVINCIBILITY,
        };
      }

      // Teleport away
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
        // Use skills
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

        return {
          type: 'MOVE',
          target: nearestEnemy.position,
        };
      }
    } else {
      // Defensive mode (HP <= 50%)
      
      // Use invincibility if not already active and enemy is close
      if (nearestEnemy.distance < BOT_CONFIG.FLEE_DISTANCE && now >= bot.invincibilityCooldown) {
        return {
          type: 'USE_SKILL',
          skillType: SkillType.INVINCIBILITY,
        };
      }

      // Keep distance but still attack from afar
      if (nearestEnemy.distance < BOT_CONFIG.FLEE_DISTANCE * 1.5) {
        // Run away while shooting
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

        // Kite - move away while engaging
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
      ? [ItemType.SPEED_BOOST, ItemType.DAMAGE_BOOST]
      : [ItemType.HEALTH_PACK, ItemType.SPEED_BOOST, ItemType.SHIELD];
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
      return {
        type: 'MOVE',
        target: nearestItem.position,
      };
    }

    // Default: maintain optimal distance
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
      return {
        type: 'MOVE',
        target: nearestEnemy.position,
      };
    }

    return { type: 'IDLE' };
  }
}

