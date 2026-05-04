import * as THREE from 'three';

export interface PlayerMeshResult {
  group: THREE.Group;
  body: THREE.Mesh;
  bodyGroup: THREE.Group;
  nameLabel: THREE.Sprite;
  leftLeg: THREE.Group;
  rightLeg: THREE.Group;
  katana: THREE.Group;
  bandanaTails: THREE.Group;
}

export class PlayerModel {
  /**
   * Creates a player mesh with body, eyes, legs, boots, belt and name label
   */
  public static createPlayerMesh(
    isLocal: boolean,
    createPlayerNameLabel: (name: string) => THREE.Sprite,
    color: number = 0xff0000 // Default red if not provided
  ): PlayerMeshResult {
    const group = new THREE.Group();

    // Create body group (will rotate based on movement direction)
    const bodyGroup = new THREE.Group();

    // Create body capsule - use provided color for sync
    const geometry = new THREE.CapsuleGeometry(0.5, 1, 6, 12); // Reduced segments for better performance
    const material = new THREE.MeshStandardMaterial({ 
      color: color,
      roughness: 0.4,
      metalness: 0.1,
      emissive: new THREE.Color(color).multiplyScalar(0.1), // Subtle glow
    });
    const body = new THREE.Mesh(geometry, material);
    body.position.y = 1;
    body.castShadow = true;
    body.receiveShadow = true;
    bodyGroup.add(body);

    // Create eyes - white eyes with black pupils (bigger and funnier)
    const eyeSize = 0.18; // Bigger eyes for comical effect
    const eyeWhiteGeometry = new THREE.SphereGeometry(eyeSize, 8, 8); // Reduced segments for performance
    const eyeWhiteMaterial = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.3,
      metalness: 0.1,
    });

    const pupilSize = 0.08; // Bigger pupils
    const pupilGeometry = new THREE.SphereGeometry(pupilSize, 6, 6); // Reduced segments for performance
    const pupilMaterial = new THREE.MeshStandardMaterial({ color: 0x000000 });

    // Left eye
    const leftEyeWhite = new THREE.Mesh(eyeWhiteGeometry, eyeWhiteMaterial);
    leftEyeWhite.position.set(-0.22, 1.38, 0.5);
    bodyGroup.add(leftEyeWhite);

    const leftPupil = new THREE.Mesh(pupilGeometry, pupilMaterial);
    leftPupil.position.set(-0.22, 1.38, 0.5 + eyeSize * 0.6); // Slightly forward for 3D effect
    bodyGroup.add(leftPupil);

    // Right eye
    const rightEyeWhite = new THREE.Mesh(eyeWhiteGeometry, eyeWhiteMaterial);
    rightEyeWhite.position.set(0.22, 1.38, 0.5);
    bodyGroup.add(rightEyeWhite);

    const rightPupil = new THREE.Mesh(pupilGeometry, pupilMaterial);
    rightPupil.position.set(0.22, 1.38, 0.5 + eyeSize * 0.6); // Slightly forward for 3D effect
    bodyGroup.add(rightPupil);

    // Create Belt
    const beltGroup = new THREE.Group();

    // Belt Strap - Dark Gray
    const beltGeometry = new THREE.CylinderGeometry(0.52, 0.52, 0.15, 8); // Reduced segments for performance
    const beltMaterial = new THREE.MeshStandardMaterial({
      color: 0x333333, // Dark Gray
      roughness: 0.7,
      metalness: 0.3,
    });
    const belt = new THREE.Mesh(beltGeometry, beltMaterial);
    belt.position.y = 0.8; // Waist height
    beltGroup.add(belt);

    // Belt Buckle
    const buckleGeometry = new THREE.BoxGeometry(0.2, 0.18, 0.05);
    const buckleMaterial = new THREE.MeshStandardMaterial({
      color: 0xc0c0c0, // Silver
      roughness: 0.3,
      metalness: 0.8,
    });
    const buckle = new THREE.Mesh(buckleGeometry, buckleMaterial);
    buckle.position.set(0, 0.8, 0.5); // Front of belt
    beltGroup.add(buckle);

    bodyGroup.add(beltGroup);

    // Leg Settings
    const legLength = 0.7;
    const legRadius = 0.15;
    const legColor = 0x222222; // Dark pants
    const legMaterial = new THREE.MeshStandardMaterial({ color: legColor });

    // Boot Settings
    const bootHeight = 0.3;
    const bootWidth = 0.22;
    const bootLength = 0.35;
    const bootColor = 0x111111; // Black boots
    const bootMaterial = new THREE.MeshStandardMaterial({
      color: bootColor,
      roughness: 0.6,
      metalness: 0.2,
    });

    // Helper function to create a leg with boot
    const createLeg = (isLeft: boolean) => {
      const legGroup = new THREE.Group();

      // Upper Leg (Thigh/Shin combined for simple style)
      const legGeo = new THREE.CapsuleGeometry(legRadius, legLength - 0.2, 4, 6); // Reduced segments for performance
      const legMesh = new THREE.Mesh(legGeo, legMaterial);
      legMesh.position.y = -legLength / 2;
      legMesh.castShadow = true;
      legGroup.add(legMesh);

      // Boot Group
      const bootGroup = new THREE.Group();
      bootGroup.position.y = -legLength; // Bottom of leg

      // Boot Base
      const bootBaseGeo = new THREE.BoxGeometry(bootWidth, bootHeight, bootLength);
      const bootBase = new THREE.Mesh(bootBaseGeo, bootMaterial);
      bootBase.position.set(0, bootHeight / 2, 0.05); // Slightly forward
      bootBase.castShadow = true;
      bootGroup.add(bootBase);

      // Boot Toe
      const toeGeo = new THREE.CylinderGeometry(bootWidth / 2, bootWidth / 2, bootHeight, 8); // Reduced segments for performance
      const toe = new THREE.Mesh(toeGeo, bootMaterial);
      toe.rotation.x = Math.PI / 2;
      toe.position.set(0, bootHeight / 2, bootLength / 2);
      bootGroup.add(toe);

      legGroup.add(bootGroup);

      // Position entire leg group relative to body center
      const xOffset = 0.25;
      legGroup.position.set(isLeft ? -xOffset : xOffset, 0.6, 0); // Hip position

      return legGroup;
    };

    const leftLeg = createLeg(true);
    const rightLeg = createLeg(false);

    // Add legs to bodyGroup
    bodyGroup.add(leftLeg);
    bodyGroup.add(rightLeg);

    // Create Bandana
    const bandanaGroup = new THREE.Group();
    const bandanaColor = new THREE.Color(color);
    const bandanaMaterial = new THREE.MeshStandardMaterial({
      color: bandanaColor,
      roughness: 0.8,
      metalness: 0.1,
    });

    // Headband (torus)
    const headbandGeometry = new THREE.TorusGeometry(0.52, 0.08, 8, 20);
    const headband = new THREE.Mesh(headbandGeometry, bandanaMaterial);
    headband.rotation.x = Math.PI / 2;
    headband.position.y = 1.6; // Position on forehead
    bandanaGroup.add(headband);

    // Bandana Knot (sphere/box at back)
    const knotGeometry = new THREE.SphereGeometry(0.12, 6, 6); // Reduced segments for performance
    const knot = new THREE.Mesh(knotGeometry, bandanaMaterial);
    knot.position.set(0, 1.6, -0.55);
    bandanaGroup.add(knot);

    // Bandana Tails Group (for animation)
    const bandanaTails = new THREE.Group();
    bandanaTails.position.set(0, 1.6, -0.55); // Attached to knot
    bandanaGroup.add(bandanaTails);

    // Bandana Tails (planes/boxes)
    const tailGeometry = new THREE.BoxGeometry(0.1, 0.6, 0.02);

    const leftTail = new THREE.Mesh(tailGeometry, bandanaMaterial);
    leftTail.position.set(-0.1, -0.3, -0.05); // Relative to tails group
    leftTail.rotation.z = 0.2;
    leftTail.rotation.x = 0.2;
    bandanaTails.add(leftTail);

    const rightTail = new THREE.Mesh(tailGeometry, bandanaMaterial);
    rightTail.position.set(0.1, -0.3, -0.05); // Relative to tails group
    rightTail.rotation.z = -0.2;
    rightTail.rotation.x = 0.2;
    bandanaTails.add(rightTail);

    bodyGroup.add(bandanaGroup);

    // Create Katana with improved design
    const katanaGroup = new THREE.Group();

    // Handle - Thicker and longer with better material
    const handleGeometry = new THREE.CylinderGeometry(0.06, 0.06, 0.45, 8); // Reduced segments for performance
    const handleMaterial = new THREE.MeshStandardMaterial({ 
      color: 0x1a1a1a,
      roughness: 0.8,
      metalness: 0.1,
    });
    const handle = new THREE.Mesh(handleGeometry, handleMaterial);
    handle.position.y = 0.225;
    handle.castShadow = true;
    katanaGroup.add(handle);

    // Guard (Tsuba) - Bigger and more detailed
    const guardGeometry = new THREE.CylinderGeometry(0.14, 0.14, 0.04, 8); // Reduced segments for performance
    const guardMaterial = new THREE.MeshStandardMaterial({ 
      color: 0xffd700,
      metalness: 0.8,
      roughness: 0.3,
      emissive: new THREE.Color(0xffd700).multiplyScalar(0.1), // Subtle glow
    });
    const guard = new THREE.Mesh(guardGeometry, guardMaterial);
    guard.position.y = 0.45;
    guard.castShadow = true;
    katanaGroup.add(guard);

    // Blade - Thicker, longer, with better metal look
    const bladeGeometry = new THREE.BoxGeometry(0.08, 1.5, 0.03);
    const bladeMaterial = new THREE.MeshStandardMaterial({
      color: 0xe0e0e0,
      metalness: 0.95,
      roughness: 0.1,
      emissive: new THREE.Color(0xffffff).multiplyScalar(0.05), // Subtle shine
    });
    const blade = new THREE.Mesh(bladeGeometry, bladeMaterial);
    blade.position.y = 1.2;
    blade.castShadow = true;
    katanaGroup.add(blade);
    
    // Blade edge highlight
    const edgeGeometry = new THREE.BoxGeometry(0.09, 1.5, 0.01);
    const edgeMaterial = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      metalness: 1.0,
      roughness: 0.0,
      emissive: new THREE.Color(0xffffff).multiplyScalar(0.1),
    });
    const edge = new THREE.Mesh(edgeGeometry, edgeMaterial);
    edge.position.set(0, 1.2, 0.02);
    katanaGroup.add(edge);

    // Position Katana in hand (right side)
    katanaGroup.position.set(0.6, 1.0, 0.2);
    katanaGroup.rotation.x = Math.PI / 4; // Angled forward
    katanaGroup.rotation.z = -Math.PI / 8; // Angled out

    bodyGroup.add(katanaGroup);

    // Add bodyGroup to main group after adding shoes
    group.add(bodyGroup);

    // Create name label with default name
    const nameLabel = createPlayerNameLabel(isLocal ? 'You' : 'Player');
    // Position the name label above the player
    nameLabel.position.y = 3.5; // Above player's head
    group.add(nameLabel); // Add to group so it moves with player

    return {
      group,
      body,
      bodyGroup,
      nameLabel,
      leftLeg,
      rightLeg,
      katana: katanaGroup,
      bandanaTails,
    };
  }
}
