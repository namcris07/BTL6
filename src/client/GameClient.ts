import * as THREE from 'three';
import { Renderer } from '../core/Renderer';
import { InputManager } from '../core/InputManager';
import { NetworkManager } from '../network/NetworkManager';
import { ClientEntityManager } from './ClientEntityManager';
import { UIManager } from '../core/UIManager';
import { AudioManager } from './AudioManager';
import type { NetworkMessage, JoinRequestMessage } from '../common/messages';
import type { GameState, MapConfig } from '../common/types';
import { SKILL_CONFIG, SkillType, TICK_INTERVAL, CAMERA_CONFIG, ATTACK_CONFIG } from '../common/constants';

// Declare custom event types
declare global {
  interface WindowEventMap {
    'network-data': CustomEvent<{ from: string; data: NetworkMessage }>;
    'game-started': CustomEvent<void>;
    'player-disconnected': CustomEvent<string>;
  }
}

export class GameClient {
  private renderer: Renderer;
  private inputManager: InputManager;
  private networkManager: NetworkManager;
  private entityManager: ClientEntityManager;
  private uiManager: UIManager;
  public audioManager: AudioManager;
  private groundPlane: THREE.Plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  private isRunning: boolean = false;
  private clock: THREE.Clock;
  private localPlayerId: string | null = null;
  private isLeftMouseDown: boolean = false;
  private currentGameState: GameState | null = null;
  private currentMapConfig: MapConfig | null = null;

  // Callbacks for React components
  private onSettingsToggle?: () => void;
  private onScoreboardToggle?: () => void;
  private onScoreboardClose?: () => void;

  // Getter for audioManager
  public getAudioManager(): AudioManager {
    return this.audioManager;
  }

  // Getter for localPlayerId
  public getLocalPlayerId(): string | null {
    return this.localPlayerId;
  }

  // Getter for currentGameState
  public getCurrentGameState(): GameState | null {
    return this.currentGameState;
  }

  // Getter for currentMapConfig
  public getMapConfig(): MapConfig | null {
    return this.currentMapConfig;
  }

  // Setter for settings toggle callback
  public setOnSettingsToggle(callback: () => void) {
    this.onSettingsToggle = callback;
  }

  // Setter for scoreboard toggle callback
  public setOnScoreboardToggle(callback: () => void) {
    this.onScoreboardToggle = callback;
  }

  // Setter for scoreboard close callback
  public setOnScoreboardClose(callback: () => void) {
    this.onScoreboardClose = callback;
  }

  // Camera sensitivity getter and setter
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

  // Network throttling
  private lastMovementSendTime: number = 0;
  private movementSendInterval: number = TICK_INTERVAL * 1000; // Send at tick rate
  private pendingMovementTarget: THREE.Vector3 | null = null;
  private wasdDirection: THREE.Vector3 = new THREE.Vector3();
  private isWASDMoving: boolean = false;
  
  // Attack state
  private lastAttackTime: number = 0;

  // Camera settings
  private cameraLerpFactor: number = CAMERA_CONFIG.DEFAULT_LERP_FACTOR;

  constructor(networkManager: NetworkManager) {
    this.renderer = new Renderer();
    this.inputManager = new InputManager();
    this.networkManager = networkManager;
    this.audioManager = new AudioManager();
    this.entityManager = new ClientEntityManager(this.renderer.scene, this.audioManager);
    this.uiManager = new UIManager();
    this.clock = new THREE.Clock();

    this.setupNetworkHandlers();
    this.setupInputHandlers();
  }

  private setupNetworkHandlers() {
    window.addEventListener(
      'network-data',
      (e: CustomEvent<{ from: string; data: NetworkMessage }>) => {
        const { data } = e.detail;
        this.handleMessage(data);
      }
    );

    // Handle player disconnections (including host)
    window.addEventListener('player-disconnected', () => {
      // If we're not the host and the disconnected player is the host, notify user
      if (!this.networkManager.isHost) {
        // We need to check if this is the host - we'll get a connection close event
        // The host is the first connection (index 0) for clients
        // Dispatch a custom event that App.tsx can listen to
        window.dispatchEvent(new CustomEvent('host-disconnected'));
      }
    });
  }

  private setupInputHandlers() {
    // Handle mouse down - trigger basic attack
    this.inputManager.on('mouseDown', () => {
      this.fireBasicAttack();
    });

    // Handle mouse up - no longer needed for movement
    this.inputManager.on('mouseUp', () => {
      // Mouse up handler - reserved for future use
    });

    // Handle continuous mouse movement for mouse look and skill targeting
    this.inputManager.on('input', () => {
      if (!this.localPlayerId) return;

      const myPlayer = this.entityManager.getPlayer(this.localPlayerId);
      if (!myPlayer || myPlayer.isDead) return;

      // Send mouse look (player faces cursor) - throttled
      const now = Date.now();
      if (now - this.lastMovementSendTime >= this.movementSendInterval) {
        const mouseTarget = this.inputManager.getMouseGroundIntersection(
          this.renderer.camera,
          this.groundPlane
        );
        
        if (mouseTarget) {
          this.networkManager.sendToHost({
            type: 'PLAYER_INPUT',
            input: { keys: this.inputManager.keys, mouse: null },
            mouseTarget: { x: mouseTarget.x, y: mouseTarget.y, z: mouseTarget.z },
            timestamp: now,
          });
        }
      }

      // Update teleport radius position to follow mouse cursor
      this.updateTeleportTargeting();
    });

    // Handle skill key presses and WASD
    window.addEventListener('keydown', e => {
      const key = e.key.toLowerCase();
      
      // WASD movement (lowercase only)
      if (key === 'w' || key === 'a' || key === 's' || key === 'd') {
        this.handleWASDKeyDown(key);
        // Don't fire skills when using WASD movement
        return;
      }
      
      // Skills (Q, Space, E, R - WASD is for movement)
      if (key === 'q') {
        // Show teleport targeting when Q is pressed
        this.entityManager.setSkillTargeting(SkillType.TELEPORT, true);
      } else if (e.code === 'Space') {
        e.preventDefault(); // Prevent page scroll
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

    window.addEventListener('keyup', e => {
      const key = e.key.toLowerCase();
      
      // WASD movement
      if (key === 'w' || key === 'a' || key === 's' || key === 'd') {
        this.handleWASDKeyUp(key);
      }
      
      // Teleport on Q release
      if (key === 'q') {
        this.entityManager.setSkillTargeting(SkillType.TELEPORT, false);
        this.fireTeleport();
      }
      
      if (e.key === 'Tab') {
        e.preventDefault();
        this.hideTabMenu();
      }
    });
  }

  private sendMovementRequest(target: THREE.Vector3, immediate: boolean = false) {
    if (!this.localPlayerId) return;
    const myPlayer = this.entityManager.getPlayer(this.localPlayerId);
    if (!myPlayer || myPlayer.isDead) return;

    const now = Date.now();

    // Throttle movement requests unless immediate
    if (!immediate && now - this.lastMovementSendTime < this.movementSendInterval) {
      return;
    }

    this.lastMovementSendTime = now;

    // Create click indicator effect (only on first send or immediate)
    if (immediate) {
      this.entityManager.createClickIndicator(target);
    }

    // Client-side prediction: server updates will handle position correction

    // Get mouse position for rotation (player faces cursor)
    const mouseTarget = this.inputManager.getMouseGroundIntersection(
      this.renderer.camera,
      this.groundPlane
    );

    this.networkManager.sendToHost({
      type: 'PLAYER_INPUT',
      input: { keys: this.inputManager.keys, mouse: null },
      destination: { x: target.x, y: target.y, z: target.z },
      mouseTarget: mouseTarget ? { x: mouseTarget.x, y: mouseTarget.y, z: mouseTarget.z } : undefined,
      timestamp: now,
    });
  }

  private handleWASDKeyDown(key: string) {
    if (!this.localPlayerId) return;
    const myPlayer = this.entityManager.getPlayer(this.localPlayerId);
    if (!myPlayer || myPlayer.isDead) return;

    // Update direction based on key
    switch (key) {
      case 'w':
        this.wasdDirection.z = -1;
        break;
      case 's':
        this.wasdDirection.z = 1;
        break;
      case 'a':
        this.wasdDirection.x = -1;
        break;
      case 'd':
        this.wasdDirection.x = 1;
        break;
    }

    this.isWASDMoving = this.wasdDirection.length() > 0;
    this.sendWASDMovement();
  }

  private handleWASDKeyUp(key: string) {
    if (!this.localPlayerId) return;
    const myPlayer = this.entityManager.getPlayer(this.localPlayerId);
    if (!myPlayer || myPlayer.isDead) return;

    // Update direction based on key release
    switch (key) {
      case 'w':
        if (this.wasdDirection.z < 0) this.wasdDirection.z = 0;
        break;
      case 's':
        if (this.wasdDirection.z > 0) this.wasdDirection.z = 0;
        break;
      case 'a':
        if (this.wasdDirection.x < 0) this.wasdDirection.x = 0;
        break;
      case 'd':
        if (this.wasdDirection.x > 0) this.wasdDirection.x = 0;
        break;
    }

    this.isWASDMoving = this.wasdDirection.length() > 0;
    
    if (!this.isWASDMoving) {
      // Stop movement if no keys pressed
      this.stopMovement();
    } else {
      // Continue moving in remaining direction
      this.sendWASDMovement();
    }
  }

  public handleMobileMove(direction: { x: number; z: number }) {
    if (!this.localPlayerId) return;
    const myPlayer = this.entityManager.getPlayer(this.localPlayerId);
    if (!myPlayer || myPlayer.isDead) return;

    // Update WASD direction from mobile joystick
    this.wasdDirection.set(direction.x, 0, direction.z);
    this.isWASDMoving = this.wasdDirection.length() > 0.01;
    
    if (this.isWASDMoving) {
      this.sendWASDMovement();
    }
  }

  public handleMobileStopMove() {
    this.wasdDirection.set(0, 0, 0);
    this.isWASDMoving = false;
    
    // Send stop command
    this.stopMovement();
  }

  public handleMobileSkillPress(skillType: SkillType) {
    switch (skillType) {
      case SkillType.TELEPORT:
        // Show targeting, don't fire yet
        this.entityManager.setSkillTargeting(SkillType.TELEPORT, true);
        break;
      case SkillType.HOMING_MISSILE:
        this.fireHomingMissile();
        break;
      case SkillType.LASER_BEAM:
        this.fireLaserBeam();
        break;
      case SkillType.INVINCIBILITY:
        this.activateInvincibility();
        break;
    }
  }

  public handleMobileSkillRelease(skillType: SkillType) {
    if (skillType === SkillType.TELEPORT) {
      // Hide targeting and fire teleport
      this.entityManager.setSkillTargeting(SkillType.TELEPORT, false);
      this.fireTeleport();
    }
  }

  private sendWASDMovement() {
    if (!this.localPlayerId || !this.isWASDMoving) return;
    const myPlayer = this.entityManager.getPlayer(this.localPlayerId);
    if (!myPlayer || myPlayer.isDead) return;

    const now = Date.now();
    
    // Throttle movement requests
    if (now - this.lastMovementSendTime < this.movementSendInterval) {
      return;
    }

    this.lastMovementSendTime = now;

    // Normalize direction
    const direction = this.wasdDirection.clone().normalize();

    // Get mouse position for rotation (player faces cursor)
    const mouseTarget = this.inputManager.getMouseGroundIntersection(
      this.renderer.camera,
      this.groundPlane
    );

    this.networkManager.sendToHost({
      type: 'PLAYER_INPUT',
      input: { keys: this.inputManager.keys, mouse: null },
      direction: { x: direction.x, y: direction.y, z: direction.z },
      mouseTarget: mouseTarget ? { x: mouseTarget.x, y: mouseTarget.y, z: mouseTarget.z } : undefined,
      timestamp: now,
    });
  }

  private stopMovement() {
    if (!this.localPlayerId) return;
    const myPlayer = this.entityManager.getPlayer(this.localPlayerId);
    if (!myPlayer || myPlayer.isDead) return;

    // Immediately stop local player movement (client-side prediction)
    if (myPlayer) {
      // Set target position to current position to stop interpolation
      myPlayer.targetPosition.copy(myPlayer.mesh.position);
      // Clear velocity
      myPlayer.velocity.set(0, 0, 0);
      // Clear position history to prevent interpolation
      myPlayer.positionHistory = [
        {
          position: myPlayer.mesh.position.clone(),
          timestamp: Date.now(),
        },
      ];
    }

    // Send stop command to server
    this.networkManager.sendToHost({
      type: 'PLAYER_INPUT',
      input: { keys: this.inputManager.keys, mouse: null },
      stopMovement: true,
      timestamp: Date.now(),
    });
  }

  private fireTeleport() {
    if (!this.localPlayerId) return;
    const myPlayer = this.entityManager.getPlayer(this.localPlayerId);
    if (!myPlayer || myPlayer.isDead) return;

    // Hide targeting
    this.entityManager.setSkillTargeting(SkillType.TELEPORT, false);

    // Check cooldown
    const now = Date.now();
    if (now < myPlayer.teleportCooldown) {
      return;
    }

    // Get current mouse position
    const target = this.inputManager.getMouseGroundIntersection(
      this.renderer.camera,
      this.groundPlane
    );
    if (!target) return;

    // Calculate direction from player to mouse
    const playerPos = myPlayer.mesh.position;
    const direction = new THREE.Vector3().subVectors(target, playerPos);
    direction.y = 0;
    const distance = direction.length();

    if (distance < 0.01) {
      // Mouse is too close, teleport forward
      const forward = new THREE.Vector3(0, 0, 1);
      const maxRange = SKILL_CONFIG[SkillType.TELEPORT].range;
      const finalPos = playerPos.clone().add(forward.multiplyScalar(maxRange));

      this.networkManager.sendToHost({
        type: 'SKILL_REQUEST',
        skillType: SkillType.TELEPORT,
        target: { x: finalPos.x, y: finalPos.y, z: finalPos.z },
        timestamp: now,
      });
      return;
    }

    // Normalize direction
    direction.normalize();

    // Clamp to max range
    const maxRange = SKILL_CONFIG[SkillType.TELEPORT].range;
    const clampedDistance = Math.min(distance, maxRange);
    const finalPos = playerPos.clone().add(direction.multiplyScalar(clampedDistance));

    // Send teleport request immediately to mouse position (within range)
    this.networkManager.sendToHost({
      type: 'SKILL_REQUEST',
      skillType: SkillType.TELEPORT,
      target: { x: finalPos.x, y: finalPos.y, z: finalPos.z },
      timestamp: now,
    });

    // Play teleport sound locally
    this.audioManager.playLocalSkillSound(SkillType.TELEPORT);
  }

  private updateTeleportTargeting() {
    if (!this.localPlayerId) return;
    const myPlayer = this.entityManager.getPlayer(this.localPlayerId);
    if (!myPlayer || myPlayer.isDead) return;

    // Check if Q is being held (keyboard) or teleport targeting is active (mobile)
    const isTargeting = this.inputManager.keys['KeyQ'] || 
                       this.inputManager.keys['q'] ||
                       this.entityManager.isTeleportTargeting();
    
    if (!isTargeting) {
      return;
    }

    // Update teleport radius position to follow mouse/touch
    const mouseTarget = this.inputManager.getMouseGroundIntersection(
      this.renderer.camera,
      this.groundPlane
    );
    if (mouseTarget) {
      this.entityManager.updateTeleportRadiusPosition(mouseTarget);
    }
  }

  private fireBasicAttack() {
    if (!this.localPlayerId) return;
    const myPlayer = this.entityManager.getPlayer(this.localPlayerId);
    if (!myPlayer || myPlayer.isDead) return;

    // Check cooldown
    const now = Date.now();
    if (now - this.lastAttackTime < ATTACK_CONFIG.cooldown) {
      return;
    }

    // Get current mouse position to determine attack direction
    const target = this.inputManager.getMouseGroundIntersection(
      this.renderer.camera,
      this.groundPlane
    );
    if (!target) return;

    // Calculate direction from player to mouse
    const playerPos = myPlayer.mesh.position;
    const direction = target.clone().sub(playerPos);
    direction.y = 0;
    direction.normalize();

    // Update local attack time
    this.lastAttackTime = now;

    // Send attack request to server
    this.networkManager.sendToHost({
      type: 'BASIC_ATTACK',
      direction: { x: direction.x, y: direction.y, z: direction.z },
      timestamp: now,
    });

    // TODO: Play attack sound locally
    // this.audioManager.playAttackSound();
  }

  private fireHomingMissile() {
    if (!this.localPlayerId) return;
    const myPlayer = this.entityManager.getPlayer(this.localPlayerId);
    if (!myPlayer || myPlayer.isDead) return;

    // Check cooldown
    const now = Date.now();
    if (now < myPlayer.homingMissileCooldown) {
      return;
    }

    // Get current mouse position
    const target = this.inputManager.getMouseGroundIntersection(
      this.renderer.camera,
      this.groundPlane
    );
    if (!target) return;

    // Fire skill immediately at mouse position
    this.networkManager.sendToHost({
      type: 'SKILL_REQUEST',
      skillType: SkillType.HOMING_MISSILE,
      target: { x: target.x, y: target.y, z: target.z },
      timestamp: now,
    });

    // Play homing missile sound locally
    this.audioManager.playLocalSkillSound(SkillType.HOMING_MISSILE);
  }

  private fireLaserBeam() {
    if (!this.localPlayerId) return;
    const myPlayer = this.entityManager.getPlayer(this.localPlayerId);
    if (!myPlayer || myPlayer.isDead) return;

    // Check cooldown
    const now = Date.now();
    if (now < myPlayer.laserBeamCooldown) {
      return;
    }

    // Get current mouse position
    const target = this.inputManager.getMouseGroundIntersection(
      this.renderer.camera,
      this.groundPlane
    );
    if (!target) return;

    // Calculate direction from player to mouse
    const playerPos = myPlayer.mesh.position;
    const direction = target.clone().sub(playerPos);
    direction.y = 0;
    direction.normalize();

    // Fire skill immediately in mouse direction
    this.networkManager.sendToHost({
      type: 'SKILL_REQUEST',
      skillType: SkillType.LASER_BEAM,
      direction: { x: direction.x, y: direction.y, z: direction.z },
      timestamp: now,
    });

    // Play laser beam sound locally
    this.audioManager.playLocalSkillSound(SkillType.LASER_BEAM);
  }

  private activateInvincibility() {
    if (!this.localPlayerId) return;

    const myPlayer = this.entityManager.getPlayer(this.localPlayerId);
    if (!myPlayer) return;
    if (myPlayer.isDead) return;

    const now = Date.now();
    if (now < myPlayer.invincibilityCooldown) {
      return;
    }

    this.networkManager.sendToHost({
      type: 'SKILL_REQUEST',
      skillType: SkillType.INVINCIBILITY,
      timestamp: Date.now(),
    });

    // Play invincibility sound locally
    this.audioManager.playLocalSkillSound(SkillType.INVINCIBILITY);
  }

  private async handleMessage(message: NetworkMessage) {
    switch (message.type) {
      case 'JOIN_RESPONSE':
        if (message.success && message.mapConfig) {
          this.localPlayerId = message.playerId;
          this.currentMapConfig = message.mapConfig;

          // Show loading overlay
          this.uiManager.showLoading('Loading Resources...');

          // Load map and wait for textures to load
          await this.entityManager.loadMap(message.mapConfig, progress => {
            this.uiManager.updateLoadingProgress(progress);
          });

          // Hide loading overlay
          this.uiManager.hideLoading();

          this.networkManager.sendToHost({
            type: 'STATE_REQUEST',
          });

          this.start();
          this.setupHostActionButtons();
        }
        break;
      case 'GAME_STATE_UPDATE':
        if (this.localPlayerId) {
          this.currentGameState = message.state;
          this.entityManager.updateState(message.state, this.localPlayerId);
          this.uiManager.update(message.state, this.localPlayerId, this.networkManager.isHost);
        }
        break;
      case 'PLAYER_DISCONNECTED_NOTIFICATION':
        // Dispatch event for UI to show notification
        window.dispatchEvent(new CustomEvent('player-disconnected-notification', { 
          detail: { 
            playerId: message.playerId, 
            username: message.username 
          } 
        }));
        break;
      case 'PLAYER_JOINED_NOTIFICATION':
        // Dispatch event for UI to show notification
        window.dispatchEvent(new CustomEvent('player-joined-notification', { 
          detail: { 
            playerId: message.playerId, 
            username: message.username 
          } 
        }));
        break;
    }
  }

  private toggleTabMenu() {
    if (this.onScoreboardToggle) {
      this.onScoreboardToggle();
    } else {
      // Fallback to old DOM-based method
      this.uiManager.showTabMenu();
    }
  }

  private hideTabMenu() {
    if (this.onScoreboardClose) {
      this.onScoreboardClose();
    } else {
      this.uiManager.hideTabMenu();
    }
  }

  private toggleSettingsMenu() {
    if (this.onSettingsToggle) {
      this.onSettingsToggle();
    } else {
      // Fallback to old DOM-based method
      this.uiManager.toggleSettingsMenu();
    }
  }

  private setupHostActionButtons() {
    const startButton = document.getElementById('btn-start-game');
    const restartButton = document.getElementById('btn-restart-game');

    if (startButton) {
      startButton.addEventListener('click', () => {
        if (this.networkManager.isHost) {
          this.networkManager.sendToHost({
            type: 'START_GAME',
          });
        }
      });
    }

    if (restartButton) {
      restartButton.addEventListener('click', () => {
        if (this.networkManager.isHost) {
          this.networkManager.sendToHost({
            type: 'RESTART_GAME',
          });
        }
      });
    }
  }

  public joinGame(_hostId: string) {
    const joinRequest: JoinRequestMessage = {
      type: 'JOIN_REQUEST',
      playerId: this.networkManager.peerId,
    };

    if (this.networkManager.playerName) {
      joinRequest.username = this.networkManager.playerName;
    }

    if (this.networkManager.playerAvatar) {
      joinRequest.avatar = this.networkManager.playerAvatar;
    }

    this.networkManager.sendToHost(joinRequest);
  }

  /**
   * Initialize audio manager early (for menu music)
   */
  public async initAudio(): Promise<void> {
    if (this.audioManager && !this.audioManager['initialized']) {
      try {
        await this.audioManager.init(this.renderer.camera);
      } catch (error) {
        console.error('Failed to initialize audio system:', error);
      }
    }
  }

  public async start() {
    if (this.isRunning) return;
    this.isRunning = true;
    window.dispatchEvent(new CustomEvent('game-started'));
    this.uiManager.showHUD();

    // Initialize audio system if not already initialized
    try {
      if (!this.audioManager['initialized']) {
        await this.audioManager.init(this.renderer.camera);
      }

      // Start playing background music
      this.audioManager.playBackgroundMusic();

      // Set audio manager for settings menu
      this.uiManager.setAudioManager(this.audioManager);
    } catch (error) {
      console.error('Failed to initialize audio system:', error);
    }

    this.animate();
  }

  public stop() {
    this.isRunning = false;
    this.uiManager.hideHUD();

    // Stop and dispose audio resources
    if (this.audioManager) {
      this.audioManager.dispose();
    }
  }

  private animate = () => {
    if (!this.isRunning) return;
    requestAnimationFrame(this.animate);
    const delta = this.clock.getDelta();
    this.update(delta);
    this.renderer.render();
  };

  private update(delta: number) {
    // Limit delta to prevent large jumps (performance optimization)
    const clampedDelta = Math.min(delta, 0.1);
    
    // Send pending movement requests with throttling
    if (this.pendingMovementTarget && this.isLeftMouseDown && !this.isWASDMoving) {
      this.sendMovementRequest(this.pendingMovementTarget, false);
    }

    // Send WASD movement continuously
    if (this.isWASDMoving) {
      this.sendWASDMovement();
    }

    // Apply local prediction so the joining client doesn't wait for server ticks.
    if (this.isWASDMoving) {
      this.entityManager.predictLocalMovement(this.wasdDirection, clampedDelta);
    } else if (this.pendingMovementTarget && this.isLeftMouseDown) {
      this.entityManager.predictLocalMovementTowards(this.pendingMovementTarget, clampedDelta);
    }

    // Update Entities (Interpolation)
    this.entityManager.update(clampedDelta);

    // Update teleport targeting to follow mouse
    this.updateTeleportTargeting();

    // Camera Follow (smooth interpolation)
    if (this.localPlayerId) {
      const localEntity = this.entityManager.getPlayer(this.localPlayerId);
      if (localEntity) {
        // Smooth camera follow with lerp
        const targetX = localEntity.mesh.position.x;
        const targetZ = localEntity.mesh.position.z + CAMERA_CONFIG.DISTANCE;
        
        this.renderer.camera.position.x += (targetX - this.renderer.camera.position.x) * this.cameraLerpFactor;
        this.renderer.camera.position.z += (targetZ - this.renderer.camera.position.z) * this.cameraLerpFactor;
        
        // Clamp camera within arena bounds
        if (this.currentMapConfig) {
          const halfSize = this.currentMapConfig.playableArea.size / 2;
          const cameraOffset = CAMERA_CONFIG.DISTANCE;
          
          // Clamp X position
          this.renderer.camera.position.x = Math.max(
            -halfSize,
            Math.min(halfSize, this.renderer.camera.position.x)
          );
          
          // Clamp Z position (accounting for camera offset)
          this.renderer.camera.position.z = Math.max(
            -halfSize + cameraOffset,
            Math.min(halfSize + cameraOffset, this.renderer.camera.position.z)
          );
        }
        
        this.renderer.camera.lookAt(localEntity.mesh.position);
      }
    }
  }
}
