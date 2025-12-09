import * as THREE from 'three';
import { Game } from './Game.js';

const container = document.getElementById('game-container');
const startBtn = document.getElementById('start-btn');
const titleOverlay = document.getElementById('title-overlay');
const mobileControls = document.getElementById('mobile-controls');
const desktopHint = document.getElementById('desktop-hint');

// Mobile Detection
const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

if (isMobile) {
    mobileControls.style.display = 'block';
    desktopHint.style.display = 'none';
}

const game = new Game(container, isMobile);

startBtn.addEventListener('click', async () => {
    titleOverlay.style.display = 'none';
    
    // Audio Context Resume for browsers
    if (game.audioCtx && game.audioCtx.state === 'suspended') {
        await game.audioCtx.resume();
    }
    
    game.start();
});

window.addEventListener('resize', () => {
    game.onWindowResize();
});

