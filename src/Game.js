import * as THREE from 'three';
import nipplejs from 'nipplejs';
import { World } from './World.js';
import { Player } from './Player.js';
import { COLORS } from './Constants.js';

export class Game {
    constructor(container, isMobile) {
        this.container = container;
        this.isMobile = isMobile;

        // Setup Three.js
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(COLORS.background);
        this.scene.fog = new THREE.Fog(COLORS.fog, 20, 90);

        this.camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 1000);

        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        container.appendChild(this.renderer.domElement);

        // Lighting
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        this.scene.add(ambientLight);
        const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
        dirLight.position.set(5, 10, 5);
        this.scene.add(dirLight);

        // Components
        this.world = new World(this.scene);
        this.player = new Player(this.scene, this.camera, isMobile);

        // Audio
        this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        this.loadAudio();

        // Controls
        this.input = { x: 0, y: 0 };
        this.jumpPressed = false;
        this.setupControls();

        this.isRunning = false;
        this.scoreDisplay = document.getElementById('score-display');
    }

    async loadAudio() {
        this.sounds = {};

        const loadBuffer = async (url) => {
            const res = await fetch(url);
            const arrayBuffer = await res.arrayBuffer();
            return await this.audioCtx.decodeAudioData(arrayBuffer);
        };

        try {
            this.sounds.jump = await loadBuffer('jump.mp3');
            this.sounds.ambient = await loadBuffer('ambient.mp3');
        } catch (e) {
            console.warn("Audio load failed", e);
        }
    }

    playSound(name, loop = false) {
        if (!this.sounds[name]) return;
        const source = this.audioCtx.createBufferSource();
        source.buffer = this.sounds[name];
        source.loop = loop;
        source.connect(this.audioCtx.destination);
        source.start();
        return source;
    }

    setupControls() {
        // Keyboard
        window.addEventListener('keydown', (e) => {
            if (e.code === 'Space') this.jumpPressed = true;
            if (e.code === 'ArrowLeft' || e.code === 'KeyA') this.input.x = -1;
            if (e.code === 'ArrowRight' || e.code === 'KeyD') this.input.x = 1;
        });

        window.addEventListener('keyup', (e) => {
            if (e.code === 'Space') this.jumpPressed = false;
            if ((e.code === 'ArrowLeft' || e.code === 'KeyA') && this.input.x < 0) this.input.x = 0;
            if ((e.code === 'ArrowRight' || e.code === 'KeyD') && this.input.x > 0) this.input.x = 0;
        });

        // Mobile
        if (this.isMobile) {
            const zone = document.getElementById('joystick-zone');
            const manager = nipplejs.create({
                zone: zone,
                mode: 'static',
                position: { left: '50%', top: '50%' },
                color: 'black'
            });

            manager.on('move', (evt, data) => {
                const force = Math.min(data.force, 1.0); // Clamp force
                this.input.x = Math.cos(data.angle.radian) * force;
            });

            manager.on('end', () => {
                this.input.x = 0;
            });

            const jumpBtn = document.getElementById('jump-zone');
            jumpBtn.addEventListener('touchstart', (e) => { e.preventDefault(); this.jumpPressed = true; });
            jumpBtn.addEventListener('touchend', (e) => { e.preventDefault(); this.jumpPressed = false; });
        }
    }

    start() {
        if (this.isRunning) return;
        this.world.reset();
        this.player.reset();
        this.isRunning = true;

        // Start Ambience
        if (this.ambientSource) this.ambientSource.stop();
        this.ambientSource = this.playSound('ambient', true);

        this.animate();
    }

    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    animate() {
        if (!this.isRunning) return;
        requestAnimationFrame(() => this.animate());

        // Smooth World Rotation
        // We rotate the container holding the level geometry
        // The player stays upright, the world spins to match the current 'gravity'
        const currentRot = this.world.meshContainer.rotation.z;
        const targetRot = this.player.targetWorldRotation;

        // Lerp rotation
        this.world.meshContainer.rotation.z += (targetRot - currentRot) * 0.1;

        // Update Physics
        this.player.handleInput(this.input, this.jumpPressed);
        const event = this.player.update(this.world, this.world.meshContainer.rotation.z);

        if (event === 'jump') this.playSound('jump');
        if (event === 'dead') {
            this.gameOver();
            return;
        }

        // Generate World
        this.world.update(this.player.position.z);

        // UI Update
        const dist = Math.floor(Math.abs(this.player.position.z));
        this.scoreDisplay.textContent = `DISTANCE: ${dist}`;

        this.renderer.render(this.scene, this.camera);
    }

    gameOver() {
        this.isRunning = false;
        if (this.ambientSource) this.ambientSource.stop();
        document.getElementById('title-overlay').style.display = 'block';
        document.getElementById('start-btn').textContent = "TRY AGAIN";
    }
}