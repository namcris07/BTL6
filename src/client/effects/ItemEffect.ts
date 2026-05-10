import * as THREE from 'three';
import { ItemType, ITEM_CONFIG } from '../../common/constants';

/**
 * Creates visual effects for collectible items
 */
export class ItemEffect {
  private scene: THREE.Scene;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  /**
   * Create a mesh for an item based on its type
   */
  public createItemMesh(itemType: ItemType): THREE.Group {
    const group = new THREE.Group();
    const config = ITEM_CONFIG[itemType];

    switch (itemType) {
      case ItemType.HEALTH_PACK:
        this.createHealthPackMesh(group, config.color);
        break;
      case ItemType.DAMAGE_BOOST:
        this.createDamageBoostMesh(group, config.color);
        break;
      case ItemType.SHIELD:
        this.createShieldMesh(group, config.color);
        break;
    }

    // Add glow effect
    this.addGlowEffect(group, config.color);

    return group;
  }

  /**
   * Health Pack - Green cross/plus shape
   */
  private createHealthPackMesh(group: THREE.Group, color: number): void {
    const material = new THREE.MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: 0.3,
      metalness: 0.2,
      roughness: 0.5,
    });

    // Horizontal bar
    const hBarGeometry = new THREE.BoxGeometry(0.8, 0.25, 0.25);
    const hBar = new THREE.Mesh(hBarGeometry, material);
    group.add(hBar);

    // Vertical bar
    const vBarGeometry = new THREE.BoxGeometry(0.25, 0.8, 0.25);
    const vBar = new THREE.Mesh(vBarGeometry, material);
    group.add(vBar);

    // Base platform
    const baseGeometry = new THREE.CylinderGeometry(0.5, 0.5, 0.1, 8);
    const baseMaterial = new THREE.MeshStandardMaterial({
      color: 0x333333,
      metalness: 0.5,
      roughness: 0.3,
    });
    const base = new THREE.Mesh(baseGeometry, baseMaterial);
    base.position.y = -0.4;
    group.add(base);
  }


  /**
   * Damage Boost - Red/orange flame shape
   */
  private createDamageBoostMesh(group: THREE.Group, color: number): void {
    const material = new THREE.MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: 0.6,
      metalness: 0.1,
      roughness: 0.6,
    });

    // Create a sword-like shape
    // Blade
    const bladeGeometry = new THREE.ConeGeometry(0.15, 0.8, 4);
    const blade = new THREE.Mesh(bladeGeometry, material);
    blade.position.y = 0.2;
    group.add(blade);

    // Guard
    const guardGeometry = new THREE.BoxGeometry(0.5, 0.1, 0.1);
    const guardMaterial = new THREE.MeshStandardMaterial({
      color: 0xffcc00,
      metalness: 0.8,
      roughness: 0.2,
    });
    const guard = new THREE.Mesh(guardGeometry, guardMaterial);
    guard.position.y = -0.2;
    group.add(guard);

    // Handle
    const handleGeometry = new THREE.CylinderGeometry(0.05, 0.05, 0.3, 8);
    const handleMaterial = new THREE.MeshStandardMaterial({
      color: 0x4a3728,
      roughness: 0.8,
    });
    const handle = new THREE.Mesh(handleGeometry, handleMaterial);
    handle.position.y = -0.4;
    group.add(handle);
  }

  /**
   * Shield - Yellow hexagon/shield shape
   */
  private createShieldMesh(group: THREE.Group, color: number): void {
    const material = new THREE.MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: 0.4,
      metalness: 0.6,
      roughness: 0.3,
      side: THREE.DoubleSide,
    });

    // Shield shape (hexagon)
    const shape = new THREE.Shape();
    const sides = 6;
    const radius = 0.4;
    
    for (let i = 0; i <= sides; i++) {
      const angle = (i / sides) * Math.PI * 2 - Math.PI / 2;
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius;
      if (i === 0) {
        shape.moveTo(x, y);
      } else {
        shape.lineTo(x, y);
      }
    }

    const extrudeSettings = { depth: 0.15, bevelEnabled: true, bevelSize: 0.02, bevelThickness: 0.02 };
    const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
    geometry.center();

    const mesh = new THREE.Mesh(geometry, material);
    group.add(mesh);

    // Inner pattern
    const innerGeometry = new THREE.CircleGeometry(0.2, 6);
    const innerMaterial = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xffffaa,
      emissiveIntensity: 0.3,
    });
    const inner = new THREE.Mesh(innerGeometry, innerMaterial);
    inner.position.z = 0.08;
    group.add(inner);
  }

  /**
   * Add glow effect to item
   */
  private addGlowEffect(group: THREE.Group, color: number): void {
    // Point light for glow
    const light = new THREE.PointLight(color, 0.5, 3);
    light.position.y = 0.5;
    group.add(light);
  }

  /**
   * Update item animation (floating and rotating)
   */
  public updateAnimation(mesh: THREE.Group, delta: number, time: number): void {
    // Floating animation
    mesh.position.y = 0.5 + Math.sin(time * 2) * 0.15;
    
    // Rotation
    mesh.rotation.y += delta * 1.5;
  }

  /**
   * Create pickup effect when item is collected
   */
  public createPickupEffect(position: THREE.Vector3, color: number): THREE.Points {
    const particleCount = 10; // Reduced for performance
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const velocities: THREE.Vector3[] = [];

    for (let i = 0; i < particleCount; i++) {
      positions[i * 3] = position.x;
      positions[i * 3 + 1] = position.y;
      positions[i * 3 + 2] = position.z;

      // Random outward velocity
      velocities.push(new THREE.Vector3(
        (Math.random() - 0.5) * 3,
        Math.random() * 3,
        (Math.random() - 0.5) * 3
      ));
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const material = new THREE.PointsMaterial({
      color,
      size: 0.15,
      transparent: true,
      opacity: 1,
    });

    const particles = new THREE.Points(geometry, material);
    particles.userData.velocities = velocities;
    particles.userData.startTime = Date.now();
    particles.userData.lifetime = 500; // ms

    this.scene.add(particles);
    return particles;
  }

  /**
   * Update pickup effect particles
   */
  public updatePickupEffect(particles: THREE.Points, delta: number): boolean {
    const elapsed = Date.now() - particles.userData.startTime;
    const lifetime = particles.userData.lifetime;

    if (elapsed >= lifetime) {
      this.scene.remove(particles);
      return false;
    }

    const positions = particles.geometry.attributes.position as THREE.BufferAttribute;
    const velocities = particles.userData.velocities as THREE.Vector3[];

    for (let i = 0; i < velocities.length; i++) {
      positions.array[i * 3] += velocities[i].x * delta;
      positions.array[i * 3 + 1] += velocities[i].y * delta;
      positions.array[i * 3 + 2] += velocities[i].z * delta;

      // Apply gravity
      velocities[i].y -= delta * 5;
    }

    positions.needsUpdate = true;

    // Fade out
    const material = particles.material as THREE.PointsMaterial;
    material.opacity = 1 - (elapsed / lifetime);

    return true;
  }
}

