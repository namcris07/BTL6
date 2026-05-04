import * as THREE from 'three';
import type { ItemState, Vector3 } from '../common/types';
import { ItemType, ITEM_CONFIG } from '../common/constants';

export class ServerItem {
  public id: string;
  public type: ItemType;
  public position: THREE.Vector3;
  public isCollected: boolean = false;
  public respawnAt: number = 0;

  constructor(id: string, type: ItemType, position: Vector3) {
    this.id = id;
    this.type = type;
    this.position = new THREE.Vector3(position.x, position.y, position.z);
  }

  /**
   * Check if a player is close enough to collect this item
   */
  public canBeCollectedBy(playerPosition: THREE.Vector3, collectionRadius: number = 1.5): boolean {
    if (this.isCollected) return false;
    
    const distance = this.position.distanceTo(playerPosition);
    return distance <= collectionRadius;
  }

  /**
   * Collect this item
   */
  public collect(): void {
    this.isCollected = true;
    const config = ITEM_CONFIG[this.type];
    this.respawnAt = Date.now() + config.respawnTime;
  }

  /**
   * Check if item should respawn
   */
  public shouldRespawn(): boolean {
    return this.isCollected && Date.now() >= this.respawnAt;
  }

  /**
   * Respawn the item
   */
  public respawn(): void {
    this.isCollected = false;
    this.respawnAt = 0;
  }

  /**
   * Get state for network sync
   */
  public getState(): ItemState {
    return {
      id: this.id,
      type: this.type,
      position: {
        x: this.position.x,
        y: this.position.y,
        z: this.position.z,
      },
      isCollected: this.isCollected,
      respawnAt: this.respawnAt > 0 ? this.respawnAt : undefined,
    };
  }
}

