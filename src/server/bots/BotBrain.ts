import type * as THREE from 'three';
import type { SkillType } from '../../common/constants';
import type { ServerBot } from '../ServerBot';
import type { ServerEntityManager } from '../ServerEntityManager';

export interface BotAction {
  type: 'MOVE' | 'USE_SKILL' | 'IDLE' | 'STOP';
  target?: THREE.Vector3;
  skillType?: SkillType;
  direction?: THREE.Vector3; // For laser beam
}

export interface BotBrain {
  /**
   * Makes a decision about what action the bot should take
   * @param bot The bot making the decision
   * @param entityManager The entity manager for game state
   * @returns The action to perform
   */
  think(bot: ServerBot, entityManager: ServerEntityManager): BotAction;

  /**
   * Gets the archetype name for this brain
   */
  getArchetype(): string;
}

