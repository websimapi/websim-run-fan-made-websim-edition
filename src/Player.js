import * as THREE from 'three';
import { TILE_SIZE, PLAYER_SPEED, GRAVITY, JUMP_FORCE, LATERAL_SPEED, WORLD_ROTATION_SPEED } from './Constants.js';

export class Player {
    constructor(scene, camera, isMobile) {
        this.scene = scene;
        this.camera = camera;
        this.isMobile = isMobile;

        // Character Container
        this.mesh = new THREE.Group();
        this.scene.add(this.mesh);

        // Build 3D Character
        this.buildCharacter();

        // Physics State
        this.velocity = new THREE.Vector3(0, 0, -PLAYER_SPEED);
        this.position = new THREE.Vector3(0, 2, 0); // Start slightly above
        this.currentSide = 0; // 0=Floor, 1=Right, 2=Ceiling, 3=Left
        this.onGround = false;
        this.isDead = false;

        // Rotation Animation
        this.targetWorldRotation = 0;
        this.currentWorldRotation = 0;

        // Input State
        this.input = { x: 0, y: 0, jump: false };
    }

    buildCharacter() {
        const material = new THREE.MeshLambertMaterial({ color: 0xaaaaaa });
        const blackMat = new THREE.MeshBasicMaterial({ color: 0x000000 });

        this.charGroup = new THREE.Group();
        this.mesh.add(this.charGroup);

        // Head (Big, plump)
        const headGeo = new THREE.SphereGeometry(0.35, 16, 16);
        this.head = new THREE.Mesh(headGeo, material);
        this.head.position.y = 0.5;
        this.charGroup.add(this.head);

        // Antennae
        const antGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.3);
        const ant1 = new THREE.Mesh(antGeo, material);
        ant1.position.set(0.15, 0.75, 0);
        ant1.rotation.z = -0.3;
        this.charGroup.add(ant1);
        const ant2 = new THREE.Mesh(antGeo, material);
        ant2.position.set(-0.15, 0.75, 0);
        ant2.rotation.z = 0.3;
        this.charGroup.add(ant2);

        // Eyes
        const eyeGeo = new THREE.SphereGeometry(0.08, 8, 8);
        const eyeL = new THREE.Mesh(eyeGeo, blackMat);
        eyeL.position.set(-0.12, 0.55, 0.25);
        this.charGroup.add(eyeL);
        const eyeR = new THREE.Mesh(eyeGeo, blackMat);
        eyeR.position.set(0.12, 0.55, 0.25);
        this.charGroup.add(eyeR);

        // Torso
        const torsoGeo = new THREE.CylinderGeometry(0.15, 0.2, 0.4, 12);
        this.torso = new THREE.Mesh(torsoGeo, material);
        this.torso.position.y = 0.1;
        this.charGroup.add(this.torso);

        // Limbs function
        const createLimb = (x, y, len) => {
            const pivot = new THREE.Group();
            pivot.position.set(x, y, 0);
            const geo = new THREE.CapsuleGeometry(0.08, len, 4, 8);
            const limb = new THREE.Mesh(geo, material);
            limb.position.y = -len / 2;
            pivot.add(limb);
            this.charGroup.add(pivot);
            return pivot;
        };

        this.armL = createLimb(-0.25, 0.25, 0.35);
        this.armR = createLimb(0.25, 0.25, 0.35);
        this.legL = createLimb(-0.15, -0.1, 0.4);
        this.legR = createLimb(0.15, -0.1, 0.4);
    }

    reset() {
        this.position.set(0, 2, 0);
        this.velocity.set(0, 0, -PLAYER_SPEED);
        this.currentSide = 0;
        this.targetWorldRotation = 0;
        this.currentWorldRotation = 0;
        this.isDead = false;
        this.onGround = false;
        this.runTime = 0;
    }

    handleInput(inputVec, jumpPressed) {
        this.input.x = inputVec.x;
        this.input.jump = jumpPressed;
    }

    update(worldObj, dt) {
        if (this.isDead) return;

        // 1. Forward Movement (Constant)
        // Speed increases slightly over distance?
        this.velocity.z = -PLAYER_SPEED - (Math.abs(this.position.z) * 0.0001); 
        this.position.z += this.velocity.z;

        // 2. Lateral Movement
        // We move the player X position. 
        this.position.x += this.input.x * LATERAL_SPEED;

        // 3. Gravity & Jump
        if (this.onGround && this.input.jump) {
            this.velocity.y = JUMP_FORCE;
            this.onGround = false;
            // Play sound trigger handled in Game class
            return 'jump'; 
        }

        this.velocity.y -= GRAVITY;
        this.position.y += this.velocity.y;

        // 4. World Rotation Logic (Wall Switching)
        const tunnelHalfWidth = (3 * TILE_SIZE) / 2;
        const switchThreshold = tunnelHalfWidth - 0.5; // Slightly inside the edge

        if (this.position.x > switchThreshold) {
            // Hit Right Wall -> Rotate World CCW (Player goes from Floor to Right Wall)
            // Visually: Floor rotates to be Left Wall. Right Wall becomes Floor.
            this.changeSide(1);
        } else if (this.position.x < -switchThreshold) {
            // Hit Left Wall
            this.changeSide(-1);
        }

        // 5. Collision with Tiles
        const groundHit = worldObj.checkGround(this.position.z, this.currentSide, this.position.x);

        // Calculate floor Y level
        // Tunnel tiles are at -tunnelHalfWidth - 0.25 (half tile thickness)
        // Player origin is at feet? No, center of group is 0,0,0. 
        // Our character head is at +0.5. Legs end around -0.5.
        // So the mesh origin needs to be ~0.5 above the floor.
        const floorY = -tunnelHalfWidth + 0.5;

        // Collision Logic
        // Fix: Only snap to floor if we are close enough to it. 
        // This prevents snapping back up if we fell deep into a hole but drifted over solid ground.
        const SNAP_THRESHOLD = 0.5; 

        if (groundHit) {
            // Check if we are landing or already on ground
            // We allow snapping if we are slightly below floor (tunneling fix) but not TOO far below (pit fix)
            if (this.position.y <= floorY + 0.1 && this.position.y >= floorY - SNAP_THRESHOLD && this.velocity.y <= 0) {
                this.position.y = floorY;
                this.velocity.y = 0;
                this.onGround = true;
            } else {
                // We are over solid ground, but too deep (or too high?).
                // If too deep, we crashed into the side of the platform conceptually, or are under it.
                // We let physics continue (fall).
                this.onGround = false;
            }
        } else {
            this.onGround = false;
        }

        // 6. Death Check
        if (this.position.y < floorY - 20) {
            this.isDead = true;
            return 'dead';
        }

        // Animation
        this.animateBody();

        // Update Mesh Position
        this.mesh.position.copy(this.position);
        
        // Tilt mesh based on movement
        this.charGroup.rotation.z = -this.input.x * 0.5; // Lean into turn
        this.charGroup.rotation.y = Math.PI; // Face forward (camera looks at back)

        // Update Camera Follow
        const camTargetPos = new THREE.Vector3(
            this.position.x * 0.5, // Slight lag on X for feel
            this.position.y + 3, 
            this.position.z + 8
        );
        this.camera.position.lerp(camTargetPos, 0.1);
        this.camera.lookAt(this.position.x, this.position.y, this.position.z - 5);

        // Smoothly rotate the WORLD container
        // Note: The world container is passed from Game logic usually, or accessed via global.
        // Here we return the rotation delta needed.
    }

    changeSide(dir) {
        // dir: 1 (Right), -1 (Left)
        this.targetWorldRotation -= dir * (Math.PI / 2);

        const tunnelHalfWidth = (3 * TILE_SIZE) / 2;

        if (dir === 1) {
            this.position.x = -tunnelHalfWidth + 1.0; 
            this.currentSide = (this.currentSide + 1) % 4;
        } else {
            this.position.x = tunnelHalfWidth - 1.0; 
            this.currentSide = (this.currentSide + 3) % 4;
        }
    }

    animateBody() {
        if (this.isDead) return;

        // Run cycle
        if (this.onGround && (Math.abs(this.input.x) > 0.01 || Math.abs(this.velocity.z) > 0.01)) {
            this.runTime = (this.runTime || 0) + 0.3;
            
            const limbAmp = 0.8;
            this.legL.rotation.x = Math.sin(this.runTime) * limbAmp;
            this.legR.rotation.x = Math.sin(this.runTime + Math.PI) * limbAmp;
            
            this.armL.rotation.x = Math.sin(this.runTime + Math.PI) * limbAmp;
            this.armR.rotation.x = Math.sin(this.runTime) * limbAmp;
        } else if (!this.onGround) {
            // Jump pose
            this.legL.rotation.x = -0.5;
            this.legR.rotation.x = 0.2;
            this.armL.rotation.x = -2.5; // Hands up
            this.armR.rotation.x = -2.5;
        } else {
            // Idle
            this.legL.rotation.x = 0;
            this.legR.rotation.x = 0;
            this.armL.rotation.x = 0;
            this.armR.rotation.x = 0;
        }
    }
}