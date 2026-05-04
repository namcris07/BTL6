import * as THREE from 'three';

interface DamageNumber {
  sprite: THREE.Sprite;
  startTime: number;
  lifetime: number; // in milliseconds
}

/**
 * Manages floating damage number visual effects
 */
export class DamageNumberEffect {
  private scene: THREE.Scene;
  private damageNumbers: DamageNumber[] = [];
  private readonly LIFETIME = 1000; // 1 second
  private readonly RISE_SPEED = 2.0; // units per second

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  /**
   * Creates a floating damage number at the specified position
   * @param damage The damage amount to display
   * @param position The world position where damage occurred
   */
  public createDamageNumber(damage: number, position: THREE.Vector3): void {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');

    // Set canvas size
    canvas.width = 256;
    canvas.height = 128;

    if (context) {
      // Clear canvas
      context.clearRect(0, 0, canvas.width, canvas.height);

      // Set text style - large, bold, impactful
      context.font = 'bold 72px Arial';
      context.textAlign = 'center';
      context.textBaseline = 'middle';

      // Add black outline/shadow for better visibility
      context.strokeStyle = 'black';
      context.lineWidth = 8;
      context.strokeText(Math.round(damage).toString(), canvas.width / 2, canvas.height / 2);

      // Draw damage number in bright red
      context.fillStyle = '#ff3333';
      context.fillText(Math.round(damage).toString(), canvas.width / 2, canvas.height / 2);
    }

    // Create texture from canvas
    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;

    // Create sprite material
    const material = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthTest: false, // Render on top of everything
    });

    // Create sprite
    const sprite = new THREE.Sprite(material);
    sprite.scale.set(2, 1, 1); // Make it readable
    
    // Position slightly above the player
    sprite.position.copy(position);
    sprite.position.y += 2.5;

    // Add to scene
    this.scene.add(sprite);

    // Track this damage number
    this.damageNumbers.push({
      sprite,
      startTime: Date.now(),
      lifetime: this.LIFETIME,
    });
  }

  /**
   * Update all active damage numbers - make them rise and fade out
   * @param delta Time delta in seconds
   */
  public update(delta: number): void {
    const now = Date.now();
    const numbersToRemove: number[] = [];

    this.damageNumbers.forEach((damageNum, index) => {
      const elapsed = now - damageNum.startTime;
      const progress = elapsed / damageNum.lifetime;

      if (progress >= 1.0) {
        // Lifetime expired - mark for removal
        numbersToRemove.push(index);
        this.scene.remove(damageNum.sprite);
      } else {
        // Move upward
        damageNum.sprite.position.y += this.RISE_SPEED * delta;

        // Fade out
        const material = damageNum.sprite.material as THREE.SpriteMaterial;
        material.opacity = 1.0 - progress;
      }
    });

    // Remove expired damage numbers (in reverse order to maintain indices)
    for (let i = numbersToRemove.length - 1; i >= 0; i--) {
      this.damageNumbers.splice(numbersToRemove[i], 1);
    }
  }

  /**
   * Cleanup all damage numbers
   */
  public cleanup(): void {
    this.damageNumbers.forEach(damageNum => {
      this.scene.remove(damageNum.sprite);
    });
    this.damageNumbers = [];
  }
}
