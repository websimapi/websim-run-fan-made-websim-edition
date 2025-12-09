export const TILE_SIZE = 4;
export const TUNNEL_RADIUS = 7; // Distance from center to wall
export const VIEW_DISTANCE = 80; // See further
export const PLAYER_SPEED = 0.17; // Slower for better reaction time
export const JUMP_FORCE = 0.42;
export const GRAVITY = 0.018; // Lower gravity for floatier, easier jumps
export const LATERAL_SPEED = 0.20; // Slightly faster strafing for responsiveness
export const WORLD_ROTATION_SPEED = 0.1;

export const LEVEL_COLORS = [
    0x00aaff, // L1: Blue
    0xffaa00, // L2: Orange
    0x00ff44, // L3: Green
    0xff4444, // L4: Red
    0xaa00ff, // L5: Purple
    0xffff00, // L6: Yellow
    0x00ffff, // L7: Cyan
    0xff00ff  // L8: Magenta
];

export const COLORS = {
    background: 0x001a33,
    fog: 0x001a33,
    tile: 0x6688aa, // Default fallback
    player: 0x222222
};

