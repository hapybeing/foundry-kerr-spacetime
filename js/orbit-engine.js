import { KerrPhysics } from './kerr-physics.js';

export class OrbitEngine {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        if (!this.ctx) {
            throw new Error('Canvas 2D context not supported.');
        }

        this.particles = [];
        this.trailLength = 400;
        this.timeScale = 1.0;
        this.paused = false;

        this.camera = {
            rotX: 0.65,
            rotZ: 0.45,
            scale: 24.0,
            panX: 0,
            panY: 0
        };

        this.spin = 0.94;
        this.M = 1.0;

        this.penroseStats = {
            active: false,
            initialEnergy: 0,
            extractedEnergy: 0,
            efficiency: 0,
            eventLog: []
        };

        this.setupInteractions();
        this.loadPreset('rosette');
    }

    setupInteractions() {
        let isDragging = false;
        let isPanning = false;
        let lastX = 0;
        let lastY = 0;

        this.canvas.addEventListener('mousedown', (e) => {
            if (e.button === 2 || e.shiftKey) {
                isPanning = true;
            } else {
                isDragging = true;
            }
            lastX = e.clientX;
            lastY = e.clientY;
        });

        window.addEventListener('mousemove', (e) => {
            if (!isDragging && !isPanning) return;
            const dx = e.clientX - lastX;
            const dy = e.clientY - lastY;
            lastX = e.clientX;
            lastY = e.clientY;

            if (isDragging) {
                this.camera.rotZ += dx * 0.008;
                this.camera.rotX = Math.max(0.1, Math.min(Math.PI * 0.5 - 0.05, this.camera.rotX + dy * 0.008));
            } else if (isPanning) {
                this.camera.panX += dx;
                this.camera.panY += dy;
            }
        });

        window.addEventListener('mouseup', () => {
            isDragging = false;
            isPanning = false;
        });

        this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());

        this.canvas.addEventListener('wheel', (e) => {
            e.preventDefault();
            const zoomFactor = e.deltaY > 0 ? 0.92 : 1.08;
            this.camera.scale = Math.max(5.0, Math.min(120.0, this.camera.scale * zoomFactor));
        }, { passive: false });

        let touchStartDist = 0;
        this.canvas.addEventListener('touchstart', (e) => {
            if (e.touches.length === 1) {
                isDragging = true;
                lastX = e.touches[0].clientX;
                lastY = e.touches[0].clientY;
            } else if (e.touches.length === 2) {
                isDragging = false;
                touchStartDist = Math.hypot(
                    e.touches[0].clientX - e.touches[1].clientX,
                    e.touches[0].clientY - e.touches[1].clientY
                );
            }
        });

        this.canvas.addEventListener('touchmove', (e) => {
            if (isDragging && e.touches.length === 1) {
                const dx = e.touches[0].clientX - lastX;
                const dy = e.touches[0].clientY - lastY;
                lastX = e.touches[0].clientX;
                lastY = e.touches[0].clientY;
                this.camera.rotZ += dx * 0.01;
                this.camera.rotX = Math.max(0.1, Math.min(Math.PI * 0.5 - 0.05, this.camera.rotX + dy * 0.01));
            } else if (e.touches.length === 2) {
                const dist = Math.hypot(
                    e.touches[0].clientX - e.touches[1].clientX,
                    e.touches[0].clientY - e.touches[1].clientY
                );
                const factor = dist / (touchStartDist || 1);
                this.camera.scale = Math.max(5.0, Math.min(120.0, this.camera.scale * factor));
                touchStartDist = dist;
            }
        }, { passive: true });

        this.canvas.addEventListener('touchend', () => {
            isDragging = false;
        });
    }

    setSpin(a) {
        this.spin = Math.max(-0.998, Math.min(0.998, a));
    }

    kerrDerivatives(pos, p, isNull = false) {
        const x = pos[0], y = pos[1], z = pos[2];
        const px = p[0], py = p[1], pz = p[2];
        const a = this.spin;
        const M = this.M;

        const p2 = x * x + y * y + z * z;
        const a2 = a * a;
        const rho = p2 - a2;
        const disc = Math.sqrt(Math.max(1e-8, rho * rho + 4.0 * a2 * z * z));
        const r2 = 0.5 * (rho + disc);
        const r = Math.sqrt(Math.max(1e-8, r2));

        const D_k = r2 + a2;
        const kx = (r * x + a * y) / D_k;
        const ky = (r * y - a * x) / D_k;
        const kz = z / r;

        const denom = r2 * r2 + a2 * z * z;
        const f = (2.0 * M * r2 * r) / Math.max(1e-8, denom);

        const p0 = - p.energy;
        const k_dot_p = -p0 + kx * px + ky * py + kz * pz;

        const vx = px - f * kx * k_dot_p;
        const vy = py - f * ky * k_dot_p;
        const vz = pz - f * kz * k_dot_p;

        const rho_over_disc = rho / disc;
        const grad_r2_x = x * (1.0 + rho_over_disc);
        const grad_r2_y = y * (1.0 + rho_over_disc);
        const grad_r2_z = z * (1.0 + (rho + 2.0 * a2) / disc);

        const grad_rx = grad_r2_x / (2.0 * r);
        const grad_ry = grad_r2_y / (2.0 * r);
        const grad_rz = grad_r2_z / (2.0 * r);

        const df_dr = 2.0 * M * r2 * (3.0 * denom - 4.0 * r2 * r2) / Math.max(1e-8, denom * denom);
        const grad_fx = df_dr * grad_rx;
        const grad_fy = df_dr * grad_ry;
        const grad_fz = df_dr * grad_rz - (4.0 * M * r2 * r * a2 * z) / Math.max(1e-8, denom * denom);

        const P_dot_X = px * x + py * y;
        const P_cross_X = px * y - py * x;
        const S = r * P_dot_X + a * P_cross_X;

        const grad_Sx = r * px + grad_rx * P_dot_X - a * py;
        const grad_Sy = r * py + grad_ry * P_dot_X + a * px;
        const grad_Sz = grad_rz * P_dot_X;

        const term1_x = (grad_Sx * D_k - S * grad_r2_x) / (D_k * D_k);
        const term1_y = (grad_Sy * D_k - S * grad_r2_y) / (D_k * D_k);
        const term1_z = (grad_Sz * D_k - S * grad_r2_z) / (D_k * D_k);

        const term2_x = - pz * z * grad_rx / r2;
        const term2_y = - pz * z * grad_ry / r2;
        const term2_z = pz * (r - z * grad_rz) / r2;

        const grad_k_dot_p_x = term1_x + term2_x;
        const grad_k_dot_p_y = term1_y + term2_y;
        const grad_k_dot_p_z = term1_z + term2_z;

        const k_dot_p2 = k_dot_p * k_dot_p;
        const dpx = 0.5 * grad_fx * k_dot_p2 + f * k_dot_p * grad_k_dot_p_x;
        const dpy = 0.5 * grad_fy * k_dot_p2 + f * k_dot_p * grad_k_dot_p_y;
        const dpz = 0.5 * grad_fz * k_dot_p2 + f * k_dot_p * grad_k_dot_p_z;

        return {
            dx: [vx, vy, vz],
            dp: [-dpx, -dpy, -dpz],
            r: r,
            f: f,
            rPlus: M + Math.sqrt(Math.max(0.0, M * M - a2))
        };
    }

    rk4Step(particle, dt) {
        const x0 = [...particle.pos];
        const p0 = {
            0: particle.p[0],
            1: particle.p[1],
            2: particle.p[2],
            energy: particle.energy
        };

        const k1 = this.kerrDerivatives(x0, p0, particle.isNull);

        const x1 = [
            x0[0] + 0.5 * dt * k1.dx[0],
            x0[1] + 0.5 * dt * k1.dx[1],
            x0[2] + 0.5 * dt * k1.dx[2]
        ];
        const p1 = {
            0: p0[0] + 0.5 * dt * k1.dp[0],
            1: p0[1] + 0.5 * dt * k1.dp[1],
            2: p0[2] + 0.5 * dt * k1.dp[2],
            energy: particle.energy
        };

        const k2 = this.kerrDerivatives(x1, p1, particle.isNull);

        const x2 = [
            x0[0] + 0.5 * dt * k2.dx[0],
            x0[1] + 0.5 * dt * k2.dx[1],
            x0[2] + 0.5 * dt * k2.dx[2]
        ];
        const p2 = {
            0: p0[0] + 0.5 * dt * k2.dp[0],
            1: p0[1] + 0.5 * dt * k2.dp[1],
            2: p0[2] + 0.5 * dt * k2.dp[2],
            energy: particle.energy
        };

        const k3 = this.kerrDerivatives(x2, p2, particle.isNull);

        const x3 = [
            x0[0] + dt * k3.dx[0],
            x0[1] + dt * k3.dx[1],
            x0[2] + dt * k3.dx[2]
        ];
        const p3 = {
            0: p0[0] + dt * k3.dp[0],
            1: p0[1] + dt * k3.dp[1],
            2: p0[2] + dt * k3.dp[2],
            energy: particle.energy
        };

        const k4 = this.kerrDerivatives(x3, p3, particle.isNull);

        particle.pos[0] += (dt / 6.0) * (k1.dx[0] + 2 * k2.dx[0] + 2 * k3.dx[0] + k4.dx[0]);
        particle.pos[1] += (dt / 6.0) * (k1.dx[1] + 2 * k2.dx[1] + 2 * k3.dx[1] + k4.dx[1]);
        particle.pos[2] += (dt / 6.0) * (k1.dx[2] + 2 * k2.dx[2] + 2 * k3.dx[2] + k4.dx[2]);

        particle.p[0] += (dt / 6.0) * (k1.dp[0] + 2 * k2.dp[0] + 2 * k3.dp[0] + k4.dp[0]);
        particle.p[1] += (dt / 6.0) * (k1.dp[1] + 2 * k2.dp[1] + 2 * k3.dp[1] + k4.dp[1]);
        particle.p[2] += (dt / 6.0) * (k1.dp[2] + 2 * k2.dp[2] + 2 * k3.dp[2] + k4.dp[2]);

        particle.currentR = k1.r;
        particle.inErgosphere = k1.f > 1.0 && k1.r > k1.rPlus;

        if (k1.r <= k1.rPlus * 1.01) {
            particle.status = 'captured';
        } else if (k1.r > 60.0) {
            particle.status = 'escaped';
        }
    }

    addParticle(config) {
        const particle = {
            id: Math.random().toString(36).substring(2, 9),
            name: config.name || 'Test Particle',
            pos: [...config.pos],
            p: [...config.p],
            energy: config.energy ?? 1.0,
            color: config.color || '#00f0ff',
            trail: [],
            status: 'active',
            isNull: config.isNull || false,
            currentR: Math.hypot(...config.pos),
            inErgosphere: false,
            role: config.role || 'normal'
        };
        this.particles.push(particle);
        return particle;
    }

    clearParticles() {
        this.particles = [];
    }

    loadPreset(name) {
        this.clearParticles();

        if (name === 'rosette') {
            this.setSpin(0.85);
            this.addParticle({
                name: 'Bound Rosette Orbit',
                pos: [8.5, 0.0, 0.0],
                p: [0.0, 0.22, 0.0],
                energy: 0.94,
                color: '#00f0ff'
            });
        } else if (name === 'lense_thirring') {
            this.setSpin(0.96);
            this.addParticle({
                name: 'Lense-Thirring Precessor',
                pos: [7.0, 0.0, 2.5],
                p: [0.0, 0.24, -0.08],
                energy: 0.95,
                color: '#f5a623'
            });
        } else if (name === 'zoom_whirl') {
            this.setSpin(0.92);
            this.addParticle({
                name: 'Zoom-Whirl Trajectory',
                pos: [9.2, 0.0, 0.0],
                p: [0.0, 0.208, 0.0],
                energy: 0.945,
                color: '#ff2a5f'
            });
        } else if (name === 'penrose') {
            this.setSpin(0.98);
            this.penroseStats.active = true;
            this.penroseStats.initialEnergy = 1.0;
            this.penroseStats.eventLog = ['Particle launched toward ergosphere with E_0 = 1.00 M'];

            const parent = this.addParticle({
                name: 'Parent Particle (E = 1.00)',
                pos: [14.0, 2.8, 0.0],
                p: [-0.32, -0.05, 0.0],
                energy: 1.0,
                color: '#00f0ff',
                role: 'parent'
            });

            this.penroseParentId = parent.id;
            this.penroseFissionDone = false;
        }
    }

    triggerPenroseFission() {
        const parent = this.particles.find(p => p.role === 'parent' && p.status === 'active');
        if (!parent) return;

        const pos = [...parent.pos];
        const px = parent.p[0];
        const py = parent.p[1];
        const pz = parent.p[2];

        parent.status = 'disintegrated';

        const frag1 = this.addParticle({
            name: 'Infalling Fragment (E_1 = -0.22)',
            pos: [...pos],
            p: [px * 0.8 - 0.25, py * 0.8 + 0.15, pz],
            energy: -0.22,
            color: '#ff2a5f',
            role: 'negative_fragment'
        });

        const frag2 = this.addParticle({
            name: 'Escaping Fragment (E_2 = 1.22, +22%)',
            pos: [...pos],
            p: [px * 1.2 + 0.25, py * 1.2 - 0.15, pz],
            energy: 1.22,
            color: '#39ff14',
            role: 'escaping_fragment'
        });

        this.penroseStats.extractedEnergy = 1.22;
        this.penroseStats.efficiency = 22.0;
        this.penroseStats.eventLog.push('Fission triggered in Ergosphere!');
        this.penroseStats.eventLog.push('Fragment 1: Negative Energy E_1 = -0.22 M plunges to horizon');
        this.penroseStats.eventLog.push('Fragment 2: Escapes to infinity with E_2 = 1.22 M (+22% Net Energy Gain!)');
        this.penroseFissionDone = true;
    }

    update(dt) {
        if (this.paused) return;
        const effectiveDt = dt * this.timeScale;

        if (this.penroseStats.active && !this.penroseFissionDone) {
            const parent = this.particles.find(p => p.role === 'parent' && p.status === 'active');
            if (parent && parent.inErgosphere && parent.currentR < 1.95) {
                this.triggerPenroseFission();
            }
        }

        for (const p of this.particles) {
            if (p.status !== 'active') continue;

            const subSteps = 6;
            const subDt = effectiveDt / subSteps;
            for (let s = 0; s < subSteps; s++) {
                if (p.status !== 'active') break;
                this.rk4Step(p, subDt);
            }

            p.trail.push([p.pos[0], p.pos[1], p.pos[2]]);
            if (p.trail.length > this.trailLength) {
                p.trail.shift();
            }
        }
    }

    project(x, y, z) {
        const cosZ = Math.cos(this.camera.rotZ);
        const sinZ = Math.sin(this.camera.rotZ);
        const x1 = x * cosZ - y * sinZ;
        const y1 = x * sinZ + y * cosZ;
        const z1 = z;

        const cosX = Math.cos(this.camera.rotX);
        const sinX = Math.sin(this.camera.rotX);
        const y2 = y1 * cosX - z1 * sinX;
        const z2 = y1 * sinX + z1 * cosX;
        const x2 = x1;

        const cx = this.canvas.width * 0.5 + this.camera.panX;
        const cy = this.canvas.height * 0.5 + this.camera.panY;

        return {
            x: cx + x2 * this.camera.scale,
            y: cy - z2 * this.camera.scale,
            depth: y2
        };
    }

    render() {
        const ctx = this.ctx;
        const width = this.canvas.width;
        const height = this.canvas.height;

        ctx.fillStyle = '#07090e';
        ctx.fillRect(0, 0, width, height);

        this.drawGrid(ctx);
        this.drawBlackHoleStructures(ctx);

        for (const p of this.particles) {
            if (p.trail.length < 2) continue;

            ctx.lineWidth = 2.0;
            for (let i = 1; i < p.trail.length; i++) {
                const pt0 = this.project(p.trail[i - 1][0], p.trail[i - 1][1], p.trail[i - 1][2]);
                const pt1 = this.project(p.trail[i][0], p.trail[i][1], p.trail[i][2]);

                const alpha = Math.pow(i / p.trail.length, 1.8);
                ctx.strokeStyle = p.color;
                ctx.globalAlpha = alpha * 0.85;

                ctx.beginPath();
                ctx.moveTo(pt0.x, pt0.y);
                ctx.lineTo(pt1.x, pt1.y);
                ctx.stroke();
            }

            ctx.globalAlpha = 1.0;

            if (p.status === 'active') {
                const head = this.project(p.pos[0], p.pos[1], p.pos[2]);
                ctx.fillStyle = p.color;
                ctx.shadowColor = p.color;
                ctx.shadowBlur = 12;
                ctx.beginPath();
                ctx.arc(head.x, head.y, 4.5, 0, Math.PI * 2);
                ctx.fill();
                ctx.shadowBlur = 0;

                ctx.fillStyle = '#ffffff';
                ctx.font = '11px monospace';
                ctx.fillText(p.name, head.x + 8, head.y - 6);
            }
        }

        if (this.penroseStats.active) {
            this.drawPenroseOverlay(ctx);
        }
    }

    drawGrid(ctx) {
        ctx.strokeStyle = '#121826';
        ctx.lineWidth = 1.0;
        const extent = 20;
        const step = 4;

        for (let i = -extent; i <= extent; i += step) {
            const p1 = this.project(i, -extent, 0);
            const p2 = this.project(i, extent, 0);
            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.stroke();

            const p3 = this.project(-extent, i, 0);
            const p4 = this.project(extent, i, 0);
            ctx.beginPath();
            ctx.moveTo(p3.x, p3.y);
            ctx.lineTo(p4.x, p4.y);
            ctx.stroke();
        }
    }

    drawBlackHoleStructures(ctx) {
        const a = this.spin;
        const M = this.M;
        const { rPlus } = KerrPhysics.computeHorizons(a, M);
        const isco = KerrPhysics.computeISCO(a, M);

        ctx.strokeStyle = 'rgba(245, 166, 35, 0.45)';
        ctx.setLineDash([4, 4]);
        ctx.lineWidth = 1.5;
        this.drawEquatorialRing(ctx, isco.prograde);
        ctx.setLineDash([]);

        ctx.strokeStyle = 'rgba(0, 240, 255, 0.35)';
        ctx.lineWidth = 1.2;
        this.drawErgosphereWireframe(ctx, a, M);

        const center = this.project(0, 0, 0);
        const radiusPix = rPlus * this.camera.scale;

        const grad = ctx.createRadialGradient(center.x, center.y, radiusPix * 0.2, center.x, center.y, radiusPix);
        grad.addColorStop(0, '#000000');
        grad.addColorStop(0.85, '#020408');
        grad.addColorStop(1.0, 'rgba(255, 42, 95, 0.6)');

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(center.x, center.y, radiusPix, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = '#ff2a5f';
        ctx.lineWidth = 2.0;
        ctx.stroke();
    }

    drawEquatorialRing(ctx, r) {
        ctx.beginPath();
        const segments = 64;
        for (let i = 0; i <= segments; i++) {
            const angle = (i / segments) * Math.PI * 2;
            const x = r * Math.cos(angle);
            const y = r * Math.sin(angle);
            const pt = this.project(x, y, 0);
            if (i === 0) ctx.moveTo(pt.x, pt.y);
            else ctx.lineTo(pt.x, pt.y);
        }
        ctx.stroke();
    }

    drawErgosphereWireframe(ctx, a, M) {
        this.drawEquatorialRing(ctx, 2.0 * M);

        const meridians = 4;
        for (let m = 0; m < meridians; m++) {
            const phi = (m / meridians) * Math.PI;
            ctx.beginPath();
            const segs = 48;
            for (let s = 0; s <= segs; s++) {
                const theta = (s / segs) * Math.PI;
                const r = KerrPhysics.computeErgosphere(a, theta, M);
                const x = r * Math.sin(theta) * Math.cos(phi);
                const y = r * Math.sin(theta) * Math.sin(phi);
                const z = r * Math.cos(theta);
                const pt = this.project(x, y, z);
                if (s === 0) ctx.moveTo(pt.x, pt.y);
                else ctx.lineTo(pt.x, pt.y);
            }
            ctx.stroke();
        }
    }

    drawPenroseOverlay(ctx) {
        const boxX = 20;
        const boxY = 20;
        const boxW = 320;
        const boxH = 130;

        ctx.fillStyle = 'rgba(7, 12, 22, 0.85)';
        ctx.strokeStyle = '#00f0ff';
        ctx.lineWidth = 1.0;
        ctx.fillRect(boxX, boxY, boxW, boxH);
        ctx.strokeRect(boxX, boxY, boxW, boxH);

        ctx.fillStyle = '#00f0ff';
        ctx.font = 'bold 12px monospace';
        ctx.fillText('PENROSE PROCESS TELEMETRY', boxX + 12, boxY + 22);

        ctx.fillStyle = '#8899aa';
        ctx.font = '11px monospace';
        ctx.fillText(`Initial Energy E_0:    ${this.penroseStats.initialEnergy.toFixed(2)} M`, boxX + 12, boxY + 44);
        ctx.fillText(`Extracted Energy E_2:  ${this.penroseStats.extractedEnergy.toFixed(2)} M`, boxX + 12, boxY + 62);
        
        ctx.fillStyle = this.penroseStats.efficiency > 0 ? '#39ff14' : '#f5a623';
        ctx.fillText(`Net Efficiency:        +${this.penroseStats.efficiency.toFixed(1)}%`, boxX + 12, boxY + 80);

        ctx.fillStyle = '#ffffff';
        ctx.font = '10px monospace';
        const lastMsg = this.penroseStats.eventLog[this.penroseStats.eventLog.length - 1] || 'Running...';
        ctx.fillText(`Status: ${lastMsg}`, boxX + 12, boxY + 104);
    }
}
