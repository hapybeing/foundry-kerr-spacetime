import { KerrRenderer } from './gl-renderer.js';
import { OrbitEngine } from './orbit-engine.js';
import { KerrAudio } from './audio.js';
import { UIController } from './ui.js';
import { KerrPhysics } from './kerr-physics.js';

window.addEventListener('DOMContentLoaded', () => {
    const webglCanvas = document.getElementById('webgl-canvas');
    const orbitCanvas = document.getElementById('orbit-canvas');

    let renderer = null;
    let orbitEngine = null;
    let audio = null;
    let ui = null;

    try {
        renderer = new KerrRenderer(webglCanvas, {
            resolutionScale: 1.0,
            stepBudget: 80
        });
    } catch (err) {
        console.error('Failed to initialize WebGL2 Kerr Renderer:', err);
        const errorMsg = document.createElement('div');
        errorMsg.className = 'webgl-fallback-banner';
        errorMsg.innerHTML = `
            <h3>WebGL 2.0 Hardware Acceleration Required</h3>
            <p>${err.message}</p>
            <p>Falling back to 2D/3D Orbital Dynamics Engine.</p>
        `;
        document.getElementById('canvas-container').appendChild(errorMsg);
    }

    try {
        orbitEngine = new OrbitEngine(orbitCanvas);
    } catch (err) {
        console.error('Failed to initialize Orbit Engine:', err);
    }

    audio = new KerrAudio();

    if (renderer && orbitEngine) {
        ui = new UIController(renderer, orbitEngine, audio);
    }

    function handleResize() {
        const width = window.innerWidth;
        const height = window.innerHeight;

        if (orbitCanvas) {
            orbitCanvas.width = width * window.devicePixelRatio;
            orbitCanvas.height = height * window.devicePixelRatio;
            orbitCanvas.style.width = width + 'px';
            orbitCanvas.style.height = height + 'px';
        }

        if (renderer) {
            renderer.resize();
        }
    }

    window.addEventListener('resize', handleResize);
    handleResize();

    let lastTime = performance.now();

    function animate(now) {
        requestAnimationFrame(animate);

        const dt = Math.min(0.1, (now - lastTime) / 1000.0);
        lastTime = now;

        if (ui) {
            ui.updateFps(now);

            if (ui.currentMode === 'observatory' && renderer) {
                renderer.render(dt);
            } else if (ui.currentMode === 'orbit' && orbitEngine) {
                orbitEngine.update(dt);
                orbitEngine.render();
            }

            if (audio && audio.isPlaying && renderer) {
                const a = renderer.params.spin;
                const dist = renderer.camera.distance;
                const { omegaH } = KerrPhysics.computeEnergetics(a, 1.0);
                audio.update(a, dist, omegaH);
            }
        }
    }

    requestAnimationFrame(animate);
});
