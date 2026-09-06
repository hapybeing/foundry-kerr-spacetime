export class KerrAudio {
    constructor() {
        this.ctx = null;
        this.isPlaying = false;
        this.gainNode = null;
        this.filterNode = null;
        this.oscLeft = null;
        this.oscRight = null;
        this.subOsc = null;
        this.pannerLeft = null;
        this.pannerRight = null;
    }

    init() {
        if (this.ctx) return;
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return;

        this.ctx = new AudioContext();

        this.gainNode = this.ctx.createGain();
        this.gainNode.gain.setValueAtTime(0.0001, this.ctx.currentTime);
        this.gainNode.connect(this.ctx.destination);

        this.filterNode = this.ctx.createBiquadFilter();
        this.filterNode.type = 'lowpass';
        this.filterNode.frequency.setValueAtTime(320, this.ctx.currentTime);
        this.filterNode.Q.setValueAtTime(2.5, this.ctx.currentTime);
        this.filterNode.connect(this.gainNode);

        this.pannerLeft = this.ctx.createStereoPanner ? this.ctx.createStereoPanner() : null;
        this.pannerRight = this.ctx.createStereoPanner ? this.ctx.createStereoPanner() : null;
        if (this.pannerLeft) this.pannerLeft.pan.value = -0.75;
        if (this.pannerRight) this.pannerRight.pan.value = 0.75;

        this.oscLeft = this.ctx.createOscillator();
        this.oscLeft.type = 'sine';
        this.oscLeft.frequency.setValueAtTime(55.0, this.ctx.currentTime);

        this.oscRight = this.ctx.createOscillator();
        this.oscRight.type = 'sine';
        this.oscRight.frequency.setValueAtTime(55.0, this.ctx.currentTime);

        this.subOsc = this.ctx.createOscillator();
        this.subOsc.type = 'triangle';
        this.subOsc.frequency.setValueAtTime(27.5, this.ctx.currentTime);

        const subGain = this.ctx.createGain();
        subGain.gain.setValueAtTime(0.35, this.ctx.currentTime);
        this.subOsc.connect(subGain);
        subGain.connect(this.filterNode);

        if (this.pannerLeft && this.pannerRight) {
            this.oscLeft.connect(this.pannerLeft);
            this.pannerLeft.connect(this.filterNode);

            this.oscRight.connect(this.pannerRight);
            this.pannerRight.connect(this.filterNode);
        } else {
            this.oscLeft.connect(this.filterNode);
            this.oscRight.connect(this.filterNode);
        }

        this.oscLeft.start();
        this.oscRight.start();
        this.subOsc.start();
    }

    toggle() {
        if (!this.ctx) {
            this.init();
        }

        if (this.ctx.state === 'suspended') {
            this.ctx.resume();
        }

        this.isPlaying = !this.isPlaying;
        const targetGain = this.isPlaying ? 0.28 : 0.0001;
        this.gainNode.gain.cancelScheduledValues(this.ctx.currentTime);
        this.gainNode.gain.exponentialRampToValueAtTime(targetGain, this.ctx.currentTime + 0.8);
        return this.isPlaying;
    }

    update(spin, cameraDistance, omegaH) {
        if (!this.isPlaying || !this.ctx) return;

        const now = this.ctx.currentTime;
        const baseFreq = 48.0 + Math.abs(spin) * 24.0 + omegaH * 16.0;
        const beatFreq = 0.5 + Math.abs(spin) * 3.5;

        this.oscLeft.frequency.setTargetAtTime(baseFreq, now, 0.1);
        this.oscRight.frequency.setTargetAtTime(baseFreq + beatFreq, now, 0.1);
        this.subOsc.frequency.setTargetAtTime(baseFreq * 0.5, now, 0.1);

        const cutoff = Math.max(120.0, Math.min(800.0, cameraDistance * 25.0));
        this.filterNode.frequency.setTargetAtTime(cutoff, now, 0.15);
    }
}
