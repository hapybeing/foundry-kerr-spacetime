export class KerrRenderer {
    constructor(canvas, options = {}) {
        this.canvas = canvas;
        this.gl = canvas.getContext('webgl2', {
            alpha: false,
            depth: false,
            stencil: false,
            antialias: false,
            preserveDrawingBuffer: false,
            powerPreference: 'high-performance'
        });

        if (!this.gl) {
            throw new Error('WebGL 2.0 is not supported on this browser or hardware.');
        }

        this.resolutionScale = options.resolutionScale || 1.0;
        this.stepBudget = options.stepBudget || 80;
        this.program = null;
        this.uniformLocations = {};
        this.quadVao = null;

        this.camera = {
            distance: 22.0,
            azimuth: 0.85,
            inclination: 1.30,
            target: [0, 0, 0],
            fov: 55.0,
            targetDistance: 22.0,
            targetAzimuth: 0.85,
            targetInclination: 1.30
        };

        this.params = {
            spin: 0.94,
            rIn: 2.04,
            rOut: 14.0,
            autoLockISCO: true,
            diskOpacity: 0.95,
            diskTempScale: 1.2,
            beamingFactor: 3.8,
            enableRedshift: true,
            enableLensing: true,
            enableErgosphere: true,
            starGrid: true,
            rotationSpeed: 1.0,
            paused: false
        };

        this.time = 0.0;
        this.initShaders();
        this.initGeometry();
        this.setupEventListeners();
    }

    getVertexShaderSource() {
        return `#version 300 es
        precision highp float;
        in vec2 a_position;
        out vec2 v_uv;

        void main() {
            v_uv = a_position * 0.5 + 0.5;
            gl_Position = vec4(a_position, 0.0, 1.0);
        }`;
    }

    getFragmentShaderSource() {
        return `#version 300 es
        precision highp float;

        in vec2 v_uv;
        out vec4 fragColor;

        uniform vec2 u_resolution;
        uniform vec3 u_camPos;
        uniform vec3 u_camTarget;
        uniform vec3 u_camUp;
        uniform float u_fov;
        uniform float u_spin;
        uniform float u_rIn;
        uniform float u_rOut;
        uniform float u_diskOpacity;
        uniform float u_diskTempScale;
        uniform float u_beamingFactor;
        uniform int u_enableRedshift;
        uniform int u_enableLensing;
        uniform int u_enableErgosphere;
        uniform int u_starGrid;
        uniform int u_maxSteps;
        uniform float u_time;

        #define PI 3.14159265358979323846
        #define TWO_PI 6.28318530717958647692

        float hash31(vec3 p) {
            p = fract(p * vec3(443.897, 441.423, 437.195));
            p += dot(p, p.yzx + 19.19);
            return fract((p.x + p.y) * p.z);
        }

        vec3 hash33(vec3 p3) {
            p3 = fract(p3 * vec3(0.1031, 0.1030, 0.0973));
            p3 += dot(p3, p3.yxz + 33.33);
            return fract((p3.xxy + p3.yxx) * p3.zyx);
        }

        float noise2D(vec2 st) {
            vec2 i = floor(st);
            vec2 f = fract(st);
            float a = hash31(vec3(i, 0.0));
            float b = hash31(vec3(i + vec2(1.0, 0.0), 0.0));
            float c = hash31(vec3(i + vec2(0.0, 1.0), 0.0));
            float d = hash31(vec3(i + vec2(1.0, 1.0), 0.0));
            vec2 u = f * f * (3.0 - 2.0 * f);
            return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
        }

        float fbm(vec2 st) {
            float v = 0.0;
            float a = 0.5;
            for (int i = 0; i < 3; i++) {
                v += a * noise2D(st);
                st *= 2.1;
                a *= 0.5;
            }
            return v;
        }

        vec3 blackbodyColor(float T_norm) {
            float t = clamp(T_norm, 0.05, 5.0);
            vec3 col;
            if (t < 0.6) {
                float f = t / 0.6;
                col = mix(vec3(0.4, 0.02, 0.01), vec3(1.0, 0.35, 0.04), f);
            } else if (t < 1.3) {
                float f = (t - 0.6) / 0.7;
                col = mix(vec3(1.0, 0.35, 0.04), vec3(1.0, 0.92, 0.75), f);
            } else if (t < 2.5) {
                float f = (t - 1.3) / 1.2;
                col = mix(vec3(1.0, 0.92, 0.75), vec3(0.9, 0.95, 1.0), f);
            } else {
                float f = clamp((t - 2.5) / 2.5, 0.0, 1.0);
                col = mix(vec3(0.9, 0.95, 1.0), vec3(0.5, 0.8, 1.5), f);
            }
            return col;
        }

        void kerrSchildData(vec3 x, float a, out float r, out float f, out vec3 k_vec, out vec3 grad_r, out vec3 grad_f) {
            float p2 = dot(x, x);
            float a2 = a * a;
            float rho = p2 - a2;
            float disc = sqrt(max(1e-8, rho * rho + 4.0 * a2 * x.z * x.z));
            float r2 = 0.5 * (rho + disc);
            r = sqrt(max(1e-8, r2));

            float D_k = r2 + a2;
            k_vec = vec3((r * x.x + a * x.y) / D_k, (r * x.y - a * x.x) / D_k, x.z / r);

            float denom = r2 * r2 + a2 * x.z * x.z;
            f = (2.0 * r2 * r) / max(1e-8, denom);

            float rho_over_disc = rho / disc;
            vec3 grad_r2 = vec3(
                x.x * (1.0 + rho_over_disc),
                x.y * (1.0 + rho_over_disc),
                x.z * (1.0 + (rho + 2.0 * a2) / disc)
            );
            grad_r = grad_r2 / (2.0 * r);

            float df_dr = 2.0 * r2 * (3.0 * denom - 4.0 * r2 * r2) / max(1e-8, denom * denom);
            grad_f = df_dr * grad_r;
            grad_f.z += - 4.0 * r2 * r * a2 * x.z / max(1e-8, denom * denom);
        }

        vec3 analyticGradH(vec3 x, vec3 p, float p0, float a, float r, float f, vec3 k_vec, vec3 grad_r, vec3 grad_f) {
            float a2 = a * a;
            float r2 = r * r;
            float D_k = r2 + a2;
            vec3 grad_r2 = 2.0 * r * grad_r;

            float k_dot_p = -p0 + dot(k_vec, p);

            float P_dot_X = p.x * x.x + p.y * x.y;
            float P_cross_X = p.x * x.y - p.y * x.x;
            float S = r * P_dot_X + a * P_cross_X;

            vec3 grad_S = vec3(
                r * p.x + grad_r.x * P_dot_X - a * p.y,
                r * p.y + grad_r.y * P_dot_X + a * p.x,
                grad_r.z * P_dot_X
            );

            vec3 grad_term1 = (grad_S * D_k - S * grad_r2) / max(1e-8, D_k * D_k);
            vec3 grad_term2 = vec3(
                - p.z * x.z * grad_r.x / r2,
                - p.z * x.z * grad_r.y / r2,
                p.z * (r - x.z * grad_r.z) / r2
            );

            vec3 grad_k_dot_p = grad_term1 + grad_term2;
            return - 0.5 * grad_f * (k_dot_p * k_dot_p) - f * k_dot_p * grad_k_dot_p;
        }

        vec3 renderSky(vec3 dir) {
            vec3 col = vec3(0.005, 0.007, 0.012);

            float galacticPlane = abs(dir.z);
            float galaxyGlow = exp(- galacticPlane * 3.5) * 0.45;
            vec3 galaxyCol = mix(vec3(0.12, 0.15, 0.35), vec3(0.45, 0.32, 0.2), hash31(dir * 2.0));
            col += galaxyGlow * galaxyCol;

            if (u_starGrid == 1) {
                float lat = asin(clamp(dir.z, -1.0, 1.0));
                float lon = atan(dir.y, dir.x);
                float gridLat = abs(fract(lat * 6.0 / PI + 0.5) - 0.5);
                float gridLon = abs(fract(lon * 12.0 / TWO_PI + 0.5) - 0.5);
                float gridLine = smoothstep(0.04, 0.01, min(gridLat, gridLon));
                float equator = smoothstep(0.015, 0.002, abs(dir.z));
                col += vec3(0.04, 0.09, 0.18) * gridLine;
                col += vec3(0.1, 0.3, 0.5) * equator;
            }

            vec3 p = dir * 180.0;
            float h = hash31(floor(p));
            if (h > 0.965) {
                float brightness = pow((h - 0.965) / 0.035, 4.0);
                vec3 starCol = mix(vec3(0.6, 0.8, 1.0), vec3(1.0, 0.85, 0.6), hash31(floor(p) + 1.0));
                col += starCol * brightness * 1.5;
            }

            return col;
        }

        void main() {
            vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution) / min(u_resolution.x, u_resolution.y);

            vec3 w = normalize(u_camTarget - u_camPos);
            vec3 u = normalize(cross(w, u_camUp));
            vec3 v = cross(u, w);

            float tanFov = tan(radians(u_fov * 0.5));
            vec3 rayDir = normalize(w + (uv.x * tanFov) * u + (uv.y * tanFov) * v);

            float r_plus = 1.0 + sqrt(max(0.0, 1.0 - u_spin * u_spin));

            vec3 x = u_camPos;
            float r, f;
            vec3 k_vec, grad_r, grad_f;
            kerrSchildData(x, u_spin, r, f, k_vec, grad_r, grad_f);

            float p0 = -1.0;
            float k_dot_v = -1.0 + dot(k_vec, rayDir);
            vec3 p_spatial = rayDir + f * k_vec * k_dot_v;
            p_spatial /= abs(-1.0 + f * k_dot_v);
            vec3 p = p_spatial;

            vec3 accumulatedColor = vec3(0.0);
            float accumulatedAlpha = 0.0;
            float ergosphereGlow = 0.0;
            bool hitHorizon = false;

            for (int step = 0; step < u_maxSteps; step++) {
                kerrSchildData(x, u_spin, r, f, k_vec, grad_r, grad_f);

                if (r <= r_plus * 1.015) {
                    hitHorizon = true;
                    break;
                }

                if (r > 38.0 && step > 8) {
                    break;
                }

                float k_dot_p = -p0 + dot(k_vec, p);
                vec3 v_spatial = p - f * k_vec * k_dot_p;
                float v_mag = length(v_spatial) + 1e-6;

                float distToHorizon = r - r_plus;
                float dl = clamp(distToHorizon * 0.12, 0.02, 0.40) / v_mag;

                if (u_enableErgosphere == 1 && f > 1.0 && r > r_plus) {
                    float ergoIntensity = (f - 1.0) * exp(-distToHorizon * 2.0);
                    ergosphereGlow += ergoIntensity * dl * 0.4;
                }

                vec3 dH_dx = analyticGradH(x, p, p0, u_spin, r, f, k_vec, grad_r, grad_f);
                p -= dl * dH_dx;

                kerrSchildData(x, u_spin, r, f, k_vec, grad_r, grad_f);
                k_dot_p = -p0 + dot(k_vec, p);
                v_spatial = p - f * k_vec * k_dot_p;

                vec3 x_next = x + dl * v_spatial;

                if (x.z * x_next.z <= 0.0 && abs(x_next.z - x.z) > 1e-8) {
                    float frac = - x.z / (x_next.z - x.z);
                    vec3 x_cross = mix(x, x_next, frac);
                    float r_cross = length(x_cross.xy);

                    if (r_cross >= u_rIn && r_cross <= u_rOut) {
                        float Omega = 1.0 / (pow(r_cross, 1.5) + u_spin);

                        float f_cross = 2.0 / r_cross;
                        float g00 = -1.0 + f_cross;
                        float ky_cross = - u_spin / (r_cross * r_cross + u_spin * u_spin);
                        float g0y = f_cross * ky_cross;
                        float gyy = 1.0 + f_cross * ky_cross * ky_cross;
                        float v_rot = Omega * r_cross;
                        float denom = - (g00 + 2.0 * g0y * v_rot + gyy * v_rot * v_rot);
                        float ut = (denom > 0.0) ? 1.0 / sqrt(denom) : 1.0;

                        float Lz = x_cross.x * p.y - x_cross.y * p.x;
                        float g_factor = 1.0 / (ut * max(0.02, 1.0 - Omega * Lz));
                        g_factor = clamp(g_factor, 0.05, 5.0);

                        float r_norm = r_cross / u_rIn;
                        float T_base = pow(1.0 / r_norm, 0.75) * pow(max(0.0, 1.0 - sqrt(1.0 / r_norm)), 0.25);
                        float T_eff = T_base * u_diskTempScale * 3.5;

                        float T_observed = (u_enableRedshift == 1) ? (T_eff * g_factor) : T_eff;
                        vec3 baseColor = blackbodyColor(T_observed);

                        float beaming = (u_enableRedshift == 1) ? pow(g_factor, u_beamingFactor) : 1.0;
                        beaming = clamp(beaming, 0.01, 16.0);

                        float phi = atan(x_cross.y, x_cross.x);
                        float rotatingPhi = phi - Omega * u_time * 2.0;
                        vec2 texCoord = vec2(r_cross * 1.5, rotatingPhi * (1.5 / PI));
                        float turbulence = 0.6 + 0.5 * fbm(texCoord);

                        float innerFade = smoothstep(u_rIn, u_rIn * 1.08, r_cross);
                        float outerFade = smoothstep(u_rOut, u_rOut * 0.85, r_cross);
                        float density = innerFade * outerFade * turbulence * u_diskOpacity;

                        vec3 diskEmission = baseColor * beaming * density * 2.2;
                        float alpha = clamp(density * 0.85, 0.0, 0.98);

                        accumulatedColor += (1.0 - accumulatedAlpha) * diskEmission;
                        accumulatedAlpha += (1.0 - accumulatedAlpha) * alpha;

                        if (accumulatedAlpha > 0.98) {
                            break;
                        }
                    }
                }

                x = x_next;
            }

            vec3 finalColor = accumulatedColor;

            if (hitHorizon) {
                finalColor = mix(vec3(0.0), finalColor, accumulatedAlpha);
            } else {
                vec3 lensedDir = normalize(p);
                vec3 sky = (u_enableLensing == 1) ? renderSky(lensedDir) : renderSky(rayDir);
                finalColor += (1.0 - accumulatedAlpha) * sky;
            }

            if (u_enableErgosphere == 1 && ergosphereGlow > 0.001) {
                vec3 ergoColor = vec3(0.05, 0.75, 1.0);
                finalColor += ergoColor * clamp(ergosphereGlow * 0.15, 0.0, 0.4);
            }

            finalColor = max(vec3(0.0), finalColor);
            vec3 mapped = (finalColor * (2.51 * finalColor + 0.03)) / (finalColor * (2.43 * finalColor + 0.59) + 0.14);

            float vignette = 1.0 - dot(uv, uv) * 0.22;
            mapped *= clamp(vignette, 0.0, 1.0);

            fragColor = vec4(clamp(mapped, 0.0, 1.0), 1.0);
        }`;
    }

    initShaders() {
        const gl = this.gl;
        const vs = this.compileShader(gl.VERTEX_SHADER, this.getVertexShaderSource());
        const fs = this.compileShader(gl.FRAGMENT_SHADER, this.getFragmentShaderSource());

        const program = gl.createProgram();
        gl.attachShader(program, vs);
        gl.attachShader(program, fs);
        gl.linkProgram(program);

        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
            const err = gl.getProgramInfoLog(program);
            throw new Error(`Shader Program Link Error: ${err}`);
        }

        this.program = program;

        const uniforms = [
            'u_resolution', 'u_camPos', 'u_camTarget', 'u_camUp', 'u_fov',
            'u_spin', 'u_rIn', 'u_rOut', 'u_diskOpacity', 'u_diskTempScale',
            'u_beamingFactor', 'u_enableRedshift', 'u_enableLensing',
            'u_enableErgosphere', 'u_starGrid', 'u_maxSteps', 'u_time'
        ];

        for (const name of uniforms) {
            this.uniformLocations[name] = gl.getUniformLocation(program, name);
        }
    }

    compileShader(type, source) {
        const gl = this.gl;
        const shader = gl.createShader(type);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);

        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            const info = gl.getShaderInfoLog(shader);
            gl.deleteShader(shader);
            throw new Error(`Shader Compilation Failed (${type === gl.VERTEX_SHADER ? 'VS' : 'FS'}): ${info}`);
        }
        return shader;
    }

    initGeometry() {
        const gl = this.gl;
        this.quadVao = gl.createVertexArray();
        gl.bindVertexArray(this.quadVao);

        const positionBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
        const vertices = new Float32Array([
            -1.0, -1.0,
             1.0, -1.0,
            -1.0,  1.0,
            -1.0,  1.0,
             1.0, -1.0,
             1.0,  1.0
        ]);
        gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

        const posLoc = gl.getAttribLocation(this.program, 'a_position');
        gl.enableVertexAttribArray(posLoc);
        gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

        gl.bindVertexArray(null);
    }

    resize() {
        const displayWidth = Math.floor(this.canvas.clientWidth * window.devicePixelRatio * this.resolutionScale);
        const displayHeight = Math.floor(this.canvas.clientHeight * window.devicePixelRatio * this.resolutionScale);

        if (this.canvas.width !== displayWidth || this.canvas.height !== displayHeight) {
            this.canvas.width = Math.max(1, displayWidth);
            this.canvas.height = Math.max(1, displayHeight);
            this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
        }
    }

    setupEventListeners() {
        let isDragging = false;
        let lastX = 0;
        let lastY = 0;

        this.canvas.addEventListener('mousedown', (e) => {
            isDragging = true;
            lastX = e.clientX;
            lastY = e.clientY;
        });

        window.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            const dx = e.clientX - lastX;
            const dy = e.clientY - lastY;
            lastX = e.clientX;
            lastY = e.clientY;

            this.camera.targetAzimuth -= dx * 0.006;
            this.camera.targetInclination = Math.max(0.08, Math.min(Math.PI - 0.08, this.camera.targetInclination + dy * 0.006));
        });

        window.addEventListener('mouseup', () => {
            isDragging = false;
        });

        this.canvas.addEventListener('wheel', (e) => {
            e.preventDefault();
            const zoomDelta = e.deltaY * 0.015;
            this.camera.targetDistance = Math.max(5.5, Math.min(60.0, this.camera.targetDistance + zoomDelta));
        }, { passive: false });

        let initialDistance = 0;
        this.canvas.addEventListener('touchstart', (e) => {
            if (e.touches.length === 1) {
                isDragging = true;
                lastX = e.touches[0].clientX;
                lastY = e.touches[0].clientY;
            } else if (e.touches.length === 2) {
                isDragging = false;
                initialDistance = Math.hypot(
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

                this.camera.targetAzimuth -= dx * 0.008;
                this.camera.targetInclination = Math.max(0.08, Math.min(Math.PI - 0.08, this.camera.targetInclination + dy * 0.008));
            } else if (e.touches.length === 2) {
                const dist = Math.hypot(
                    e.touches[0].clientX - e.touches[1].clientX,
                    e.touches[0].clientY - e.touches[1].clientY
                );
                const delta = (initialDistance - dist) * 0.05;
                initialDistance = dist;
                this.camera.targetDistance = Math.max(5.5, Math.min(60.0, this.camera.targetDistance + delta));
            }
        }, { passive: true });

        this.canvas.addEventListener('touchend', () => {
            isDragging = false;
        });
    }

    updateCamera(dt) {
        const lerpFactor = Math.min(1.0, dt * 10.0);
        this.camera.azimuth += (this.camera.targetAzimuth - this.camera.azimuth) * lerpFactor;
        this.camera.inclination += (this.camera.targetInclination - this.camera.inclination) * lerpFactor;
        this.camera.distance += (this.camera.targetDistance - this.camera.distance) * lerpFactor;

        const sinInc = Math.sin(this.camera.inclination);
        const cosInc = Math.cos(this.camera.inclination);
        const sinAz = Math.sin(this.camera.azimuth);
        const cosAz = Math.cos(this.camera.azimuth);

        this.cameraPosition = [
            this.camera.distance * sinInc * cosAz,
            this.camera.distance * sinInc * sinAz,
            this.camera.distance * cosInc
        ];
    }

    render(deltaTime) {
        if (!this.params.paused) {
            this.time += deltaTime * this.params.rotationSpeed;
        }

        this.resize();
        this.updateCamera(deltaTime);

        const gl = this.gl;
        gl.useProgram(this.program);
        gl.bindVertexArray(this.quadVao);

        gl.uniform2f(this.uniformLocations.u_resolution, this.canvas.width, this.canvas.height);
        gl.uniform3fv(this.uniformLocations.u_camPos, this.cameraPosition);
        gl.uniform3fv(this.uniformLocations.u_camTarget, this.camera.target);
        gl.uniform3f(this.uniformLocations.u_camUp, 0.0, 0.0, 1.0);
        gl.uniform1f(this.uniformLocations.u_fov, this.camera.fov);

        gl.uniform1f(this.uniformLocations.u_spin, this.params.spin);
        gl.uniform1f(this.uniformLocations.u_rIn, this.params.rIn);
        gl.uniform1f(this.uniformLocations.u_rOut, this.params.rOut);
        gl.uniform1f(this.uniformLocations.u_diskOpacity, this.params.diskOpacity);
        gl.uniform1f(this.uniformLocations.u_diskTempScale, this.params.diskTempScale);
        gl.uniform1f(this.uniformLocations.u_beamingFactor, this.params.beamingFactor);
        gl.uniform1i(this.uniformLocations.u_enableRedshift, this.params.enableRedshift ? 1 : 0);
        gl.uniform1i(this.uniformLocations.u_enableLensing, this.params.enableLensing ? 1 : 0);
        gl.uniform1i(this.uniformLocations.u_enableErgosphere, this.params.enableErgosphere ? 1 : 0);
        gl.uniform1i(this.uniformLocations.u_starGrid, this.params.starGrid ? 1 : 0);
        gl.uniform1i(this.uniformLocations.u_maxSteps, this.stepBudget);
        gl.uniform1f(this.uniformLocations.u_time, this.time);

        gl.drawArrays(gl.TRIANGLES, 0, 6);
        gl.bindVertexArray(null);
    }
}
