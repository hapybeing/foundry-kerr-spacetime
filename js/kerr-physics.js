export class KerrPhysics {
    static computeHorizons(a, M = 1.0) {
        const disc = Math.max(0.0, M * M - a * a);
        const sqrtDisc = Math.sqrt(disc);
        return {
            rPlus: M + sqrtDisc,
            rMinus: M - sqrtDisc,
            isExtremal: Math.abs(a) >= M * 0.999
        };
    }

    static computeErgosphere(a, theta, M = 1.0) {
        const cosTh = Math.cos(theta);
        const disc = Math.max(0.0, M * M - a * a * cosTh * cosTh);
        return M + Math.sqrt(disc);
    }

    static computeISCO(a, M = 1.0) {
        const aNorm = Math.min(0.99999, Math.max(-0.99999, a / M));
        const oneMinusA2 = 1.0 - aNorm * aNorm;
        const cbrt1mA2 = Math.cbrt(oneMinusA2);
        const cbrt1pA = Math.cbrt(1.0 + aNorm);
        const cbrt1mA = Math.cbrt(1.0 - aNorm);

        const Z1 = 1.0 + cbrt1mA2 * (cbrt1pA + cbrt1mA);
        const Z2 = Math.sqrt(Math.max(0.0, 3.0 * aNorm * aNorm + Z1 * Z1));

        const term = Math.sqrt(Math.max(0.0, (3.0 - Z1) * (3.0 + Z1 + 2.0 * Z2)));
        const rPrograde = M * (3.0 + Z2 - term);
        const rRetrograde = M * (3.0 + Z2 + term);

        return {
            prograde: rPrograde,
            retrograde: rRetrograde
        };
    }

    static computePhotonOrbits(a, M = 1.0) {
        const aNorm = Math.min(0.99999, Math.max(-0.99999, a / M));
        const rPrograde = 2.0 * M * (1.0 + Math.cos((2.0 / 3.0) * Math.acos(-aNorm)));
        const rRetrograde = 2.0 * M * (1.0 + Math.cos((2.0 / 3.0) * Math.acos(aNorm)));
        return {
            prograde: rPrograde,
            retrograde: rRetrograde
        };
    }

    static computeEnergetics(a, M = 1.0) {
        const { rPlus } = this.computeHorizons(a, M);
        const rPlus2 = rPlus * rPlus;
        const a2 = a * a;
        const mIrr = Math.sqrt(0.5 * (rPlus2 + a2));
        const extractableFraction = (M - mIrr) / M;
        const horizonArea = 4.0 * Math.PI * (rPlus2 + a2);
        const omegaH = a / (rPlus2 + a2);

        return {
            irreducibleMass: mIrr,
            extractableFraction: extractableFraction,
            extractablePercentage: extractableFraction * 100.0,
            horizonArea: horizonArea,
            omegaH: omegaH
        };
    }

    static computeFrameDragging(r, theta, a, M = 1.0) {
        const r2 = r * r;
        const a2 = a * a;
        const sinTh = Math.sin(theta);
        const sin2 = sinTh * sinTh;
        const delta = r2 - 2.0 * M * r + a2;
        const denom = (r2 + a2) * (r2 + a2) - delta * a2 * sin2;
        if (Math.abs(denom) < 1e-9) return a / (2.0 * M * r);
        return (2.0 * M * a * r) / denom;
    }

    static computeKeplerianOmega(r, a, M = 1.0) {
        return Math.sqrt(M) / (Math.pow(r, 1.5) + a * Math.sqrt(M));
    }

    static computeDopplerFactor(r, a, Lz, M = 1.0) {
        const Omega = this.computeKeplerianOmega(r, a, M);
        const f = (2.0 * M) / r;
        const kx = 1.0;
        const ky = -a / r;
        const g00 = -1.0 + f;
        const g0y = f * ky;
        const gyy = 1.0 + f * ky * ky;
        const vy = Omega * r;
        const denom = - (g00 + 2.0 * g0y * vy + gyy * vy * vy);
        if (denom <= 0.0) return 1.0;
        const ut = 1.0 / Math.sqrt(denom);
        const g = 1.0 / (ut * Math.max(0.01, 1.0 - Omega * Lz));
        return Math.min(10.0, Math.max(0.05, g));
    }

    static blackbodyToRGB(T_kelvin) {
        const t = Math.max(800.0, Math.min(30000.0, T_kelvin)) / 100.0;
        let r, g, b;

        if (t <= 66.0) {
            r = 255.0;
        } else {
            r = t - 60.0;
            r = 329.698727446 * Math.pow(r, -0.1332047592);
            r = Math.max(0.0, Math.min(255.0, r));
        }

        if (t <= 66.0) {
            g = t;
            g = 99.4708025861 * Math.log(g) - 161.1195681661;
        } else {
            g = t - 60.0;
            g = 288.1221695283 * Math.pow(g, -0.0755148492);
        }
        g = Math.max(0.0, Math.min(255.0, g));

        if (t >= 66.0) {
            b = 255.0;
        } else if (t <= 19.0) {
            b = 0.0;
        } else {
            b = t - 10.0;
            b = 138.5177312231 * Math.log(b) - 305.0447927307;
            b = Math.max(0.0, Math.min(255.0, b));
        }

        return [r / 255.0, g / 255.0, b / 255.0];
    }
}
