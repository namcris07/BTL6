import type { InputState, GameState, Vector3, MapConfig } from './types';
import { SkillType } from './constants';

export type MessageType =
  | 'JOIN_REQUEST'
  | 'JOIN_RESPONSE'
  | 'PLAYER_INPUT'
  | 'GAME_STATE_UPDATE'
  | 'SKILL_REQUEST'
  | 'BASIC_ATTACK'
  | 'STATE_REQUEST'
  | 'PLAYER_DIED'
  | 'START_GAME'
  | 'RESTART_GAME'
  | 'KICK_PLAYER'
  | 'PLAYER_LIST_REQUEST'
  | 'PLAYER_LIST_UPDATE'
  | 'SPAWN_POINTS_REQUEST' // Legacy, might remove
  | 'SPAWN_POINT_RESPONSE' // Legacy, might remove
  | 'MAP_CONFIG'
  | 'HOST_DISCONNECTED'
  | 'PLAYER_DISCONNECTED_NOTIFICATION'
  | 'PLAYER_JOINED_NOTIFICATION';

export interface BaseMessage {
  type: MessageType;
}

export interface JoinRequestMessage extends BaseMessage {
  type: 'JOIN_REQUEST';
  playerId: string;
  username?: string;
  avatar?: string;
}

export interface JoinResponseMessage extends BaseMessage {
  type: 'JOIN_RESPONSE';
  success: boolean;
  mapConfig?: MapConfig;
  playerId: string;
  spawnPosition: Vector3;
}

export interface InputMessage extends BaseMessage {
  type: 'PLAYER_INPUT';
  input: InputState;
  destination?: Vector3;
  direction?: Vector3; // For WASD movement
  mouseTarget?: Vector3; // For mouse look/aim
  stopMovement?: boolean;
  timestamp?: number;
}

export interface StateUpdateMessage extends BaseMessage {
  type: 'GAME_STATE_UPDATE';
  state: GameState;
  timestamp: number;
}

export interface SkillRequestMessage extends BaseMessage {
  type: 'SKILL_REQUEST';
  skillType: SkillType;
  target?: Vector3;
  direction?: Vector3; // For directional skills like laser beam
  timestamp: number;
}

export interface BasicAttackMessage extends BaseMessage {
  type: 'BASIC_ATTACK';
  direction: Vector3;
  timestamp: number;
}

export interface StateRequestMessage extends BaseMessage {
  type: 'STATE_REQUEST';
}

export interface PlayerDiedMessage extends BaseMessage {
  type: 'PLAYER_DIED';
  id: string;
}

export interface StartGameMessage extends BaseMessage {
  type: 'START_GAME';
}

export interface RestartGameMessage extends BaseMessage {
  type: 'RESTART_GAME';
}

export interface KickPlayerMessage extends BaseMessage {
  type: 'KICK_PLAYER';
  playerId: string;
}

export interface PlayerListRequestMessage extends BaseMessage {
  type: 'PLAYER_LIST_REQUEST';
}

export interface PlayerListUpdateMessage extends BaseMessage {
  type: 'PLAYER_LIST_UPDATE';
  players: Array<{ id: string; username?: string; isHost: boolean }>;
}

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

export type NetworkMessage =
  | JoinRequestMessage
  | JoinResponseMessage
  | InputMessage
  | StateUpdateMessage
  | SkillRequestMessage
  | BasicAttackMessage
  | StateRequestMessage
  | PlayerDiedMessage
  | StartGameMessage
  | RestartGameMessage
  | KickPlayerMessage
  | PlayerListRequestMessage
  | PlayerListUpdateMessage
  | HostDisconnectedMessage
  | PlayerDisconnectedNotificationMessage
  | PlayerJoinedNotificationMessage;
