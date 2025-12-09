export function clamp(val, min, max) {
    return Math.min(Math.max(val, min), max);
}

export function loadTexture(path) {
    return new Promise((resolve) => {
        const loader = new import('three').TextureLoader();
        loader.load(path, (tex) => resolve(tex));
    });
}

