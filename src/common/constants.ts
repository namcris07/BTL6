export const TICK_RATE = 32;
export const TICK_INTERVAL = 1 / TICK_RATE;

// Game Modes
export const GameMode = {
  WARMUP: 'WARMUP',
  WARMUP_COUNTDOWN: 'WARMUP_COUNTDOWN',
  ROUND: 'ROUND',
  FREEZE_TIME: 'FREEZE_TIME',
  ROUND_END: 'ROUND_END',
  GAME_OVER: 'GAME_OVER',
} as const;

export type GameMode = (typeof GameMode)[keyof typeof GameMode];

// Game Settings
export const GAME_CONFIG = {
  ROUNDS_TO_WIN: 15,
  WARMUP_COUNTDOWN_DURATION: 10000, // 10 seconds
  FREEZE_TIME_DURATION: 5000, // 5 seconds
  ROUND_END_DURATION: 3000, // 3 seconds
  MIN_PLAYERS_TO_START: 2,
  MATCH_TIMER_DURATION: 90000, // 1:30 (90 seconds) in milliseconds
  TARGET_SCORE_MULTIPLIER: 2,
  GAME_OVER_RETURN_DELAY: 10000, // 10 seconds before returning to lobby
};

export const SkillType = {
  TELEPORT: 'TELEPORT',
  HOMING_MISSILE: 'HOMING_MISSILE',
  LASER_BEAM: 'LASER_BEAM',
  INVINCIBILITY: 'INVINCIBILITY',
} as const;

export type SkillType = (typeof SkillType)[keyof typeof SkillType];

// Bot Archetypes
export const BotArchetype = {
  AGGRESSIVE: 'AGGRESSIVE',
  DEFENSIVE: 'DEFENSIVE',
  BALANCED: 'BALANCED',
} as const;

export type BotArchetype = (typeof BotArchetype)[keyof typeof BotArchetype];

// Bot Configuration
export const BOT_CONFIG = {
  THINK_INTERVAL: 300, // ms between AI decisions (increased to reduce aggressiveness)
  SKILL_USE_CHANCE: 0.2, // Base chance to use a skill when available (reduced)
  REACTION_TIME: 200, // ms delay before reacting (increased)
  CHASE_DISTANCE: 25, // Distance to start chasing (increased from 15 to reduce aggressiveness)
  FLEE_DISTANCE: 10, // Distance to start fleeing (slightly increased)
  ATTACK_RANGE: 15, // Range to attempt attacks (slightly increased)
  TELEPORT_ESCAPE_HP_THRESHOLD: 30, // HP threshold to teleport escape
  ITEM_SEARCH_RANGE: 20, // Range to search for items
};

// Item Types
export const ItemType = {
  HEALTH_PACK: 'HEALTH_PACK',
  SPEED_BOOST: 'SPEED_BOOST',
  DAMAGE_BOOST: 'DAMAGE_BOOST',
  SHIELD: 'SHIELD',
} as const;

export type ItemType = (typeof ItemType)[keyof typeof ItemType];

// Item Configuration
export const ITEM_CONFIG = {
  [ItemType.HEALTH_PACK]: {
    healAmount: 50,
    duration: 0, // Instant
    respawnTime: 15000, // 15 seconds
    color: 0x00ff00, // Green
  },
  [ItemType.SPEED_BOOST]: {
    speedMultiplier: 1.5,
    duration: 5000, // 5 seconds
    respawnTime: 20000,
    color: 0x00aaff, // Blue
  },
  [ItemType.DAMAGE_BOOST]: {
    damageMultiplier: 1.5,
    duration: 10000, // 10 seconds
    respawnTime: 25000,
    color: 0xff4400, // Orange-Red
  },
  [ItemType.SHIELD]: {
    blockHits: 2,
    duration: 10000, // 10 seconds or until hit
    respawnTime: 20000,
    color: 0xffff00, // Yellow
  },
};

export const SKILL_CONFIG = {
  [SkillType.TELEPORT]: {
    cooldown: 5000, // 5 seconds
    range: 22,
    castTime: 0,
  },
  [SkillType.HOMING_MISSILE]: {
    cooldown: 5000,
    range: 5,
    duration: 2000, // 3 seconds
    speed: 25,
    damage: 35, // Reduced from 100 to make combat more gradual
    radius: 20, // Activation radius around player
    mouseRadius: 3, // Target selection radius around mouse
  },
  [SkillType.LASER_BEAM]: {
    cooldown: 8000, // 8 seconds
    range: 15, // Max beam length
    lifetime: 800, // Beam stays active for 2 seconds
    damage: 50, // Reduced from 100 to make combat more gradual
    thickness: 0.3, // Beam cylinder radius
  },
  [SkillType.INVINCIBILITY]: {
    cooldown: 10000, // 10 seconds
    duration: 3000, // 3 seconds of invincibility
  },
};

// Basic Attack Configuration
export const ATTACK_CONFIG = {
  damage: 20,
  range: 3, // Melee range
  cooldown: 600, // ms
  animationDuration: 300, // ms - faster spin
  attackAngle: Math.PI * 2, // 360 degrees - full spin attack
};

// Camera Configuration
export const CAMERA_CONFIG = {
  DEFAULT_LERP_FACTOR: 0.1, // Default camera follow speed (0.0-1.0)
  MIN_LERP_FACTOR: 0.01, // Minimum camera follow speed
  MAX_LERP_FACTOR: 0.5, // Maximum camera follow speed
  DISTANCE: 15, // Distance from player
};
