import * as THREE from 'three';
import { TILE_SIZE, VIEW_DISTANCE, COLORS } from './Constants.js';

export class World {
    constructor(scene) {
        this.scene = scene;
        this.tiles = [];
        this.currentRow = 0;

        // Setup Materials
        const loader = new THREE.TextureLoader();
        const tileTexture = loader.load('tile.png');
        tileTexture.wrapS = THREE.RepeatWrapping;
        tileTexture.wrapT = THREE.RepeatWrapping;

        this.material = new THREE.MeshLambertMaterial({ 
            map: tileTexture,
            color: COLORS.tile
        });

        // Use InstancedMesh for performance
        this.maxTiles = VIEW_DISTANCE * 4 * 4; // 4 sides, approx 4 tiles wide
        this.geometry = new THREE.BoxGeometry(TILE_SIZE, 0.5, TILE_SIZE);

        // Container for rotating the world
        this.meshContainer = new THREE.Group();
        this.scene.add(this.meshContainer);

        // Initial Generation
        this.activeTiles = [];
    }

    reset() {
        // Clear existing tiles
        while(this.meshContainer.children.length > 0){ 
            this.meshContainer.remove(this.meshContainer.children[0]); 
        }
        this.activeTiles = [];
        this.currentRow = 0;

        // Generate initial safe zone
        for (let i = 0; i < 10; i++) {
            this.generateRow(i, true);
        }
        // Generate rest
        for (let i = 10; i < VIEW_DISTANCE; i++) {
            this.generateRow(i, false);
        }
    }

    generateRow(rowIndex, safe) {
        const tunnelWidth = 3; // How many tiles wide is one wall
        const offset = (tunnelWidth * TILE_SIZE) / 2 - (TILE_SIZE / 2);

        // 0: Floor, 1: Right Wall, 2: Ceiling, 3: Left Wall
        for (let side = 0; side < 4; side++) {

            // Difficulty scaling
            let gapChance = safe ? 0 : Math.min(0.1 + (rowIndex * 0.002), 0.6);

            for (let x = 0; x < tunnelWidth; x++) {
                if (Math.random() > gapChance) {
                    const mesh = new THREE.Mesh(this.geometry, this.material);

                    // Logic to position tile based on side
                    // We construct a square tunnel centered at 0,0,Z

                    const dist = (tunnelWidth * TILE_SIZE) / 2;

                    // Local position on the face
                    const lateralPos = (x * TILE_SIZE) - offset;
                    const forwardPos = -rowIndex * TILE_SIZE;

                    mesh.position.set(0,0,0);

                    // Rotate and translate based on side
                    const group = new THREE.Group();
                    group.add(mesh);

                    // Shift mesh to be "flat" on the ground first
                    mesh.position.z = forwardPos;
                    mesh.position.x = lateralPos;
                    mesh.position.y = -dist; // Push down to floor level

                    // Rotate the GROUP to place it on the correct wall
                    group.rotation.z = side * (Math.PI / 2);

                    this.meshContainer.add(group);

                    this.activeTiles.push({
                        mesh: group, // The group handles the rotation
                        row: rowIndex,
                        side: side,
                        tileX: x,
                        type: 'solid'
                    });
                } else {
                     // Just store emptiness for logic
                     this.activeTiles.push({
                        mesh: null,
                        row: rowIndex,
                        side: side,
                        tileX: x,
                        type: 'gap'
                    });
                }
            }
        }
    }

    update(playerZ) {
        // Calculate current row based on player position
        // Player moves into negative Z
        const targetRow = Math.floor(Math.abs(playerZ) / TILE_SIZE);

        if (targetRow + VIEW_DISTANCE > this.currentRow) {
            this.currentRow++;
            this.generateRow(this.currentRow - 1 + VIEW_DISTANCE, false);
            this.cleanupOldTiles(targetRow);
        }
    }

    cleanupOldTiles(playerRow) {
        // Remove tiles behind the player
        const removeThreshold = playerRow - 5;
        this.activeTiles = this.activeTiles.filter(t => {
            if (t.row < removeThreshold) {
                if (t.mesh) {
                    this.meshContainer.remove(t.mesh);
                    // Dispose geometry/material if we weren't reusing them globally
                }
                return false;
            }
            return true;
        });
    }

    // Collision Detection Helper
    checkGround(z, side, xOffset) {
        // Map world coords to tile grid
        const tunnelWidth = 3;
        const totalWidth = tunnelWidth * TILE_SIZE;

        // xOffset is relative to center of that side. 
        // e.g. -6 to +6. Shift to 0..12
        const relativeX = xOffset + (totalWidth / 2);
        const tileIndex = Math.floor(relativeX / TILE_SIZE);

        const row = Math.floor(Math.abs(z) / TILE_SIZE); // Z is negative usually, check logic?
        // Z is player position (e.g. -10). Row 0 is 0..-4. Row 1 is -4..-8.
        // Actually: Row index = floor(abs(z) / 4) IF we start at 0.
        // Let's refine rounding.
        const rowExact = Math.abs(z) / TILE_SIZE; 
        const rowIndex = Math.round(rowExact); // Snap to nearest row center? 
        // Tiles are placed at -rowIndex * TILE_SIZE.
        // If tile is at -4, it covers -2 to -6. 

        const r = Math.round(Math.abs(z) / TILE_SIZE);

        // Find tile
        const tile = this.activeTiles.find(t => 
            t.row === r && 
            t.side === side && 
            t.tileX === tileIndex
        );

        return tile ? tile.type === 'solid' : false;
    }
}