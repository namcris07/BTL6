import { ServerEntityManager } from './ServerEntityManager';
import { NetworkManager } from '../network/NetworkManager';
import { TICK_RATE, TICK_INTERVAL, GameMode, GAME_CONFIG } from '../common/constants';
import type { MapConfig } from '../common/types';
import type { NetworkMessage } from '../common/messages';
import * as THREE from 'three';
import type { ServerPlayer } from './ServerPlayer.ts';

export class GameServer {
  private entityManager: ServerEntityManager;
  private networkManager: NetworkManager;
  private intervalId: number | null = null;
  private mapConfig: MapConfig;

  // Game state
  private gameMode: string = GameMode.WARMUP;
  private currentRound: number = 0;
  private totalRounds: number = GAME_CONFIG.ROUNDS_TO_WIN;
  private freezeTimeEnd: number = 0;
  private winnerId: string | undefined = undefined;
  private roundWinnerId: string | undefined = undefined;
  private playerRespawnEnabled: boolean = true; // In warmup mode, respawn is enabled
  private matchStartTime: number = 0;
  private matchEndTime: number = 0;
  private useTimerMode: boolean = false;
  private targetScore: number = 0;
  private endReason: 'timer' | 'target' | 'rounds' | undefined = undefined;
  private warmupEndTime: number = 0;

  // Offline/Single-player mode
  private isOfflineMode: boolean = false;
  private botCount: number = 0;

  // Lobby management
  private connectedPlayers: Map<string, { id: string; username?: string; isHost: boolean }> = new Map();

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

  private setupNetworkHandlers() {
    // We need a way to intercept messages intended for the server
    // Since NetworkManager is shared, we might need a specific "ServerNetworkAdapter" or similar.
    // For now, let's assume NetworkManager exposes an event or callback for received messages.

    // In the current architecture, NetworkManager dispatches window events.
    // This is browser-specific. The server logic should ideally be environment agnostic but we are running in browser (Host).
    // So we can listen to the same events, but we need to distinguish "Server" handling from "Client" handling.

    window.addEventListener(
      'network-data',
      (e: CustomEvent<{ from: string; data: NetworkMessage }>) => {
        if (!this.networkManager.isHost) return; // Only Host runs the server

        const { from, data } = e.detail;
        this.handleMessage(from, data);
      }
    );

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
  }

  private handleMessage(playerId: string, message: NetworkMessage) {
    switch (message.type) {
      case 'JOIN_REQUEST': {
        // Handle join (actually PeerJS handles connection, this might be application level handshake)
        // For now, we assume connection = join.
        // But if we have a specific JOIN_REQUEST message:
        const player = this.entityManager.addPlayer(playerId);
        const isHost = playerId === this.networkManager.peerId;

        // Set player username if available
        if (message.username) {
          player.username = message.username;
        } else if (isHost && this.networkManager.playerName) {
          // If this is the host player, use their player name
          player.username = this.networkManager.playerName;
        }

        // Set player avatar if available (for future use)
        if (message.avatar) {
          player.avatar = message.avatar;
        }

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

        // Notify all OTHER players about the new player joining (don't notify the joining player)
        // We need to broadcast to everyone except the new player
        const otherPlayers = Array.from(this.connectedPlayers.keys()).filter(id => id !== playerId);
        otherPlayers.forEach(otherPlayerId => {
          this.networkManager.sendToClient(otherPlayerId, {
            type: 'PLAYER_JOINED_NOTIFICATION',
            playerId: playerId,
            username: player.username
          });
        });

        // Broadcast updated player list to all clients
        this.broadcastPlayerList();
        break;
      }

      case 'PLAYER_LIST_REQUEST': {
        // Send current player list
        this.sendPlayerList(playerId);
        break;
      }

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

      case 'START_GAME':
        if (this.networkManager.isHost && playerId === this.networkManager.peerId) {
          // Enable timer mode by default
          this.startGame(true);
        }
        break;

      case 'RESTART_GAME':
        if (this.networkManager.isHost && playerId === this.networkManager.peerId) {
          this.restartGame();
        }
        break;

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

          if (message.stopMovement) {
            p.stopMovement();
          } else if (message.direction) {
            // WASD direction-based movement
            p.setMovementDirection(
              new THREE.Vector3(message.direction.x, message.direction.y, message.direction.z)
            );
          } else if (message.destination) {
            // Click-to-move destination-based movement
            p.setDestination(
              new THREE.Vector3(message.destination.x, message.destination.y, message.destination.z)
            );
          }
        } else {
          console.warn(`Player ${playerId} not found for input`);
        }
        break;
      }

      case 'BASIC_ATTACK': {
        const attackingPlayer = this.entityManager.getPlayer(playerId);
        if (attackingPlayer && message.direction) {
          // Perform the attack and get list of hit players
          attackingPlayer.performAttack(
            message.direction,
            this.entityManager.getPlayers()
          );
          // State will be broadcast in next tick
        }
        break;
      }

      case 'SKILL_REQUEST': {
        const sp = this.entityManager.getPlayer(playerId);
        if (sp) {
          if (message.skillType === 'TELEPORT' && message.target) {
            sp.attemptTeleport(
              new THREE.Vector3(message.target.x, message.target.y, message.target.z),
              this.entityManager.getObstacles(),
              this.entityManager.getPlayers()
            );
          } else if (message.skillType === 'HOMING_MISSILE' && message.target) {
            sp.attemptHomingMissile(
              new THREE.Vector3(message.target.x, message.target.y, message.target.z),
              this.entityManager
            );
          } else if (message.skillType === 'LASER_BEAM' && message.direction) {
            sp.attemptLaserBeam(message.direction, this.entityManager);
          } else if (message.skillType === 'INVINCIBILITY') {
            sp.attemptInvincibility();
          }
          // Handle other skills
        }
        break;
      }

      case 'STATE_REQUEST': {
        const baseState = this.entityManager.getState();
        const state = {
          ...baseState,
          gameMode: this.gameMode,
          currentRound: this.currentRound,
          totalRounds: this.totalRounds,
          freezeTimeEnd: this.freezeTimeEnd > 0 ? this.freezeTimeEnd : undefined,
          winnerId: this.winnerId,
          roundWinnerId: this.roundWinnerId,
        };
        this.networkManager.sendToClient(playerId, {
          type: 'GAME_STATE_UPDATE',
          state: state,
          timestamp: Date.now(),
        });
        break;
      }
    }
  }

  public start() {
    if (this.intervalId) return;

    // Add Host Player
    const hostPlayer = this.entityManager.addPlayer(this.networkManager.peerId);
    
    // Add host to connected players list
    this.connectedPlayers.set(this.networkManager.peerId, {
      id: this.networkManager.peerId,
      username: hostPlayer.username || this.networkManager.playerName || 'Host',
      isHost: true,
    });
    
    // Broadcast player list immediately so host sees themselves
    this.broadcastPlayerList();

    // Spawn bots if in offline mode
    if (this.isOfflineMode && this.botCount > 0) {
      for (let i = 0; i < this.botCount; i++) {
        this.entityManager.addBot();
      }
    }

    this.intervalId = setInterval(() => {
      this.tick();
    }, 1000 / TICK_RATE);
  }

  public stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  private tick() {
    this.updateGameState();
    this.entityManager.update(TICK_INTERVAL, this.gameMode);

    // Calculate match duration if match is active
    let matchDuration = 0;
    if (this.matchStartTime > 0 && this.gameMode === GameMode.ROUND) {
      matchDuration = Date.now() - this.matchStartTime;
    } else if (this.matchStartTime > 0 && this.gameMode === GameMode.GAME_OVER) {
      // Use final duration when game is over
      matchDuration = (this.matchEndTime || Date.now()) - this.matchStartTime;
    }

    const state = {
      ...this.entityManager.getState(),
      gameMode: this.gameMode,
      currentRound: this.currentRound,
      totalRounds: this.totalRounds,
      freezeTimeEnd: this.freezeTimeEnd > 0 ? this.freezeTimeEnd : undefined,
      winnerId: this.winnerId,
      roundWinnerId: this.roundWinnerId,
      matchStartTime: this.matchStartTime > 0 ? this.matchStartTime : undefined,
      matchEndTime: this.matchEndTime > 0 ? this.matchEndTime : undefined,
      matchDuration: matchDuration > 0 ? matchDuration : undefined,
      useTimerMode: this.useTimerMode,
      targetScore: this.targetScore > 0 ? this.targetScore : undefined,
      endReason: this.endReason,
      warmupEndTime: this.warmupEndTime > 0 ? this.warmupEndTime : undefined,
    };

    this.networkManager.broadcast({
      type: 'GAME_STATE_UPDATE',
      state: state,
      timestamp: Date.now(),
    });
  }

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

    // Handle player respawn in warmup, warmup countdown and round mode
    if ((this.gameMode === GameMode.WARMUP || this.gameMode === GameMode.WARMUP_COUNTDOWN || this.gameMode === GameMode.ROUND) && this.playerRespawnEnabled) {
      this.entityManager.getPlayers().forEach(player => {
        if (player.isDead) {
          // Respawn player after 3 seconds
          if (!player.respawnTime) {
            player.respawnTime = now + 3000; // 3 seconds
          } else if (now >= player.respawnTime) {
            this.respawnPlayer(player);
          }
        }
      });
    }

    // Check target score win condition
    if (this.targetScore > 0 && this.gameMode === GameMode.ROUND) {
      const players = this.entityManager.getPlayers();
      for (const player of players) {
        if ((player.kills || 0) >= this.targetScore) {
          // Player reached target score
          this.gameMode = GameMode.GAME_OVER;
          this.winnerId = player.id;
          this.matchEndTime = now;
          this.endReason = 'target';
          this.freezeTimeEnd = now + GAME_CONFIG.GAME_OVER_RETURN_DELAY;
          return;
        }
      }
    }

    // Check timer-based game end
    if (this.useTimerMode && this.gameMode === GameMode.ROUND && now >= this.matchEndTime) {
      // Timer expired - determine winner by kills
      const players = this.entityManager.getPlayers();
      let winner = players[0];
      let maxKills = winner.kills || 0;

      for (const player of players) {
        if ((player.kills || 0) > maxKills) {
          maxKills = player.kills || 0;
          winner = player;
        }
      }

      this.gameMode = GameMode.GAME_OVER;
      this.winnerId = winner.id;
      this.endReason = 'timer';
      this.freezeTimeEnd = now + GAME_CONFIG.GAME_OVER_RETURN_DELAY;
      return;
    }

    // Disabled round-based logic - game uses timer/target score only
    // When timer ends or target reached, game ends immediately

    // User must manually return to lobby via ResultsScreen button
  }

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
          // Set position to spawn point
          player.position.set(spawnPos.x, 0, spawnPos.y);
        }
      }
    });
  }

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
    // this.gameMode = GameMode.FREEZE_TIME;
    // this.freezeTimeEnd = Date.now() + GAME_CONFIG.FREEZE_TIME_DURATION;
    this.useTimerMode = useTimer;
    this.currentRound = 1;
    this.playerRespawnEnabled = true; // Enable respawn in round mode
    this.endReason = undefined;
    
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

  public setWarmupEndTime(endTime: number) {
    this.warmupEndTime = endTime;
  }

  public restartGame() {
    this.gameMode = GameMode.WARMUP;
    this.currentRound = 0;
    this.playerRespawnEnabled = true;
    this.winnerId = undefined;
    this.roundWinnerId = undefined;
    this.matchStartTime = 0;
    this.matchEndTime = 0;
    this.targetScore = 0;
    this.endReason = undefined;
    this.warmupEndTime = 0;

    // Reset all players
    this.entityManager.getPlayers().forEach(player => {
      player.reset();
      player.isFrozen = false;
      player.kills = 0;
      player.deaths = 0;
      player.lastPlayerAlive = 0;
    });

    return true;
  }

  private respawnPlayer(player: ServerPlayer) {
    // Find a spawn point
    const spawnIndex = this.entityManager.getSpawnPointForPlayer(player.id);
    if (spawnIndex !== -1) {
      const spawnPos = this.entityManager.getSpawnPosition(spawnIndex);
      if (spawnPos) {
        // Reset player
        player.reset();
        // Set position to spawn point
        player.position.set(spawnPos.x, 0, spawnPos.y);
        player.respawnTime = 0;
      }
    }
  }

  private sendPlayerList(toPlayerId: string) {
    // Include all players from entity manager (including host)
    const playersList: Array<{ id: string; username?: string; isHost: boolean }> = [];
    
    // Add all connected players
    this.connectedPlayers.forEach((playerInfo) => {
      playersList.push(playerInfo);
    });
    
    // Also add players from entity manager that might not be in connectedPlayers yet
    this.entityManager.getPlayers().forEach(player => {
      if (!playersList.find(p => p.id === player.id)) {
        const isHost = player.id === this.networkManager.peerId;
        playersList.push({
          id: player.id,
          username: player.username,
          isHost,
        });
      }
    });
    
    this.networkManager.sendToClient(toPlayerId, {
      type: 'PLAYER_LIST_UPDATE',
      players: playersList,
    });
  }

  private broadcastPlayerList() {
    // Include all players from entity manager (including host)
    const playersList: Array<{ id: string; username?: string; isHost: boolean }> = [];
    
    // Add all connected players
    this.connectedPlayers.forEach((playerInfo) => {
      playersList.push(playerInfo);
    });
    
    // Also add players from entity manager that might not be in connectedPlayers yet
    this.entityManager.getPlayers().forEach(player => {
      if (!playersList.find(p => p.id === player.id)) {
        const isHost = player.id === this.networkManager.peerId;
        playersList.push({
          id: player.id,
          username: player.username,
          isHost,
        });
      }
    });
    
    this.networkManager.broadcast({
      type: 'PLAYER_LIST_UPDATE',
      players: playersList,
    });
  }
}
