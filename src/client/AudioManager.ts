import * as THREE from 'three';
import { SkillType } from '../common/constants';

// Default audio settings
const DEFAULT_SFX_VOLUME = 1.0; // 100%
const DEFAULT_BGM_VOLUME = 1.0; // 100%
const SFX_MASTER_GAIN = 0.8; // 30% scaling factor, takes 30% of the actual sound
const BGM_MASTER_GAIN = 0.8; // 20% scaling factor, takes 20% of the actual sound
const STORAGE_KEY_SFX_VOLUME = 'sfx_volume';
const STORAGE_KEY_BGM_VOLUME = 'bgm_volume';
const STORAGE_KEY_SFX_MUTED = 'sfx_muted';
const STORAGE_KEY_BGM_MUTED = 'bgm_muted';

/**
 * AudioManager handles 3D audio sources and listeners for the game
 */
export class AudioManager {
  private listener: THREE.AudioListener;
  private camera!: THREE.Camera;
  private soundMap: Map<string, THREE.Audio | THREE.PositionalAudio>;
  private skillSounds: Map<SkillType, AudioBuffer>;
  private initialized: boolean = false;
  private audioLoader: THREE.AudioLoader;

  // Background music
  private bgmSound: THREE.Audio | null = null;
  private bgmBuffer: AudioBuffer | null = null;
  
  // Menu and victory music
  private menuMusicBuffer: AudioBuffer | null = null;
  private victoryMusicBuffer: AudioBuffer | null = null;
  private menuMusicSound: THREE.Audio | null = null;

  // Pickup sound effect
  private pickupSoundBuffer: AudioBuffer | null = null;

  // Respawn sound effect
  private respawnSoundBuffer: AudioBuffer | null = null;

  // Damage and death sound effects
  private damageSoundBuffer: AudioBuffer | null = null;
  private deathSoundBuffer: AudioBuffer | null = null;

  // Volume settings
  private sfxVolume: number = DEFAULT_SFX_VOLUME;
  private bgmVolume: number = DEFAULT_BGM_VOLUME;
  private sfxMuted: boolean = false;
  private bgmMuted: boolean = false;

  constructor() {
    this.listener = new THREE.AudioListener();
    this.soundMap = new Map();
    this.skillSounds = new Map();
    this.audioLoader = new THREE.AudioLoader();
    this.loadSettings();
  }

  /**
   * Initialize the AudioManager with the camera
   * @param camera The camera to attach the audio listener to
   */
  public init(camera: THREE.Camera): Promise<void> {
    this.camera = camera;
    this.camera.add(this.listener);

    return this.loadSounds().then(() => {
      this.initialized = true;
    });
  }

  /**
   * Load all skill sound effects and background music
   */
  private loadSounds(): Promise<void> {
    const soundPromises: Promise<void>[] = [
      this.loadSound(SkillType.TELEPORT, '/resources/sfx/teleport.mp3'),
      this.loadSound(SkillType.HOMING_MISSILE, '/resources/sfx/missile.mp3'),
      this.loadSound(SkillType.LASER_BEAM, '/resources/sfx/laser.mp3'),
      this.loadSound(SkillType.INVINCIBILITY, '/resources/sfx/shield.mp3'),
      this.loadBackgroundMusic('/resources/bgm/bgm0001.mp3'),
      this.loadMenuMusic('/resources/bgm/main-menu.mp3'),
      this.loadVictoryMusic('/resources/bgm/victory.mp3'),
      this.loadPickupSound('/resources/sfx/power-up.mp3'),
      this.loadRespawnSound('/resources/sfx/respawn.mp3'),
      this.loadDamageSound('/resources/sfx/bump.ogg'),
      this.loadDeathSound('/resources/sfx/dead-sound.mp3'),
    ];

    return Promise.all(soundPromises).then(() => {});
  }

  /**
   * Load settings from local storage
   */
  private loadSettings(): void {
    const savedSfxVolume = localStorage.getItem(STORAGE_KEY_SFX_VOLUME);
    const savedBgmVolume = localStorage.getItem(STORAGE_KEY_BGM_VOLUME);
    const savedSfxMuted = localStorage.getItem(STORAGE_KEY_SFX_MUTED);
    const savedBgmMuted = localStorage.getItem(STORAGE_KEY_BGM_MUTED);

    if (savedSfxVolume !== null) {
      this.sfxVolume = parseFloat(savedSfxVolume);
    }

    if (savedBgmVolume !== null) {
      this.bgmVolume = parseFloat(savedBgmVolume);
    }

    if (savedSfxMuted !== null) {
      this.sfxMuted = savedSfxMuted === 'true';
    }

    if (savedBgmMuted !== null) {
      this.bgmMuted = savedBgmMuted === 'true';
    }
  }

  /**
   * Save settings to local storage
   */
  private saveSettings(): void {
    localStorage.setItem(STORAGE_KEY_SFX_VOLUME, this.sfxVolume.toString());
    localStorage.setItem(STORAGE_KEY_BGM_VOLUME, this.bgmVolume.toString());
    localStorage.setItem(STORAGE_KEY_SFX_MUTED, this.sfxMuted.toString());
    localStorage.setItem(STORAGE_KEY_BGM_MUTED, this.bgmMuted.toString());
  }

  /**
   * Load background music
   * @param path The path to the music file
   */
  private loadBackgroundMusic(path: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.audioLoader.load(
        path,
        buffer => {
          this.bgmBuffer = buffer;
          resolve();
        },
        undefined,
        error => {
          console.error(`Error loading background music ${path}:`, error);
          reject(error);
        }
      );
    });
  }

  /**
   * Load menu music
   * @param path The path to the music file
   */
  private loadMenuMusic(path: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.audioLoader.load(
        path,
        buffer => {
          this.menuMusicBuffer = buffer;
          resolve();
        },
        undefined,
        error => {
          console.error(`Error loading menu music ${path}:`, error);
          reject(error);
        }
      );
    });
  }

  /**
   * Load victory music
   * @param path The path to the music file
   */
  private loadVictoryMusic(path: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.audioLoader.load(
        path,
        buffer => {
          this.victoryMusicBuffer = buffer;
          resolve();
        },
        undefined,
        error => {
          console.error(`Error loading victory music ${path}:`, error);
          reject(error);
        }
      );
    });
  }

  /**
   * Load a sound file and store it in the skillSounds map
   * @param skillType The skill type
   * @param path The path to the sound file
   */
  private loadSound(skillType: SkillType, path: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.audioLoader.load(
        path,
        buffer => {
          this.skillSounds.set(skillType, buffer);
          resolve();
        },
        undefined,
        error => {
          console.error(`Error loading sound ${path}:`, error);
          reject(error);
        }
      );
    });
  }

  /**
   * Load pickup sound effect
   * @param path The path to the sound file
   */
  private loadPickupSound(path: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.audioLoader.load(
        path,
        buffer => {
          this.pickupSoundBuffer = buffer;
          resolve();
        },
        undefined,
        error => {
          console.error(`Error loading pickup sound ${path}:`, error);
          reject(error);
        }
      );
    });
  }

  /**
   * Load respawn sound effect
   * @param path The path to the sound file
   */
  private loadRespawnSound(path: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.audioLoader.load(
        path,
        buffer => {
          this.respawnSoundBuffer = buffer;
          resolve();
        },
        undefined,
        error => {
          console.error(`Error loading respawn sound ${path}:`, error);
          reject(error);
        }
      );
    });
  }

  /**
   * Load damage sound effect
   * @param path The path to the sound file
   */
  private loadDamageSound(path: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.audioLoader.load(
        path,
        buffer => {
          this.damageSoundBuffer = buffer;
          resolve();
        },
        undefined,
        error => {
          console.error(`Error loading damage sound ${path}:`, error);
          reject(error);
        }
      );
    });
  }

  /**
   * Load death sound effect
   * @param path The path to the sound file
   */
  private loadDeathSound(path: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.audioLoader.load(
        path,
        buffer => {
          this.deathSoundBuffer = buffer;
          resolve();
        },
        undefined,
        error => {
          console.error(`Error loading death sound ${path}:`, error);
          reject(error);
        }
      );
    });
  }

  /**
   * Play a skill sound at a specific position in 3D space
   * @param skillType The skill type
   * @param position The position to play the sound at
   * @param volume The volume of the sound (0.0 to 1.0)
   * @returns The PositionalAudio object
   */
  public playSkillSoundAt(
    skillType: SkillType,
    position: THREE.Vector3,
    volume: number = 1.0
  ): THREE.PositionalAudio | null {
    if (!this.initialized || !this.skillSounds.has(skillType)) {
      console.warn(`Sound for skill ${skillType} not loaded`);
      return null;
    }

    const buffer = this.skillSounds.get(skillType);
    if (!buffer) return null;

    // Calculate effective volume
    const effectiveVolume = this.sfxMuted ? 0 : this.sfxVolume * SFX_MASTER_GAIN;

    // If volume is effectively zero, don't play anything
    if (effectiveVolume <= 0.0001) {
      return null;
    }

    // Create a positional audio source
    const sound = new THREE.PositionalAudio(this.listener);
    sound.setBuffer(buffer);

    // Apply SFX volume setting
    sound.setVolume(volume * effectiveVolume);

    sound.setRefDistance(5); // Distance at which the volume is reduced by half
    sound.setMaxDistance(100); // Max distance at which the sound can be heard
    sound.setRolloffFactor(1); // How quickly the volume decreases with distance
    sound.setDistanceModel('inverse'); // Linear, inverse, or exponential

    // Create a dummy object to position the sound
    const soundObject = new THREE.Object3D();
    soundObject.position.copy(position);
    soundObject.add(sound);

    // Add to scene temporarily
    this.camera.parent?.add(soundObject);

    // Play the sound
    sound.play();

    // Remove from scene when done playing
    sound.onEnded = () => {
      this.camera.parent?.remove(soundObject);
    };

    return sound;
  }

  /**
   * Play a skill sound from the local player's perspective
   * @param skillType The skill type
   * @param volume The volume of the sound (0.0 to 1.0)
   * @returns The Audio object
   */
  public playLocalSkillSound(skillType: SkillType, volume: number = 1.0): THREE.Audio | null {
    if (!this.initialized || !this.skillSounds.has(skillType)) {
      console.warn(`Sound for skill ${skillType} not loaded`);
      return null;
    }

    const buffer = this.skillSounds.get(skillType);
    if (!buffer) return null;

    // Calculate effective volume
    const effectiveVolume = this.sfxMuted ? 0 : this.sfxVolume * SFX_MASTER_GAIN;

    // If volume is effectively zero, don't play anything
    if (effectiveVolume <= 0.0001) {
      return null;
    }

    // Create a non-positional audio source (plays at full volume regardless of position)
    const sound = new THREE.Audio(this.listener);
    sound.setBuffer(buffer);

    // Apply SFX volume setting
    sound.setVolume(volume * effectiveVolume);

    sound.play();

    return sound;
  }

  /**
   * Play pickup sound effect
   * @param volume The volume of the sound (0.0 to 1.0)
   * @returns The Audio object
   */
  public playPickupSound(volume: number = 1.0): THREE.Audio | null {
    if (!this.initialized || !this.pickupSoundBuffer) {
      console.warn('Pickup sound not loaded');
      return null;
    }

    // Calculate effective volume
    const effectiveVolume = this.sfxMuted ? 0 : this.sfxVolume * SFX_MASTER_GAIN;

    // If volume is effectively zero, don't play anything
    if (effectiveVolume <= 0.0001) {
      return null;
    }

    // Create a non-positional audio source (plays at full volume regardless of position)
    const sound = new THREE.Audio(this.listener);
    sound.setBuffer(this.pickupSoundBuffer);

    // Apply SFX volume setting
    sound.setVolume(volume * effectiveVolume);

    sound.play();

    return sound;
  }

  /**
   * Play respawn sound effect
   * @param volume The volume of the sound (0.0 to 1.0)
   * @returns The Audio object
   */
  public playRespawnSound(volume: number = 1.0): THREE.Audio | null {
    if (!this.initialized || !this.respawnSoundBuffer) {
      console.warn('Respawn sound not loaded');
      return null;
    }

    // Calculate effective volume
    const effectiveVolume = this.sfxMuted ? 0 : this.sfxVolume * SFX_MASTER_GAIN;

    // If volume is effectively zero, don't play anything
    if (effectiveVolume <= 0.0001) {
      return null;
    }

    // Create a non-positional audio source (plays at full volume regardless of position)
    const sound = new THREE.Audio(this.listener);
    sound.setBuffer(this.respawnSoundBuffer);

    // Apply SFX volume setting
    sound.setVolume(volume * effectiveVolume);

    sound.play();

    return sound;
  }

  /**
   * Play damage sound effect
   * @param volume The volume of the sound (0.0 to 1.0)
   * @returns The Audio object
   */
  public playDamageSound(volume: number = 1.0): THREE.Audio | null {
    if (!this.initialized || !this.damageSoundBuffer) {
      console.warn('Damage sound not loaded');
      return null;
    }

    // Calculate effective volume
    const effectiveVolume = this.sfxMuted ? 0 : this.sfxVolume * SFX_MASTER_GAIN;

    // If volume is effectively zero, don't play anything
    if (effectiveVolume <= 0.0001) {
      return null;
    }

    // Create a non-positional audio source (plays at full volume regardless of position)
    const sound = new THREE.Audio(this.listener);
    sound.setBuffer(this.damageSoundBuffer);

    // Apply SFX volume setting
    sound.setVolume(volume * effectiveVolume);

    sound.play();

    return sound;
  }

  /**
   * Play death sound effect
   * @param volume The volume of the sound (0.0 to 1.0)
   * @returns The Audio object
   */
  public playDeathSound(volume: number = 1.0): THREE.Audio | null {
    if (!this.initialized || !this.deathSoundBuffer) {
      console.warn('Death sound not loaded');
      return null;
    }

    // Calculate effective volume
    const effectiveVolume = this.sfxMuted ? 0 : this.sfxVolume * SFX_MASTER_GAIN;

    // If volume is effectively zero, don't play anything
    if (effectiveVolume <= 0.0001) {
      return null;
    }

    // Create a non-positional audio source (plays at full volume regardless of position)
    const sound = new THREE.Audio(this.listener);
    sound.setBuffer(this.deathSoundBuffer);

    // Apply SFX volume setting
    sound.setVolume(volume * effectiveVolume);

    sound.play();

    return sound;
  }

  /**
   * Play background music
   * @returns The Audio object
   */
  public playBackgroundMusic(): THREE.Audio | null {
    if (!this.initialized || !this.bgmBuffer) {
      console.warn('Background music not loaded');
      return null;
    }

    // Stop existing BGM if playing
    this.stopBackgroundMusic();

    // Create a non-positional audio source for BGM
    this.bgmSound = new THREE.Audio(this.listener);
    this.bgmSound.setBuffer(this.bgmBuffer);
    const effectiveVolume = this.bgmMuted ? 0 : this.bgmVolume * BGM_MASTER_GAIN;
    this.bgmSound.setVolume(effectiveVolume);
    this.bgmSound.setLoop(true); // Loop the background music
    this.bgmSound.play();

    return this.bgmSound;
  }

  /**
   * Stop background music
   */
  public stopBackgroundMusic(): void {
    if (this.bgmSound) {
      this.bgmSound.stop();
      this.bgmSound = null;
    }
  }

  /**
   * Play menu music
   * @returns The Audio object
   */
  public playMenuMusic(): THREE.Audio | null {
    console.log('playMenuMusic called', {
      initialized: this.initialized,
      hasBuffer: !!this.menuMusicBuffer,
      bgmMuted: this.bgmMuted,
      bgmVolume: this.bgmVolume
    });
    
    if (!this.initialized) {
      console.warn('AudioManager not initialized yet');
      return null;
    }
    
    if (!this.menuMusicBuffer) {
      console.warn('Menu music buffer not loaded');
      return null;
    }

    // Stop existing menu music if playing
    this.stopMenuMusic();

    try {
      // Create a non-positional audio source for menu music
      this.menuMusicSound = new THREE.Audio(this.listener);
      this.menuMusicSound.setBuffer(this.menuMusicBuffer);
      const effectiveVolume = this.bgmMuted ? 0 : this.bgmVolume * BGM_MASTER_GAIN;
      this.menuMusicSound.setVolume(effectiveVolume);
      this.menuMusicSound.setLoop(true); // Loop the menu music
      this.menuMusicSound.play();
      
      console.log('Menu music playing', { effectiveVolume });
      return this.menuMusicSound;
    } catch (error) {
      console.error('Error playing menu music:', error);
      return null;
    }
  }

  /**
   * Stop menu music
   */
  public stopMenuMusic(): void {
    if (this.menuMusicSound) {
      this.menuMusicSound.stop();
      this.menuMusicSound = null;
    }
  }

  /**
   * Play victory music
   * @returns The Audio object
   */
  public playVictoryMusic(): THREE.Audio | null {
    if (!this.initialized || !this.victoryMusicBuffer) {
      console.warn('Victory music not loaded');
      return null;
    }

    // Stop existing BGM if playing
    this.stopBackgroundMusic();

    // Create a non-positional audio source for victory music
    const victorySound = new THREE.Audio(this.listener);
    victorySound.setBuffer(this.victoryMusicBuffer);
    const effectiveVolume = this.bgmMuted ? 0 : this.bgmVolume * BGM_MASTER_GAIN;
    victorySound.setVolume(effectiveVolume);
    victorySound.setLoop(false); // Don't loop victory music
    victorySound.play();

    return victorySound;
  }

  /**
   * Set SFX volume
   * @param volume The volume (0.0 to 1.0)
   */
  public setSfxVolume(volume: number): void {
    this.sfxVolume = Math.max(0, Math.min(1, volume));
    this.saveSettings();
  }

  /**
   * Set BGM volume
   * @param volume The volume (0.0 to 1.0)
   */
  public setBgmVolume(volume: number): void {
    this.bgmVolume = Math.max(0, Math.min(1, volume));

    // Update playing BGM volume if it exists
    if (this.bgmSound) {
      const effectiveVolume = this.bgmMuted ? 0 : this.bgmVolume * BGM_MASTER_GAIN;
      this.bgmSound.setVolume(effectiveVolume);
    }

    // Update menu music volume if it exists
    if (this.menuMusicSound) {
      const effectiveVolume = this.bgmMuted ? 0 : this.bgmVolume * BGM_MASTER_GAIN;
      this.menuMusicSound.setVolume(effectiveVolume);
    }

    this.saveSettings();
  }

  /**
   * Get SFX volume
   * @returns The SFX volume (0.0 to 1.0)
   */
  public getSfxVolume(): number {
    return this.sfxVolume;
  }

  /**
   * Get BGM volume
   * @returns The BGM volume (0.0 to 1.0)
   */
  public getBgmVolume(): number {
    return this.bgmVolume;
  }

  public isSfxMuted(): boolean {
    return this.sfxMuted;
  }

  public isBgmMuted(): boolean {
    return this.bgmMuted;
  }

  public setSfxMuted(muted: boolean): void {
    this.sfxMuted = muted;
    this.saveSettings();
  }

  public setBgmMuted(muted: boolean): void {
    this.bgmMuted = muted;

    // Update playing BGM immediately
    if (this.bgmSound) {
      const effectiveVolume = this.bgmMuted ? 0 : this.bgmVolume * BGM_MASTER_GAIN;
      this.bgmSound.setVolume(effectiveVolume);
    }

    // Update menu music immediately
    if (this.menuMusicSound) {
      const effectiveVolume = this.bgmMuted ? 0 : this.bgmVolume * BGM_MASTER_GAIN;
      this.menuMusicSound.setVolume(effectiveVolume);
    }

    this.saveSettings();
  }

  /**
   * Dispose of all audio resources
   */
  public dispose(): void {
    // Stop and clean up background music
    this.stopBackgroundMusic();
    this.bgmBuffer = null;

    // Stop and clean up menu music
    this.stopMenuMusic();
    this.menuMusicBuffer = null;
    this.victoryMusicBuffer = null;

    // Clean up other sounds
    this.soundMap.forEach(sound => {
      sound.stop();
      sound.disconnect();
    });
    this.soundMap.clear();
    this.skillSounds.clear();
    this.initialized = false;
  }
}
