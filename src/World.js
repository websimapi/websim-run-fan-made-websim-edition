import * as THREE from 'three';
import { TILE_SIZE, VIEW_DISTANCE, COLORS } from './Constants.js';

export class World {
    constructor(scene) {
        this.scene = scene;
        this.tiles = [];
        this.tileMap = new Map(); // Optimization for checking ground
        this.goalZ = -1000;

        // Setup Materials
        const loader = new THREE.TextureLoader();
        const tileTexture = loader.load('tile.png');
        tileTexture.wrapS = THREE.RepeatWrapping;
        tileTexture.wrapT = THREE.RepeatWrapping;

        this.material = new THREE.MeshLambertMaterial({ 
            map: tileTexture,
            color: COLORS.tile
        });

        this.geometry = new THREE.BoxGeometry(TILE_SIZE, 0.5, TILE_SIZE);

        // Container for rotating the world
        this.meshContainer = new THREE.Group();
        this.scene.add(this.meshContainer);
    }

    generateLevel(level) {
        // Clear existing tiles
        while(this.meshContainer.children.length > 0){ 
            this.meshContainer.remove(this.meshContainer.children[0]); 
        }
        this.tileMap.clear();

        // Level Parameters
        const length = 40 + (level * 20); // Longer levels
        // Cap difficulty eventually
        const effectiveLevel = Math.min(level, 10);
        const gapBase = Math.min(0.05 + (effectiveLevel * 0.05), 0.5); 
        
        this.goalZ = -(length * TILE_SIZE);

        // Logic for forced rotation patterns (snake)
        let safeSide = 0; 
        let safeSideDuration = 10;

        for (let i = 0; i <= length; i++) {
            
            // Pattern logic: Change the "Safe Path" every few rows
            if (i > 5 && i < length - 8) {
                if (safeSideDuration <= 0) {
                    if (Math.random() < 0.2 + (effectiveLevel * 0.05)) {
                        // Switch side (Left or Right)
                        const turn = Math.random() > 0.5 ? 1 : -1;
                        safeSide = (safeSide + turn + 4) % 4;
                        safeSideDuration = Math.max(3, 12 - effectiveLevel); 
                    }
                } else {
                    safeSideDuration--;
                }
            }

            const isStart = i < 5;
            const isEnd = i > length - 5;
            
            this.generateRow(i, isStart || isEnd, gapBase, safeSide);
        }

        // Add Goal
        const goalGeo = new THREE.TorusGeometry(6, 0.5, 16, 32);
        const goalMat = new THREE.MeshBasicMaterial({ color: 0x00ffcc });
        const goalMesh = new THREE.Mesh(goalGeo, goalMat);
        goalMesh.position.z = this.goalZ;
        this.meshContainer.add(goalMesh);
    }

    generateRow(rowIndex, safe, gapBase, safeSide) {
        const tunnelWidth = 3; 
        const offset = (tunnelWidth * TILE_SIZE) / 2 - (TILE_SIZE / 2);

        for (let side = 0; side < 4; side++) {
            for (let x = 0; x < tunnelWidth; x++) {
                
                let isSolid = false;

                if (safe) {
                    isSolid = true;
                } else {
                    if (side === safeSide) {
                        // Safe side is mostly solid, but can have small holes later
                        // Ensure the MIDDLE path is always solid on safe side for playability
                        if (x === 1) isSolid = true; 
                        else isSolid = Math.random() > 0.2; 
                    } else {
                        // Other sides have high gap chance
                        isSolid = Math.random() > (gapBase + 0.3); // much harder to traverse off-path
                    }
                }

                if (isSolid) {
                    const mesh = new THREE.Mesh(this.geometry, this.material);
                    const dist = (tunnelWidth * TILE_SIZE) / 2;
                    
                    const lateralPos = (x * TILE_SIZE) - offset;
                    const forwardPos = -rowIndex * TILE_SIZE;

                    mesh.position.set(lateralPos, -dist, forwardPos);
                    
                    // We group it to rotate it easily
                    const group = new THREE.Group();
                    group.add(mesh);
                    group.rotation.z = side * (Math.PI / 2);
                    
                    // Optimization: We could apply rotation to position/quaternion directly
                    // but Group is easier for the "Tunnel" mental model
                    this.meshContainer.add(group);

                    // Map entry
                    const key = `${rowIndex},${side},${x}`;
                    this.tileMap.set(key, true);
                }
            }
        }
    }

    update(playerZ) {
        // No procedural generation needed per frame
    }

    checkGround(z, side, xOffset) {
        const row = Math.round(Math.abs(z) / TILE_SIZE);
        const tileIndex = Math.round((xOffset + TILE_SIZE) / TILE_SIZE);
        const key = `${row},${side},${tileIndex}`;
        return this.tileMap.has(key);
    }
}