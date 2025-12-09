import * as THREE from 'three';
import { TILE_SIZE, PLAYER_SPEED, GRAVITY, JUMP_FORCE, LATERAL_SPEED, WORLD_ROTATION_SPEED } from './Constants.js';

export class Player {
    constructor(scene, camera, isMobile) {
        this.scene = scene;
        this.camera = camera;
        this.isMobile = isMobile;

        // Sprite
        const map = new THREE.TextureLoader().load('alien.png');
        const material = new THREE.SpriteMaterial({ map: map, color: 0xffffff });
        this.mesh = new THREE.Sprite(material);
        this.mesh.scale.set(1.5, 2.5, 1);
        this.scene.add(this.mesh);

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

    reset() {
        this.position.set(0, 2, 0);
        this.velocity.set(0, 0, -PLAYER_SPEED);
        this.currentSide = 0;
        this.targetWorldRotation = 0;
        this.currentWorldRotation = 0;
        this.isDead = false;
        this.onGround = false;
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
        // We check the tile directly below the player relative to the CURRENT side
        const groundHit = worldObj.checkGround(this.position.z, this.currentSide, this.position.x);

        // Floor level is effectively at y = -tunnelHalfWidth + (playerHeight/2)
        // Let's say floor is at Y = -5 (example). 
        // We render tiles at Y = -6 (center 0,0,0, floor is -6)

        const floorY = -tunnelHalfWidth + 1.25; // 1.25 is half player height roughly

        if (groundHit) {
            if (this.position.y <= floorY && this.velocity.y <= 0) {
                this.position.y = floorY;
                this.velocity.y = 0;
                this.onGround = true;
            }
        } else {
            this.onGround = false;
        }

        // 6. Death Check
        if (this.position.y < floorY - 10) {
            this.isDead = true;
            return 'dead';
        }

        // Update Mesh Position
        // The mesh visually stays centered X/Y mostly, but we simulate X movement.
        // Actually, for this style, we move the player Mesh X,Y,Z.
        // But the Camera follows closely.
        this.mesh.position.copy(this.position);

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
        // If we go Right, the world rotates -90 deg (CCW) so the Right wall becomes the bottom.
        this.targetWorldRotation -= dir * (Math.PI / 2);

        // Reset Player X to the new relative position
        // If I hit the right wall (x = +6), I am now on the "Floor" of the new side.
        // My X becomes relative to the new floor.
        // Actually, just snapping them creates a jump.
        // Classic Run: You transition smoothly.
        // Easy math: Just wrap the coordinate.

        const tunnelHalfWidth = (3 * TILE_SIZE) / 2;

        if (dir === 1) {
            this.position.x = -tunnelHalfWidth + 1.0; // Teleport to left side of new floor
            this.currentSide = (this.currentSide + 1) % 4;
        } else {
            this.position.x = tunnelHalfWidth - 1.0; // Teleport to right side of new floor
            this.currentSide = (this.currentSide + 3) % 4; // -1 wrap
        }

        // Adjust Y slightly to prevent clipping during transition
        // this.position.y = ...
    }
}