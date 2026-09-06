import { KerrPhysics } from './kerr-physics.js';

export class UIController {
    constructor(renderer, orbitEngine, audio) {
        this.renderer = renderer;
        this.orbitEngine = orbitEngine;
        this.audio = audio;
        this.currentMode = 'observatory';

        this.fpsHistory = [];
        this.lastFpsUpdate = performance.now();

        this.cacheElements();
        this.bindEvents();
        this.updateTelemetry();
    }

    cacheElements() {
        this.el = {
            webglCanvas: document.getElementById('webgl-canvas'),
            orbitCanvas: document.getElementById('orbit-canvas'),
            canvasContainer: document.getElementById('canvas-container'),

            btnModeObservatory: document.getElementById('btn-mode-observatory'),
            btnModeOrbit: document.getElementById('btn-mode-orbit'),
            presetSelect: document.getElementById('preset-select'),

            btnAudio: document.getElementById('btn-audio'),
            btnTheory: document.getElementById('btn-theory'),
            theoryModal: document.getElementById('theory-modal'),
            btnCloseModal: document.getElementById('btn-close-modal'),
            btnToggleControls: document.getElementById('btn-toggle-controls'),
            btnToggleHud: document.getElementById('btn-toggle-hud'),
            controlsSidebar: document.getElementById('controls-sidebar'),
            telemetryHud: document.getElementById('telemetry-hud'),

            sliderSpin: document.getElementById('slider-spin'),
            valSpin: document.getElementById('val-spin'),

            checkLockIsco: document.getElementById('check-lock-isco'),
            sliderRIn: document.getElementById('slider-rin'),
            valRIn: document.getElementById('val-rin'),
            sliderROut: document.getElementById('slider-rout'),
            valROut: document.getElementById('val-rout'),
            sliderDiskOpacity: document.getElementById('slider-disk-opacity'),
            valDiskOpacity: document.getElementById('val-disk-opacity'),
            sliderDiskTemp: document.getElementById('slider-disk-temp'),
            valDiskTemp: document.getElementById('val-disk-temp'),
            sliderBeaming: document.getElementById('slider-beaming'),
            valBeaming: document.getElementById('val-beaming'),
            checkRedshift: document.getElementById('check-redshift'),
            sliderRotationSpeed: document.getElementById('slider-rotation-speed'),
            valRotationSpeed: document.getElementById('val-rotation-speed'),

            checkLensing: document.getElementById('check-lensing'),
            checkStarGrid: document.getElementById('check-star-grid'),
            checkErgosphere: document.getElementById('check-ergosphere'),
            selectQuality: document.getElementById('select-quality'),
            selectResolution: document.getElementById('select-resolution'),

            orbitControlsSection: document.getElementById('orbit-controls-section'),
            btnOrbitRosette: document.getElementById('btn-orbit-rosette'),
            btnOrbitLenseThirring: document.getElementById('btn-orbit-lt'),
            btnOrbitZoomWhirl: document.getElementById('btn-orbit-zw'),
            btnOrbitPenrose: document.getElementById('btn-orbit-penrose'),
            btnTriggerFission: document.getElementById('btn-trigger-fission'),
            btnClearParticles: document.getElementById('btn-clear-particles'),
            btnPauseSim: document.getElementById('btn-pause-sim'),

            telSpin: document.getElementById('tel-spin'),
            telRPlus: document.getElementById('tel-rplus'),
            telRMinus: document.getElementById('tel-rminus'),
            telErgoEq: document.getElementById('tel-ergo-eq'),
            telIsco: document.getElementById('tel-isco'),
            telPhotonSphere: document.getElementById('tel-photon-sphere'),
            telOmegaH: document.getElementById('tel-omega-h'),
            telIrrMass: document.getElementById('tel-irr-mass'),
            telRotEnergy: document.getElementById('tel-rot-energy'),
            telFps: document.getElementById('tel-fps'),
            telSteps: document.getElementById('tel-steps')
        };
    }

    bindEvents() {
        this.el.btnModeObservatory.addEventListener('click', () => this.setMode('observatory'));
        this.el.btnModeOrbit.addEventListener('click', () => this.setMode('orbit'));

        this.el.presetSelect.addEventListener('change', (e) => this.applyPreset(e.target.value));

        this.el.btnAudio.addEventListener('click', () => {
            const isPlaying = this.audio.toggle();
            this.el.btnAudio.classList.toggle('active', isPlaying);
            this.el.btnAudio.innerHTML = isPlaying 
                ? '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg> <span>AUDIO ON</span>'
                : '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/></svg> <span>AUDIO OFF</span>';
        });

        this.el.btnTheory.addEventListener('click', () => this.openTheoryModal());
        this.el.btnCloseModal.addEventListener('click', () => this.closeTheoryModal());
        this.el.theoryModal.addEventListener('click', (e) => {
            if (e.target === this.el.theoryModal) this.closeTheoryModal();
        });

        this.el.btnToggleControls.addEventListener('click', () => {
            this.el.controlsSidebar.classList.toggle('collapsed');
        });
        this.el.btnToggleHud.addEventListener('click', () => {
            this.el.telemetryHud.classList.toggle('collapsed');
        });

        this.el.sliderSpin.addEventListener('input', (e) => {
            const val = parseFloat(e.target.value);
            this.el.valSpin.textContent = val.toFixed(3);
            this.renderer.params.spin = val;
            this.orbitEngine.setSpin(val);

            if (this.renderer.params.autoLockISCO) {
                const isco = KerrPhysics.computeISCO(val);
                this.renderer.params.rIn = isco.prograde;
                this.el.sliderRIn.value = isco.prograde.toFixed(2);
                this.el.valRIn.textContent = isco.prograde.toFixed(2);
            }
            this.updateTelemetry();
        });

        this.el.checkLockIsco.addEventListener('change', (e) => {
            this.renderer.params.autoLockISCO = e.target.checked;
            this.el.sliderRIn.disabled = e.target.checked;
            if (e.target.checked) {
                const isco = KerrPhysics.computeISCO(this.renderer.params.spin);
                this.renderer.params.rIn = isco.prograde;
                this.el.sliderRIn.value = isco.prograde.toFixed(2);
                this.el.valRIn.textContent = isco.prograde.toFixed(2);
            }
        });

        this.el.sliderRIn.addEventListener('input', (e) => {
            const val = parseFloat(e.target.value);
            this.renderer.params.rIn = val;
            this.el.valRIn.textContent = val.toFixed(2);
        });

        this.el.sliderROut.addEventListener('input', (e) => {
            const val = parseFloat(e.target.value);
            this.renderer.params.rOut = val;
            this.el.valROut.textContent = val.toFixed(1);
        });

        this.el.sliderDiskOpacity.addEventListener('input', (e) => {
            const val = parseFloat(e.target.value);
            this.renderer.params.diskOpacity = val;
            this.el.valDiskOpacity.textContent = val.toFixed(2);
        });

        this.el.sliderDiskTemp.addEventListener('input', (e) => {
            const val = parseFloat(e.target.value);
            this.renderer.params.diskTempScale = val;
            this.el.valDiskTemp.textContent = val.toFixed(1);
        });

        this.el.sliderBeaming.addEventListener('input', (e) => {
            const val = parseFloat(e.target.value);
            this.renderer.params.beamingFactor = val;
            this.el.valBeaming.textContent = val.toFixed(1);
        });

        this.el.checkRedshift.addEventListener('change', (e) => {
            this.renderer.params.enableRedshift = e.target.checked;
        });

        this.el.sliderRotationSpeed.addEventListener('input', (e) => {
            const val = parseFloat(e.target.value);
            this.renderer.params.rotationSpeed = val;
            this.el.valRotationSpeed.textContent = val.toFixed(1) + 'x';
        });

        this.el.checkLensing.addEventListener('change', (e) => {
            this.renderer.params.enableLensing = e.target.checked;
        });
        this.el.checkStarGrid.addEventListener('change', (e) => {
            this.renderer.params.starGrid = e.target.checked;
        });
        this.el.checkErgosphere.addEventListener('change', (e) => {
            this.renderer.params.enableErgosphere = e.target.checked;
        });

        this.el.selectQuality.addEventListener('change', (e) => {
            const steps = parseInt(e.target.value, 10);
            this.renderer.stepBudget = steps;
            this.el.telSteps.textContent = steps;
        });

        this.el.selectResolution.addEventListener('change', (e) => {
            const scale = parseFloat(e.target.value);
            this.renderer.resolutionScale = scale;
            this.renderer.resize();
        });

        this.el.btnOrbitRosette.addEventListener('click', () => this.orbitEngine.loadPreset('rosette'));
        this.el.btnOrbitLenseThirring.addEventListener('click', () => this.orbitEngine.loadPreset('lense_thirring'));
        this.el.btnOrbitZoomWhirl.addEventListener('click', () => this.orbitEngine.loadPreset('zoom_whirl'));
        this.el.btnOrbitPenrose.addEventListener('click', () => this.orbitEngine.loadPreset('penrose'));
        this.el.btnTriggerFission.addEventListener('click', () => this.orbitEngine.triggerPenroseFission());
        this.el.btnClearParticles.addEventListener('click', () => this.orbitEngine.clearParticles());
        this.el.btnPauseSim.addEventListener('click', () => {
            this.orbitEngine.paused = !this.orbitEngine.paused;
            this.renderer.params.paused = this.orbitEngine.paused;
            this.el.btnPauseSim.textContent = this.orbitEngine.paused ? 'RESUME' : 'PAUSE';
        });

        window.addEventListener('keydown', (e) => {
            if (e.key === ' ' || e.code === 'Space') {
                e.preventDefault();
                this.orbitEngine.paused = !this.orbitEngine.paused;
                this.renderer.params.paused = this.orbitEngine.paused;
                this.el.btnPauseSim.textContent = this.orbitEngine.paused ? 'RESUME' : 'PAUSE';
            } else if (e.key === 'm' || e.key === 'M') {
                this.setMode(this.currentMode === 'observatory' ? 'orbit' : 'observatory');
            } else if (e.key === 'h' || e.key === 'H') {
                this.el.telemetryHud.classList.toggle('collapsed');
            } else if (e.key === 't' || e.key === 'T') {
                this.openTheoryModal();
            } else if (e.key === 'Escape') {
                this.closeTheoryModal();
            } else if (e.key === 'r' || e.key === 'R') {
                this.renderer.camera.targetDistance = 22.0;
                this.renderer.camera.targetAzimuth = 0.85;
                this.renderer.camera.targetInclination = 1.30;
                this.orbitEngine.camera.rotX = 0.65;
                this.orbitEngine.camera.rotZ = 0.45;
                this.orbitEngine.camera.scale = 24.0;
                this.orbitEngine.camera.panX = 0;
                this.orbitEngine.camera.panY = 0;
            }
        });
    }

    setMode(mode) {
        this.currentMode = mode;
        const isObs = mode === 'observatory';

        this.el.btnModeObservatory.classList.toggle('active', isObs);
        this.el.btnModeOrbit.classList.toggle('active', !isObs);

        this.el.webglCanvas.style.display = isObs ? 'block' : 'none';
        this.el.orbitCanvas.style.display = isObs ? 'none' : 'block';

        this.el.orbitControlsSection.style.display = isObs ? 'none' : 'block';
    }

    applyPreset(name) {
        if (name === 'gargantua') {
            this.setSpinValue(0.94);
            this.renderer.camera.targetInclination = 0.30;
            this.renderer.camera.targetDistance = 20.0;
            this.renderer.params.rOut = 16.0;
            this.renderer.params.diskTempScale = 1.4;
            this.renderer.params.beamingFactor = 3.8;
            this.setMode('observatory');
        } else if (name === 'sgra') {
            this.setSpinValue(0.52);
            this.renderer.camera.targetInclination = 1.43;
            this.renderer.camera.targetDistance = 24.0;
            this.renderer.params.rOut = 13.0;
            this.renderer.params.diskTempScale = 1.0;
            this.renderer.params.beamingFactor = 3.2;
            this.setMode('observatory');
        } else if (name === 'extremal') {
            this.setSpinValue(0.998);
            this.renderer.camera.targetInclination = 1.15;
            this.renderer.camera.targetDistance = 18.0;
            this.renderer.params.diskTempScale = 1.6;
            this.renderer.params.beamingFactor = 4.0;
            this.setMode('observatory');
        } else if (name === 'schwarzschild') {
            this.setSpinValue(0.0);
            this.renderer.camera.targetInclination = 0.85;
            this.renderer.camera.targetDistance = 22.0;
            this.renderer.params.rOut = 15.0;
            this.renderer.params.beamingFactor = 2.5;
            this.setMode('observatory');
        } else if (name === 'penrose') {
            this.setSpinValue(0.98);
            this.setMode('orbit');
            this.orbitEngine.loadPreset('penrose');
        } else if (name === 'zoomwhirl') {
            this.setSpinValue(0.92);
            this.setMode('orbit');
            this.orbitEngine.loadPreset('zoom_whirl');
        }
        this.updateTelemetry();
    }

    setSpinValue(val) {
        this.el.sliderSpin.value = val.toFixed(3);
        this.el.valSpin.textContent = val.toFixed(3);
        this.renderer.params.spin = val;
        this.orbitEngine.setSpin(val);

        if (this.renderer.params.autoLockISCO) {
            const isco = KerrPhysics.computeISCO(val);
            this.renderer.params.rIn = isco.prograde;
            this.el.sliderRIn.value = isco.prograde.toFixed(2);
            this.el.valRIn.textContent = isco.prograde.toFixed(2);
        }
    }

    updateTelemetry() {
        const a = this.renderer.params.spin;
        const M = 1.0;

        const horizons = KerrPhysics.computeHorizons(a, M);
        const isco = KerrPhysics.computeISCO(a, M);
        const photon = KerrPhysics.computePhotonOrbits(a, M);
        const energetics = KerrPhysics.computeEnergetics(a, M);

        this.el.telSpin.textContent = `${a.toFixed(3)} M`;
        this.el.telRPlus.textContent = `${horizons.rPlus.toFixed(3)} M`;
        this.el.telRMinus.textContent = `${horizons.rMinus.toFixed(3)} M`;
        this.el.telErgoEq.textContent = `2.000 M`;
        this.el.telIsco.textContent = `${isco.prograde.toFixed(3)} M`;
        this.el.telPhotonSphere.textContent = `${photon.prograde.toFixed(3)} M`;
        this.el.telOmegaH.textContent = `${energetics.omegaH.toFixed(3)} c/M`;
        this.el.telIrrMass.textContent = `${energetics.irreducibleMass.toFixed(3)} M`;
        this.el.telRotEnergy.textContent = `${energetics.extractablePercentage.toFixed(1)}%`;
        this.el.telSteps.textContent = this.renderer.stepBudget;
    }

    updateFps(now) {
        const delta = now - this.lastFpsUpdate;
        if (delta > 0) {
            const fps = 1000.0 / delta;
            this.fpsHistory.push(fps);
            if (this.fpsHistory.length > 20) this.fpsHistory.shift();

            const avgFps = Math.round(this.fpsHistory.reduce((a, b) => a + b, 0) / this.fpsHistory.length);
            this.el.telFps.textContent = `${avgFps} FPS`;
        }
        this.lastFpsUpdate = now;
    }

    openTheoryModal() {
        this.el.theoryModal.classList.add('visible');
        if (window.renderMathInElement) {
            try {
                window.renderMathInElement(this.el.theoryModal, {
                    delimiters: [
                        {left: '$$', right: '$$', display: true},
                        {left: '$', right: '$', display: false}
                    ]
                });
            } catch (e) {
                console.warn('KaTeX render warning:', e);
            }
        }
    }

    closeTheoryModal() {
        this.el.theoryModal.classList.remove('visible');
    }
}
