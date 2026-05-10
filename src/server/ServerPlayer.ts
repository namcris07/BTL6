import * as THREE from 'three';
import type { Vector3, PlayerState, PlayerEffect } from '../common/types';
import { SKILL_CONFIG, SkillType, ItemType, ITEM_CONFIG, ATTACK_CONFIG } from '../common/constants';
import { ServerEntityManager } from './ServerEntityManager';
import { ServerMissile } from './ServerMissile';
import { ServerLaserBeam } from './ServerLaserBeam';

export class ServerPlayer {
  private readonly mapLimit: number;

  public id: string;
  public username?: string; // Player's display name
  public avatar?: string; // Player's avatar (for future use)
  public position: THREE.Vector3;
  public rotation: THREE.Quaternion;
  public velocity: THREE.Vector3 = new THREE.Vector3();
  public destination: THREE.Vector3 | null = null;
  public destinationSetTime: number = 0; // Track when destination was set
  public movementDirection: THREE.Vector3 | null = null; // For WASD movement
  public isMoving: boolean = false;
  public speed: number = 10;
  public color: number;

  // Health & Status
  public maxHealth: number = 100;
  public health: number = 100;
  public isInvulnerable: boolean = false;
  private invulnerableTimer: number = 0;
  public isDead: boolean = false;

  // Stats
  public kills: number = 0;
  public deaths: number = 0;
  public lastPlayerAlive: number = 0;
  public aliveStartTime: number = 0;
  public respawnTime: number = 0;

  // Teleport State
  public isTeleporting: boolean = false;
  public teleportCooldown: number = 0;
  private teleportDestination: THREE.Vector3 = new THREE.Vector3();
  private teleportSpeed: number = 50;

  // Homing Missile State
  public homingMissileCooldown: number = 0;

  // Laser Beam State
  public laserBeamCooldown: number = 0;

  // Invincibility State
  public invincibilityCooldown: number = 0;

  // Attack State
  public attackCooldown: number = 0;
  public isAttacking: boolean = false;
  public attackDirection: THREE.Vector3 | null = null;
  private attackEndTime: number = 0;

  // Item Effects
  public activeEffects: PlayerEffect[] = [];
  public hasShield: boolean = false;
  private baseSpeed: number = 10;
  public lastDamageTime: number = 0; // For damage flash effect
  public lastDamageAmount: number = 0; // For damage number display

  // Skill System (We might need a ServerSkillSystem)
  // For now, let's keep it simple or reuse SkillSystem if it doesn't depend on rendering
  // The current SkillSystem depends on Player (which has mesh) and EntityManager (which has scene).
  // We need to refactor SkillSystem or create a ServerSkillSystem.
  // Let's assume we refactor SkillSystem later or mock it for now.

  constructor(id: string, startPosition: Vector3, mapLimit: number = 35) {
    this.id = id;
    this.mapLimit = mapLimit;
    this.position = new THREE.Vector3(startPosition.x, startPosition.y, startPosition.z);
    this.rotation = new THREE.Quaternion();

    // Assign random color for bandana
    // Use bright/vibrant colors for better visibility
    const hue = Math.random();
    const saturation = 0.8 + Math.random() * 0.2; // 0.8 - 1.0
    const lightness = 0.4 + Math.random() * 0.2; // 0.4 - 0.6
    const color = new THREE.Color().setHSL(hue, saturation, lightness);
    this.color = color.getHex();
  }

  public setDestination(point: THREE.Vector3) {
    this.destination = point.clone();
    this.destination.y = this.position.y;
    this.destinationSetTime = Date.now();
    this.isMoving = true;
    const direction = this.destination.clone().sub(this.position).normalize();
    this.velocity.copy(direction);
  }

  public setMovementDirection(direction: THREE.Vector3) {
    this.movementDirection = direction.clone().normalize();
    this.isMoving = true;
    this.destination = null; // Clear destination when using direction
    this.velocity.copy(this.movementDirection);
  }

  public stopMovement() {
    this.isMoving = false;
    this.destination = null;
    this.movementDirection = null;
    this.velocity.set(0, 0, 0);
  }

  public update(delta: number, obstacles: THREE.Box3[], otherPlayers: ServerPlayer[]) {
    // Update Invulnerability
    if (this.isInvulnerable) {
      this.invulnerableTimer -= delta;
      if (this.invulnerableTimer <= 0) {
        this.isInvulnerable = false;
      }
    }

    // Update Attack State
    if (this.isAttacking) {
      const now = Date.now();
      if (now >= this.attackEndTime) {
        this.isAttacking = false;
        this.attackDirection = null;
      }
    }

    // Don't update movement if player is frozen or dead
    if (this.isDead) {
      return;
    }

    // Teleport movement (no collision during teleport)
    if (this.isTeleporting) {
      const distanceToDest = this.position.distanceTo(this.teleportDestination);
      const moveDist = this.teleportSpeed * delta;

      if (distanceToDest <= moveDist) {
        this.position.copy(this.teleportDestination);
        this.isTeleporting = false;
      } else {
        const direction = this.teleportDestination.clone().sub(this.position).normalize();
        this.position.add(direction.multiplyScalar(moveDist));
      }
      return; // Skip collision checks during teleport
    }

    if (this.isMoving) {
      const moveDistance = this.speed * delta;
      let moveVector: THREE.Vector3;

      if (this.movementDirection) {
        // WASD direction-based movement
        moveVector = this.movementDirection.clone().multiplyScalar(moveDistance);
      } else if (this.destination) {
        // Click-to-move destination-based movement
        const distanceToDestination = this.position.distanceTo(this.destination);
        
        if (distanceToDestination <= moveDistance) {
          this.position.copy(this.destination);
          this.stopMovement();
          return;
        }
        
        // Timeout: if stuck for too long (3 seconds), abandon destination
        const now = Date.now();
        if (now - this.destinationSetTime > 3000) {
          this.stopMovement();
          return;
        }
        
        moveVector = this.velocity.clone().multiplyScalar(moveDistance);
      } else {
        return;
      }

      // Try moving along X axis
      let potentialPosition = this.position.clone();
      potentialPosition.x += moveVector.x;

      if (!this.checkCollision(potentialPosition, obstacles, otherPlayers)) {
        this.position.x = potentialPosition.x;
      }

      // Try moving along Z axis (from the potentially new X position)
      potentialPosition = this.position.clone();
      potentialPosition.z += moveVector.z;

      if (!this.checkCollision(potentialPosition, obstacles, otherPlayers)) {
        this.position.z = potentialPosition.z;
      }

      // For destination-based movement, check if reached
      if (this.destination && this.position.distanceTo(this.destination) < moveDistance) {
        this.stopMovement();
      }

      // Map Boundary
      this.position.x = Math.max(-this.mapLimit, Math.min(this.mapLimit, this.position.x));
      this.position.z = Math.max(-this.mapLimit, Math.min(this.mapLimit, this.position.z));
    }
  }

  private checkCollision(
    position: THREE.Vector3,
    obstacles: THREE.Box3[],
    otherPlayers: ServerPlayer[]
  ): boolean {
    const playerBox = new THREE.Box3().setFromCenterAndSize(
      position.clone().add(new THREE.Vector3(0, 1, 0)),
      new THREE.Vector3(1, 2, 1)
    );

    // Check collision with obstacles
    for (const obstacle of obstacles) {
      if (playerBox.intersectsBox(obstacle)) {
        return true;
      }
    }

    // Check collision with other players
    for (const otherPlayer of otherPlayers) {
      if (otherPlayer.id !== this.id) {
        const otherPlayerCollider = new THREE.Box3().setFromCenterAndSize(
          otherPlayer.position.clone().add(new THREE.Vector3(0, 1, 0)),
          new THREE.Vector3(1, 2, 1)
        );
        if (playerBox.intersectsBox(otherPlayerCollider)) {
          return true;
        }
      }
    }

    return false;
  }

  public attemptTeleport(
    target: Vector3,
    obstacles: THREE.Box3[],
    otherPlayers: ServerPlayer[]
  ): boolean {
    if (this.isDead) return false;
    const now = Date.now();
    if (now < this.teleportCooldown) {
      return false;
    }

    // Validate range
    const currentPos = new THREE.Vector3(this.position.x, this.position.y, this.position.z);
    const targetPos = new THREE.Vector3(target.x, target.y, target.z);
    const distance = currentPos.distanceTo(targetPos);

    if (distance > SKILL_CONFIG.TELEPORT.range + 1) {
      // +1 buffer for latency/float errors
      return false;
    }

    // Validate bounds (map limits) - Clamp to map edges
    targetPos.x = Math.max(-this.mapLimit, Math.min(this.mapLimit, targetPos.x));
    targetPos.z = Math.max(-this.mapLimit, Math.min(this.mapLimit, targetPos.z));

    // Combine obstacles and other players into a single list of colliders
    const allColliders: THREE.Box3[] = [...obstacles];

    for (const player of otherPlayers) {
      if (player.id !== this.id && !player.isDead) {
        const playerCollider = new THREE.Box3().setFromCenterAndSize(
          new THREE.Vector3(player.position.x, player.position.y + 1, player.position.z),
          new THREE.Vector3(1, 2, 1)
        );
        allColliders.push(playerCollider);
      }
    }

    // Check if destination is inside a collider
    const playerCollider = new THREE.Box3().setFromCenterAndSize(
      new THREE.Vector3(targetPos.x, targetPos.y + 1, targetPos.z),
      new THREE.Vector3(1, 2, 1)
    );

    let finalTarget = targetPos.clone();
    let isInsideCollider = false;
    let intersectingCollider: THREE.Box3 | null = null;

    for (const collider of allColliders) {
      if (playerCollider.intersectsBox(collider)) {
        isInsideCollider = true;
        intersectingCollider = collider;
        break;
      }
    }

    // If inside collider, find the closest valid point outside
    if (isInsideCollider && intersectingCollider) {
      const colliderCenter = new THREE.Vector3();
      intersectingCollider.getCenter(colliderCenter);
      const colliderSize = new THREE.Vector3();
      intersectingCollider.getSize(colliderSize);
      const halfExtents = colliderSize.clone().multiplyScalar(0.5);

      // Candidate exit points (center of each face projected from target)
      // We want the point on the boundary closest to the TARGET, not current pos.
      // Actually, we can just project the target point onto the 4 faces.

      let bestExitPoint = currentPos.clone(); // Default to staying put if all else fails
      let minDistanceToTarget = Infinity;
      let foundValidExit = false;

      const directions = [
        new THREE.Vector3(0, 0, 1), // North face
        new THREE.Vector3(0, 0, -1), // South face
        new THREE.Vector3(1, 0, 0), // East face
        new THREE.Vector3(-1, 0, 0), // West face
      ];

      for (const dir of directions) {
        // Calculate point on this face
        const exitPoint = targetPos.clone();

        // Project target onto the face plane
        if (Math.abs(dir.x) > 0.5) {
          // East/West face: set X to face X
          exitPoint.x = colliderCenter.x + dir.x * (halfExtents.x + 0.6); // 0.6 margin
        } else {
          // North/South face: set Z to face Z
          exitPoint.z = colliderCenter.z + dir.z * (halfExtents.z + 0.6); // 0.6 margin
        }

        // Let's check if this exit point is valid
        const exitBox = new THREE.Box3().setFromCenterAndSize(
          new THREE.Vector3(exitPoint.x, exitPoint.y + 1, exitPoint.z),
          new THREE.Vector3(1, 2, 1)
        );

        let isValidExit = true;
        for (const otherCollider of allColliders) {
          if (otherCollider !== intersectingCollider && exitBox.intersectsBox(otherCollider)) {
            isValidExit = false;
            break;
          }
        }

        if (isValidExit) {
          const dist = exitPoint.distanceTo(targetPos);
          if (dist < minDistanceToTarget) {
            minDistanceToTarget = dist;
            bestExitPoint = exitPoint;
            foundValidExit = true;
          }
        }
      }

      if (foundValidExit) {
        finalTarget = bestExitPoint;
      } else {
        // If no valid exit found (e.g. surrounded), stay at current pos or try to go back
        // For now, let's just cancel the teleport effectively by setting target to current
        finalTarget = currentPos.clone();
      }
    }

    // Validate final target is within range
    const finalDistance = currentPos.distanceTo(finalTarget);
    if (finalDistance > SKILL_CONFIG.TELEPORT.range + 1) {
      // Clamp to max range
      const clampedDirection = new THREE.Vector3().subVectors(finalTarget, currentPos);
      clampedDirection.y = 0;
      clampedDirection.normalize();
      finalTarget = currentPos
        .clone()
        .add(clampedDirection.multiplyScalar(SKILL_CONFIG.TELEPORT.range));
      finalTarget.y = target.y;
    }

    // Validate bounds (map limits)
    finalTarget.x = Math.max(-this.mapLimit, Math.min(this.mapLimit, finalTarget.x));
    finalTarget.z = Math.max(-this.mapLimit, Math.min(this.mapLimit, finalTarget.z));

    // Perform teleport
    this.teleportDestination.set(finalTarget.x, finalTarget.y, finalTarget.z);
    this.isTeleporting = true;
    this.teleportCooldown = now + SKILL_CONFIG.TELEPORT.cooldown;

    return true;
  }

  public attemptHomingMissile(mousePos: Vector3, entityManager: ServerEntityManager): boolean {
    if (this.isDead) return false;
    const now = Date.now();
    if (now < this.homingMissileCooldown) {
      return false;
    }

    const config = SKILL_CONFIG[SkillType.HOMING_MISSILE];

    // Find target
    // Check if any enemy is within mouseRadius of mousePos
    const mouseV = new THREE.Vector3(mousePos.x, mousePos.y, mousePos.z);
    let targetId: string | null = null;
    let minDistance = config.mouseRadius;

    const players = entityManager.getPlayers();
    for (const player of players) {
      if (player.id === this.id) continue; // Skip self
      if (player.health <= 0) continue;

      const dist = player.position.distanceTo(mouseV);
      if (dist <= config.mouseRadius && dist < minDistance) {
        minDistance = dist;
        targetId = player.id;
      }
    }

    // Create Missile
    // Spawn at player position
    const spawnPos = this.position.clone();
    spawnPos.y = 1; // Spawn at chest height

    // Initial direction: Towards mouse cursor
    const direction = mouseV.clone().sub(spawnPos).normalize();

    const missileId = `missile_${this.id}_${now}`;
    const missile = new ServerMissile(missileId, this.id, spawnPos, targetId, direction);

    entityManager.addMissile(missile);

    this.homingMissileCooldown = now + config.cooldown;
    return true;
  }

  public attemptLaserBeam(direction: Vector3, entityManager: ServerEntityManager): boolean {
    if (this.isDead) return false;
    const now = Date.now();
    if (now < this.laserBeamCooldown) {
      return false;
    }

    const config = SKILL_CONFIG[SkillType.LASER_BEAM];

    // Normalize direction
    const dir = new THREE.Vector3(direction.x, direction.y, direction.z).normalize();

    // Start position at player chest height
    const startPos = this.position.clone();
    startPos.y = 1;

    // Calculate end position at max range
    const endPos = startPos.clone().add(dir.multiplyScalar(config.range));

    // Perform raycast to check for walls/obstacles
    const raycaster = new THREE.Raycaster(startPos, dir, 0, config.range);
    const obstacles = entityManager.getObstacles();

    let actualEndPos = endPos;
    let minDistance = config.range;

    // Check intersection with each obstacle
    for (const obstacle of obstacles) {
      const intersection = new THREE.Vector3();
      if (raycaster.ray.intersectBox(obstacle, intersection)) {
        const dist = startPos.distanceTo(intersection);
        if (dist < minDistance) {
          minDistance = dist;
          actualEndPos = intersection;
        }
      }
    }

    // Create laser beam
    const beamId = `laser_${this.id}_${now}`;
    const beam = new ServerLaserBeam(
      beamId,
      this.id,
      { x: startPos.x, y: startPos.y, z: startPos.z },
      { x: actualEndPos.x, y: actualEndPos.y, z: actualEndPos.z }
    );

    entityManager.addLaserBeam(beam);
    this.laserBeamCooldown = now + config.cooldown;
    return true;
  }

  public takeDamage(
    amount: number,
    attackerId?: string,
    entityManager?: ServerEntityManager
  ): void {
    if (this.isDead) return;
    if (this.isInvulnerable) return;

    // Record damage time and amount for flash effect and damage display
    this.lastDamageTime = Date.now();
    this.lastDamageAmount = amount;

    // Check for shield
    if (this.hasShield) {
      // Shield absorbs the hit
      this.hasShield = false;
      this.activeEffects = this.activeEffects.filter(e => e.type !== ItemType.SHIELD);
      return;
    }

    this.health = Math.max(0, this.health - amount);
    if (this.health <= 0) {
      // Handle death
      this.isDead = true;
      this.deaths++;
      this.aliveStartTime = 0; // Stop tracking alive time

      // Increment attacker's kill count if attackerId is provided and it's not a self-kill
      if (attackerId && entityManager && attackerId !== this.id) {
        const attacker = entityManager.getPlayer(attackerId);
        if (attacker) {
          attacker.kills++;
        }
      }
    }
  }

  public attemptInvincibility(): boolean {
    if (this.isDead) return false;
    const now = Date.now();
    if (now < this.invincibilityCooldown) {
      return false;
    }

    const config = SKILL_CONFIG[SkillType.INVINCIBILITY];

    // Activate invincibility
    this.isInvulnerable = true;
    this.invulnerableTimer = config.duration / 1000; // Convert to seconds
    this.invincibilityCooldown = now + config.cooldown;

    return true;
  }

  public performAttack(direction: Vector3, otherPlayers: ServerPlayer[]): ServerPlayer[] {
    if (this.isDead) return [];
    const now = Date.now();
    if (now < this.attackCooldown) {
      return [];
    }

    // Set attack state
    this.isAttacking = true;
    this.attackDirection = new THREE.Vector3(direction.x, direction.y, direction.z);
    this.attackEndTime = now + ATTACK_CONFIG.animationDuration;
    this.attackCooldown = now + ATTACK_CONFIG.cooldown;

    // Calculate damage
    const baseDamage = ATTACK_CONFIG.damage;
    const damage = baseDamage * this.getDamageMultiplier();

    // Check which players are hit - 360 degree attack, only need range check
    const hitPlayers: ServerPlayer[] = [];
    const attackerPos = this.position.clone();

    for (const target of otherPlayers) {
      if (target.id === this.id || target.isDead) continue;

      // Calculate distance to target
      const distance = attackerPos.distanceTo(target.position);

      // Check if within range (360 degrees, so no angle check needed)
      if (distance <= ATTACK_CONFIG.range) {
        // Target is within attack range and angle - apply damage
        if (target.isInvulnerable) {
          // Skip invulnerable players
          continue;
        }

        // Handle shield
        if (target.hasShield) {
          target.hasShield = false;
          target.activeEffects = target.activeEffects.filter(e => e.type !== ItemType.SHIELD);
          // Shield absorbed the hit, no damage
          hitPlayers.push(target);
          continue;
        }

        // Apply damage
        target.health = Math.max(0, target.health - damage);
        target.lastDamageTime = now;
        target.lastDamageAmount = damage;

        if (target.health <= 0) {
          target.isDead = true;
          target.stopMovement();
          this.kills++;
          target.deaths++;
        }

        hitPlayers.push(target);
      }
    }

    return hitPlayers;
  }

  public reset() {
    // Reset health and status
    this.health = this.maxHealth;
    this.isInvulnerable = false;
    this.invulnerableTimer = 0;
    this.isDead = false;
    this.respawnTime = 0;

    // Reset movement
    this.stopMovement();

    // Reset cooldowns
    const now = Date.now();
    this.teleportCooldown = now;
    this.homingMissileCooldown = now;
    this.laserBeamCooldown = now;
    this.invincibilityCooldown = now;
    this.attackCooldown = now;

    // Reset item effects
    this.activeEffects = [];
    this.hasShield = false;
    this.speed = this.baseSpeed;

    // Start tracking alive time
    this.aliveStartTime = now;
  }

  /**
   * Apply an item effect to this player
   */
  public applyItemEffect(itemType: ItemType): void {
    const config = ITEM_CONFIG[itemType];
    const now = Date.now();

    switch (itemType) {
      case ItemType.HEALTH_PACK:
        // Instant heal
        this.health = Math.min(this.maxHealth, this.health + config.healAmount);
        break;

      case ItemType.DAMAGE_BOOST:
        // Remove existing damage boost
        this.activeEffects = this.activeEffects.filter(e => e.type !== ItemType.DAMAGE_BOOST);
        // Add new damage boost
        this.activeEffects.push({
          type: ItemType.DAMAGE_BOOST,
          expiresAt: now + config.duration,
        });
        break;

      case ItemType.SHIELD:
        // Remove existing shield
        this.activeEffects = this.activeEffects.filter(e => e.type !== ItemType.SHIELD);
        // Add new shield
        this.activeEffects.push({
          type: ItemType.SHIELD,
          expiresAt: now + config.duration,
        });
        this.hasShield = true;
        break;
    }
  }

  /**
   * Update item effects (called each tick)
   */
  public updateEffects(): void {
    const now = Date.now();

    // Check for expired effects
    const expiredEffects = this.activeEffects.filter(e => now >= e.expiresAt);
    
    for (const effect of expiredEffects) {
      switch (effect.type) {
        case ItemType.SHIELD:
          this.hasShield = false;
          break;
        // DAMAGE_BOOST is checked at damage time, no cleanup needed
      }
    }

    // Remove expired effects
    this.activeEffects = this.activeEffects.filter(e => now < e.expiresAt);
  }

  /**
   * Check if player has damage boost active
   */
  public hasDamageBoost(): boolean {
    return this.activeEffects.some(e => e.type === ItemType.DAMAGE_BOOST);
  }

  /**
   * Get damage multiplier
   */
  public getDamageMultiplier(): number {
    if (this.hasDamageBoost()) {
      return ITEM_CONFIG[ItemType.DAMAGE_BOOST].damageMultiplier;
    }
    return 1;
  }

  public getState(): PlayerState {
    return {
      id: this.id,
      username: this.username,
      avatar: this.avatar,
      position: { x: this.position.x, y: this.position.y, z: this.position.z },
      rotation: { x: this.rotation.x, y: this.rotation.y, z: this.rotation.z, w: this.rotation.w },
      health: this.health,
      maxHealth: this.maxHealth,
      isInvulnerable: this.isInvulnerable,
      isMoving: this.isMoving,
      teleportCooldown: this.teleportCooldown,
      isTeleporting: this.isTeleporting,
      homingMissileCooldown: this.homingMissileCooldown,
      laserBeamCooldown: this.laserBeamCooldown,
      invincibilityCooldown: this.invincibilityCooldown,
      attackCooldown: this.attackCooldown,
      isAttacking: this.isAttacking,
      attackDirection: this.attackDirection ? { x: this.attackDirection.x, y: this.attackDirection.y, z: this.attackDirection.z } : undefined,
      isDead: this.isDead,
      kills: this.kills,
      deaths: this.deaths,
      lastPlayerAlive: this.lastPlayerAlive,
      color: this.color,
      activeEffects: this.activeEffects,
      hasShield: this.hasShield,
      lastDamageTime: this.lastDamageTime > 0 ? this.lastDamageTime : undefined,
      lastDamageAmount: this.lastDamageAmount > 0 ? this.lastDamageAmount : undefined,
      speed: this.speed,
    };
  }
}
