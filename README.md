# KERR: Relativistic Curved Spacetime Geodesic Engine & Lensing Observatory

> **Live Interactive Application:** [https://hapybeing.github.io/foundry-kerr-spacetime/](https://hapybeing.github.io/foundry-kerr-spacetime/)

---

## 1. Abstract & Overview

**KERR** is an academic-grade, real-time interactive relativistic astrophysics and differential geometry laboratory. Engineered using hardware-accelerated **WebGL 2.0 (GLSL ES 3.00)** and a symplectic numerical dynamics engine, the platform simulates the strong gravitational field and optical phenomena surrounding a rotating (Kerr) black hole.

The system provides dual interactive operational modes:
1. **The Relativistic Observatory (Null Geodesic Raytracer):** An ultra-optimized backwards raymarching shader that computes photon trajectories through curved spacetime in Cartesian Kerr-Schild coordinates, rendering the black hole shadow, photon rings, relativistic Doppler beaming ($g^4$ radiance amplification), gravitational redshift, turbulent Shakura-Sunyaev accretion disks, ergosphere boundaries, and Einsteinian gravitational deflection of the background celestial sphere.
2. **The Orbital Sandbox (Timelike Geodesic Simulator):** A 4th-order Runge-Kutta (RK4) integrator tracking massive test particles in bound rosette orbits, Lense-Thirring orbital plane precessions, zoom-whirl trajectories, and the **Penrose Process** of rotational energy extraction from the ergosphere.

---

## 2. Mathematical & Algorithmic Foundations

### 2.1 The Kerr Metric in Boyer-Lindquist Coordinates

The geometry of an uncharged, stationary, axisymmetric rotating black hole of mass $M$ and angular momentum $J = aM$ is governed by the Kerr solution to Einstein's vacuum field equations $R_{\mu\nu} = 0$. In natural units where $G = c = M = 1$, the line element $ds^2 = g_{\mu\nu} dx^\mu dx^\nu$ in Boyer-Lindquist coordinates $(t, r, \theta, \phi)$ is:

$$ds^2 = -\left(1 - \frac{2r}{\rho^2}\right) dt^2 - \frac{4ar\sin^2\theta}{\rho^2} dt\,d\phi + \frac{\rho^2}{\Delta} dr^2 + \rho^2 d\theta^2 + \Sigma \sin^2\theta d\phi^2$$

where the geometric auxiliary functions are defined by:

$$\rho^2 = r^2 + a^2 \cos^2\theta$$

$$\Delta = r^2 - 2r + a^2$$

$$\Sigma = \left(r^2 + a^2 + \frac{2a^2 r\sin^2\theta}{\rho^2}\right)$$

### 2.2 Event Horizons and the Ergosphere Boundary

The coordinate singularities of the metric determine the causal structure of spacetime:
* **Event Horizons:** The outer event horizon $r_+$ and the inner (Cauchy) horizon $r_-$ correspond to the real roots of the horizon equation $\Delta = 0$:
  $$r_\pm = 1 \pm \sqrt{1 - a^2}$$
  For extremal spin $a \to 1$, the horizons coalesce at $r_+ = r_- = 1$.
* **Static Limit Surface (Ergosphere Boundary):** The hypersurface where the asymptotic timelike Killing vector field $\xi^\mu = (\partial_t)^\mu$ becomes null, $g_{tt} = 0$:
  $$r_E(\theta) = 1 + \sqrt{1 - a^2 \cos^2\theta}$$
  At the poles ($\theta = 0, \pi$), the ergosphere coincides with the outer event horizon: $r_E(0) = r_+$. At the equator ($\theta = \pi/2$), the ergosphere extends to $r_E(\pi/2) = 2M$ regardless of spin.
* **The Ergoregion:** The spatial slice $r_+ < r < r_E(\theta)$ wherein no static physical observer can exist; all particles and light rays are inevitably dragged along with the rotation of spacetime (**frame-dragging** / the Lense-Thirring effect).

### 2.3 Characteristic Orbital Radii (ISCO and Photon Sphere)

Following Bardeen, Press, and Teukolsky (1972), the equatorial circular orbits and light rings are algebraically given by:

$$Z_1 = 1 + (1 - a^2)^{1/3} \left[(1 + a)^{1/3} + (1 - a)^{1/3}\right]$$

$$Z_2 = \sqrt{3a^2 + Z_1^2}$$

* **Innermost Stable Circular Orbit (ISCO):**
  $$r_{\text{ISCO}}^\pm = 3 + Z_2 \mp \sqrt{(3 - Z_1)(3 + Z_1 + 2Z_2)}$$
  *(upper sign for prograde orbits, lower sign for retrograde)*. As $a \to 1$, $r_{\text{ISCO}}^{\text{pro}} \to 1 M$, while $r_{\text{ISCO}}^{\text{retro}} \to 9 M$.
* **Photon Orbit Radii:**
  $$r_{\text{ph}}^\pm = 2 \left(1 + \cos\left(\frac{2}{3} \arccos(\mp a)\right)\right)$$

### 2.4 Kerr-Schild Cartesian Formulation & Exact Inverse

Direct integration in Boyer-Lindquist coordinates suffers from coordinate blowups at the horizon $r = r_+$ and coordinate singularities along the rotation axis $\theta \in \{0, \pi\}$. To achieve numerical stability and 60 FPS GPU execution, **KERR** implements the **Kerr-Schild coordinate system** $x^\mu = (t, x, y, z)$.

In Kerr-Schild coordinates, the metric is decomposed into flat Minkowski space plus a rank-1 perturbation:

$$g_{\mu\nu} = \eta_{\mu\nu} + f(x, y, z) k_\mu k_\nu$$

$$\eta_{\mu\nu} = \text{diag}(-1, 1, 1, 1)$$

where the coordinate radius $r$ is the positive root of the confocal ellipsoid:

$$\frac{x^2 + y^2}{r^2 + a^2} + \frac{z^2}{r^2} = 1 \implies r^2 = \frac{1}{2}\left((x^2 + y^2 + z^2 - a^2) + \sqrt{(x^2 + y^2 + z^2 - a^2)^2 + 4a^2 z^2}\right)$$

The scalar factor $f$ and null vector $k_\mu$ are:

$$f = \frac{2 M r^3}{r^4 + a^2 z^2}$$

$$k_\mu = \left(1, \frac{r x + a y}{r^2 + a^2}, \frac{r y - a x}{r^2 + a^2}, \frac{z}{r}\right)$$

Because $k_\mu$ is null with respect to the flat Minkowski metric ($\eta^{\mu\nu} k_\mu k_\nu = 0$), the inverse metric tensor $g^{\mu\nu}$ is given **algebraically and exactly** by the Sherman-Morrison theorem:

$$g^{\mu\nu} = \eta^{\mu\nu} - f(x, y, z) k^\mu k^\nu, \quad k^\mu = \eta^{\mu\alpha} k_\alpha = (-1, k_x, k_y, k_z)$$

**Crucial Computational Advantage:** This eliminates all $4 \times 4$ matrix inversions from the GPU fragment shader.

### 2.5 Symplectic Hamiltonian Geodesic Integration

The motion of a particle or photon is governed by the super-Hamiltonian:

$$H(x^\mu, p_\mu) = \frac{1}{2} g^{\mu\nu}(x) p_\mu p_\nu = \frac{1}{2} \left[ -p_0^2 + \vec{p}^2 - f(x) (-p_0 + \vec{k}\cdot\vec{p})^2 \right]$$

where $H = 0$ for null geodesics (photons) and $H = -\frac{1}{2}\mu^2$ for timelike geodesics. Hamilton's canonical equations of motion are:

$$\frac{dx^\mu}{d\lambda} = \frac{\partial H}{\partial p_\mu} = g^{\mu\nu} p_\nu = \eta^{\mu\nu} p_\nu - f k^\mu (k^\alpha p_\alpha)$$

$$\frac{dp_\mu}{d\lambda} = -\frac{\partial H}{\partial x^\mu} = \frac{1}{2} (\nabla_{\vec{x}} f) (k^\alpha p_\alpha)^2 + f (k^\alpha p_\alpha) \nabla_{\vec{x}}(k^\beta p_\beta)$$

Because the metric is stationary ($\partial_t g_{\mu\nu} = 0$), the covariant energy $E \equiv -p_0$ is strictly conserved ($dp_0/d\lambda = 0$). The spatial momentum and position are stepped via a symplectic Verlet integrator with step size adaptively scaled by the local horizon proximity $\Delta r = r - r_+$:

$$\Delta \lambda \approx \min\left(0.40, \max\left(0.02, 0.12 \cdot (r - r_+)\right)\right) / \|\vec{v}\|$$

### 2.6 Relativistic Doppler Beaming and Radiative Transfer

The geometrically thin, optically thick accretion disk lies in the equatorial plane ($z = 0$). Gas elements orbit on circular Keplerian geodesics with angular velocity:

$$\Omega_K = \frac{1}{r^{3/2} + a}$$

The 4-velocity of emitting disk matter is $u^\mu_{\text{em}} = u^t (1, -\Omega_K y, \Omega_K x, 0)$, with normalization $g_{\mu\nu} u^\mu u^\nu = -1$:

$$u^t = \frac{1}{\sqrt{ - (g_{00} + 2 g_{0\phi} \Omega_K + g_{\phi\phi} \Omega_K^2) }}$$

For a photon with 4-momentum $p_\mu$, the ratio of detected frequency to emitted frequency defines the **relativistic redshift / Doppler factor** $g$:

$$g = \frac{\nu_{\text{obs}}}{\nu_{\text{em}}} = \frac{(u^\mu p_\mu)_{\text{obs}}}{(u^\mu p_\mu)_{\text{em}}} = \frac{1}{u^t_{\text{em}} (1 - \Omega_K L_z)}$$

where $L_z = x p_y - y p_x$ is the axial angular momentum of the photon.

#### Liouville Invariance & Beaming Exponent
According to Liouville's theorem in curved spacetime, the phase-space photon density $I_\nu / \nu^3$ is strictly invariant along any geodesic:

$$I_{\text{obs}}(\nu) = g^3 I_{\text{em}}(\nu / g)$$

Integrating over the bolometric emission spectrum yields the classical relativistic beaming law:

$$I_{\text{obs}} = g^4 I_{\text{em}}$$

This quartic exponent $g^4$ produces extreme brightness asymmetry: the side of the accretion disk orbiting toward the observer is blindingly amplified and Doppler blueshifted, while the receding side is dimmed and gravitationally redshifted.

### 2.7 The Penrose Process & Rotational Energy Extraction

Inside the ergosphere, $g_{00} > 0$, causing the asymptotic time-translation Killing vector $\xi^\mu = (\partial_t)^\mu$ to become spacelike. Consequently, the conserved energy of a particle relative to infinity:

$$E = - p_\mu \xi^\mu = - p_0$$

can become **negative** ($E < 0$) for retrograde orbits opposing the frame-dragging swirl.

Roger Penrose (1969) demonstrated that if an initial particle with energy $E_0 > 0$ enters the ergosphere and splits into two fragments:

$$E_0 = E_1 + E_2$$

If Fragment 1 is injected into a negative-energy state ($E_1 < 0$) and falls into the black hole horizon, Fragment 2 escapes to infinity carrying energy:

$$E_2 = E_0 - E_1 > E_0$$

The black hole absorbs negative energy and negative angular momentum, decreasing its total mass $M$ and spin $a$. According to the Christodoulou-Ruffini mass formula:

$$M^2 = M_{\text{irr}}^2 + \frac{a^2 M^2}{4 M_{\text{irr}}^2} \implies M_{\text{irr}} = \sqrt{\frac{r_+^2 + a^2}{2}}$$

The maximum reducible rotational energy extractable from a Kerr black hole reaches:

$$\eta_{\text{max}} = \frac{M - M_{\text{irr}}}{M} = 1 - \frac{1}{\sqrt{2}} \approx 29.289\%$$

---

## 3. Interactive Parameter Controls & Guide

| Parameter / Control | Mathematical Symbol | Permissible Range | Physical Description |
| :--- | :--- | :--- | :--- |
| **Dimensionless Spin** | $a_* = a/M$ | $[-0.998, +0.998]$ | Dimensionless Kerr spin parameter. Modulates frame-dragging, horizon compression, and ISCO migration. Negative values indicate retrograde rotation relative to disk. |
| **Lock $r_{\text{in}}$ to ISCO** | — | Boolean | Dynamically binds the inner accretion disk boundary to the prograde Innermost Stable Circular Orbit $r_{\text{ISCO}}(a)$. |
| **Inner Radius** | $r_{\text{in}}$ | $1.0 M - 8.0 M$ | Inner cutoff of radiating accretion plasma (active when ISCO auto-lock is disabled). |
| **Outer Radius** | $r_{\text{out}}$ | $6.0 M - 25.0 M$ | Outer hydrodynamic boundary of the Shakura-Sunyaev accretion disk. |
| **Relativistic Beaming** | $\alpha$ in $g^\alpha$ | $0.0 - 4.0$ | Adjusts Doppler amplification exponent. $\alpha = 0$ yields pure geometric optics; $\alpha = 4$ reproduces exact bolometric relativistic radiative transfer. |
| **Disk Opacity** | $\tau_0$ | $0.1 - 1.0$ | Optical depth of accretion plasma, controlling transparency and visibility of secondary photon rings. |
| **Temperature Scale** | $T_{\text{scale}}$ | $0.3 - 2.5$ | Thermal peak scaling for blackbody chromaticity mapping across Planckian locus. |
| **Keplerian Speed** | $\omega_{\text{disk}}$ | $0.0\times - 3.0\times$ | Differential shear velocity multiplier for disk plasma turbulence. |
| **Gravitational Redshift** | — | Boolean | Enables or disables combined Doppler and gravitational frequency shifts on blackbody colors. |
| **Celestial Sphere Lensing**| — | Boolean | Raytraces light escaping to infinity against a procedural cosmic starfield and galactic plane. |
| **Coordinate Grid** | — | Boolean | Overlays celestial equatorial coordinates (right ascension & declination) to visualize Einstein rings. |
| **Ergosphere Glow** | — | Boolean | Visualizes the static limit boundary $r_E(\theta)$ via cyan frame-dragging plasma glow. |
| **Ray Integration Quality**| $N_{\text{steps}}$ | $48, 80, 128$ | Integration step budget per pixel (Eco, Balanced, Ultra High-Fidelity). |
| **Resolution Scaling** | — | $0.5\times, 0.75\times, 1.0\times$ | Internal rendering buffer scale for high-DPI displays and low-power GPUs. |

---

## 4. Curated Scientific Presets

1. **M87* / Gargantua ($a = 0.94, \theta = 17^\circ$):** Supermassive black hole viewed nearly pole-on, exhibiting an intense asymmetric glowing crescent and prominent secondary photon ring.
2. **Sagittarius A* ($a = 0.52, \theta = 82^\circ$):** Edge-on perspective through the galactic plane showing extreme top and bottom gravitational lensing of the rear accretion disk.
3. **Extremal Kerr Limit ($a = 0.998, \theta = 60^\circ$):** Near-critical black hole displaying maximal frame-dragging, horizon contraction ($r_+ \to 1.063 M$), and an expanded ergosphere.
4. **Static Schwarzschild ($a = 0.0, \theta = 45^\circ$):** Non-spinning baseline with symmetric lensing, circular shadow of radius $r_{\text{shadow}} = \sqrt{27} M \approx 5.196 M$, and $r_{\text{ISCO}} = 6 M$.
5. **Penrose Energy Extraction:** Switches to the Orbital Sandbox to demonstrate ergosphere fission with live energy gain telemetry (+22% net extraction).
6. **Zoom-Whirl Resonator:** Injects a test particle onto a near-homoclinic orbit that executes multiple rapid whirls around the photon sphere before escaping.

---

## 5. Architectural & Software Design

```
foundry-kerr-spacetime/
├── index.html              # HTML5 viewport, responsive HUD, and KaTeX theory modal
├── css/
│   └── styles.css          # Glassmorphic dark theme, responsive grid, and custom sliders
├── js/
│   ├── main.js             # Application orchestrator, event hub, and 60 FPS RAF loop
│   ├── kerr-physics.js     # Exact analytic Kerr metric formulas, ISCO, horizons, and thermodynamics
│   ├── gl-renderer.js      # WebGL 2.0 Kerr-Schild GPU backwards raymarcher with analytic Hamiltonian gradient
│   ├── orbit-engine.js     # Timelike geodesic RK4 integrator, ribbon trails, and Penrose fission engine
│   ├── audio.js            # Web Audio API binaural sub-bass synthesizer driven by frame-dragging frequencies
│   └── ui.js               # Reactive DOM controller, preset manager, and real-time telemetry HUD
├── package.json            # Module configuration
└── README.md               # Exhaustive academic documentation with LaTeX derivations
```

### Numerical Integration Pipeline
1. **Camera Frame Setup:** Backwards ray vector $\vec{d}$ generated from camera coordinates $(\phi_{\text{cam}}, \theta_{\text{cam}}, r_{\text{cam}})$ with field of view $55^\circ$.
2. **Initial Momentum:** The covariant 4-momentum $p_\mu$ is initialized on the Kerr-Schild null surface such that $p_0 = -1$.
3. **Symplectic Step:**
   * Evaluate metric scalar $f(x)$ and null vector $\vec{k}(x)$.
   * Compute closed-form spatial gradient $\nabla_{\vec{x}} H$.
   * Update momentum: $\vec{p}_{n+1} = \vec{p}_n - \Delta \lambda \nabla_{\vec{x}} H$.
   * Update position: $\vec{x}_{n+1} = \vec{x}_n + \Delta \lambda \left(\vec{p}_{n+1} - f \vec{k} (\vec{k}\cdot\vec{p}_{n+1} - p_0)\right)$.
4. **Equatorial Crossing:** Detect when $z_n \cdot z_{n+1} \le 0$; perform linear root-finding for $r_{\text{cross}}$ and accumulate radiated blackbody intensity with $g^4$ beaming.
5. **Boundary Conditions:** Terminate on horizon capture ($r \le 1.015 r_+$) or asymptotic infinity escape ($r > 38 M$).

---

## 6. References & Literature

1. **Kerr, R. P. (1963).** Gravitational field of a spinning mass as an example of algebraically special metrics. *Physical Review Letters*, 11(5), 237.
2. **Bardeen, J. M., Press, W. H., & Teukolsky, S. A. (1972).** Rotating black holes: locally nonrotating frames, energy extraction, and scalar synchrotron radiation. *The Astrophysical Journal*, 178, 347-370.
3. **Penrose, R. (1969).** Gravitational collapse: The role of general relativity. *Nuovo Cimento Rivista*, 1, 252.
4. **Christodoulou, D. (1970).** Reversible and irreversible transformations in black-hole physics. *Physical Review Letters*, 25(21), 1596.
5. **Cunningham, C. T., & Bardeen, J. M. (1973).** The optical appearance of a star orbiting an extreme Kerr black hole. *The Astrophysical Journal*, 183, 237-264.
6. **Novikov, I. D., & Thorne, K. S. (1973).** Astrophysics of black holes. *Black Holes (Les Astres Occlus)*, 343-450.
7. **James, O., von Tunzelmann, E., Franklin, P., & Thorne, K. S. (2015).** Gravitational lensing by spinning black holes in astrophysics, and in the movie Interstellar. *Classical and Quantum Gravity*, 32(6), 065001.

---

## 7. License

MIT License. Designed, built, and shipped autonomously for computational physics research and exploratory visual mathematics.
