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
  
  // If target would be outside bounds, redirect toward center instead
  const isNearEdgeX = Math.abs(botPos.x) > MAP_BOUNDARY - 5;
  const isNearEdgeZ = Math.abs(botPos.z) > MAP_BOUNDARY - 5;
  
  if (isNearEdgeX || isNearEdgeZ) {
    // Blend target with center direction
    const toCenter = new THREE.Vector3(0, 0, 0).sub(botPos).normalize();
    const originalDir = target.clone().sub(botPos).normalize();
    
    // Mix directions: favor center when near edges
    const blendFactor = 0.7; // 70% toward center
    result.copy(botPos).add(
      originalDir.multiplyScalar(1 - blendFactor)
        .add(toCenter.multiplyScalar(blendFactor))
        .normalize()
        .multiplyScalar(10)
    );
  }
  
  // Final clamp
  result.x = Math.max(-MAP_BOUNDARY, Math.min(MAP_BOUNDARY, result.x));
  result.z = Math.max(-MAP_BOUNDARY, Math.min(MAP_BOUNDARY, result.z));
  
  return result;
}

/**
 * Defensive Bot - Keeps distance, uses shield, avoids combat
 * Priority: Survive > Collect > Attack
 */
export class DefensiveBot implements BotBrain {
  getArchetype(): string {
    return BotArchetype.DEFENSIVE;
  }

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
        nearestEnemy = {
          id: player.id,
          position: player.position.clone(),
          distance,
        };
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
      // Calculate escape direction (away from enemy)
      const awayDirection = new THREE.Vector3()
        .subVectors(botPos, nearestEnemy.position)
        .normalize();
      
      // Add some randomness to avoid predictable paths
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

    // If we have distance, maybe attack opportunistically
    if (nearestEnemy && nearestEnemy.distance > BOT_CONFIG.FLEE_DISTANCE * 1.5) {
      // Safe distance - maybe fire a long-range attack
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

    // Look for defensive items (health, shield)
    const desiredItems = [ItemType.HEALTH_PACK, ItemType.SHIELD];
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

    // Go collect item if found and safe to do so
    if (nearestItem && (!nearestEnemy || nearestEnemy.distance > BOT_CONFIG.FLEE_DISTANCE)) {
      return {
        type: 'MOVE',
        target: nearestItem.position,
      };
    }

    // No immediate threat - stay alert and move to center or safe zone
    if (!nearestEnemy || nearestEnemy.distance > BOT_CONFIG.CHASE_DISTANCE) {
      // Move towards map center (safer position with options)
      const centerBias = new THREE.Vector3(0, 0, 0);
      const toCenter = new THREE.Vector3().subVectors(centerBias, botPos);
      
      if (toCenter.length() > 5) {
        const target = botPos.clone().add(toCenter.normalize().multiplyScalar(5));
        return {
          type: 'MOVE',
          target,
        };
      }
    }

    // Keep distance from nearest enemy (but don't run into corners)
    if (nearestEnemy) {
      const awayDirection = new THREE.Vector3()
        .subVectors(botPos, nearestEnemy.position)
        .normalize();
      const safeTarget = clampTarget(botPos.clone().add(awayDirection.multiplyScalar(10)), botPos);
      
      return {
        type: 'MOVE',
        target: safeTarget,
      };
    }

    return { type: 'IDLE' };
  }
}

