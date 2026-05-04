import type { BotBrain } from './BotBrain';
import { AggressiveBot } from './AggressiveBot';
import { DefensiveBot } from './DefensiveBot';
import { BalancedBot } from './BalancedBot';
import { BotArchetype } from '../../common/constants';

/**
 * Factory for creating bot brains based on archetype
 */
export class BotFactory {
  private static archetypes: Map<BotArchetype, () => BotBrain> = new Map([
    [BotArchetype.AGGRESSIVE, () => new AggressiveBot()],
    [BotArchetype.DEFENSIVE, () => new DefensiveBot()],
    [BotArchetype.BALANCED, () => new BalancedBot()],
  ]);

  /**
   * Creates a bot brain for the given archetype
   */
  static createBrain(archetype: BotArchetype): BotBrain {
    const factory = this.archetypes.get(archetype);
    if (!factory) {
      // Default to balanced if unknown archetype
      return new BalancedBot();
    }
    return factory();
  }

  /**
   * Creates a random bot brain
   */
  static createRandomBrain(): BotBrain {
    const archetypes = [BotArchetype.AGGRESSIVE, BotArchetype.DEFENSIVE, BotArchetype.BALANCED];
    const randomArchetype = archetypes[Math.floor(Math.random() * archetypes.length)];
    return this.createBrain(randomArchetype);
  }

  /**
   * Creates a weighted random bot brain
   * @param weights Object with archetype weights (higher = more likely)
   */
  static createWeightedRandomBrain(weights: Partial<Record<BotArchetype, number>>): BotBrain {
    const defaultWeights: Record<BotArchetype, number> = {
      [BotArchetype.AGGRESSIVE]: 1,
      [BotArchetype.DEFENSIVE]: 1,
      [BotArchetype.BALANCED]: 1,
    };

    const mergedWeights = { ...defaultWeights, ...weights };
    const totalWeight = Object.values(mergedWeights).reduce((sum, w) => sum + w, 0);
    let random = Math.random() * totalWeight;

    for (const [archetype, weight] of Object.entries(mergedWeights)) {
      random -= weight;
      if (random <= 0) {
        return this.createBrain(archetype as BotArchetype);
      }
    }

    return new BalancedBot();
  }
}

