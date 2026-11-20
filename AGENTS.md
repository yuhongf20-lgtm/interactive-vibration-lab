# AGENTS.md — Interactive Vibration Lab

## Mission

Build and maintain **Interactive Vibration Lab（互動式振動與旋轉機械模擬實驗室）**, a browser-based, educational vibration simulator for undergraduate students. Users should understand equations by **changing physical parameters, seeing the mechanical animation, comparing output plots, and reading step-by-step calculations in Traditional Chinese**.

This file is the standing project instruction set for Codex. Work on the actual codebase; do not respond with design proposals alone when asked to implement a feature.

## Working agreement

1. **Inspect before editing:** read the existing README, `package.json`, relevant code/tests and inspect the workspace. Do not run Git commands. Preserve existing features and user changes. Never overwrite unrelated or uncommitted work.
2. Prefer small, testable changes. Implement a working minimum version first, then refine visuals, documentation and advanced features.
3. **Do not push commits, create public repositories, enable Pages, deploy, delete files or make remote changes without the user's explicit approval.** The owner uploads through the GitHub web interface.
4. Explain the work, assumptions, test evidence and blockers in Traditional Chinese. Keep engineering terms (e.g., SDOF, natural frequency, resonance, RK4, FRF) where useful.
5. Write meaningful **Traditional Chinese comments** near non-obvious physics, numerical calculations, units, and algorithm branches. Avoid filler comments.
6. When changing calculations, add or update unit tests. Do not claim success for checks not actually run.
7. Never invent experimental measurements or present simulated outputs as measured data. Distinguish time response, steady-state response, numerical calculation, and theoretical result.

## Tech stack and architecture

- **TypeScript + Vite**, static client-side site; no server or database required for GitHub Pages.
- Use lightweight UI libraries as needed; use **Chart.js** or a similarly reliable chart library for responsive, inspectable plots.
- Use **SVG** for original mass-spring-damper, rotor, shaft, bearing and motor drawings and their animations. **Do not copy, screenshot or reuse copyrighted lecture figures.**
- Use a clear separation of concerns, for example:
  - `src/physics/`: equations, analytical solutions, RK4 numerical integration, FRF, units and parameter validation.
  - `src/components/`: controls, charts, animated diagrams, display cards, math renderers.
  - `src/experiments/`: educational experiments and their state.
  - `src/content/`: Traditional Chinese explanations and formula walkthroughs.
  - `src/utils/`: exports, formatting and accessibility helpers.
  - `tests/`: numerical correctness, regressions and edge cases.
- Use **Vitest** for unit tests. Maintain working `npm run dev`, `npm run build`, and `npm test` scripts.
- Render mathematical **superscripts and subscripts correctly** (HTML `sup`/`sub` or KaTeX/MathJax); avoid literal `_` and `^` notation in the displayed user interface unless plain text is intentionally requested.
- Units must accompany displayed quantities; do not silently mix mm/m, Hz/rad/s, and rpm/rad/s.

## Global UX requirements

Create a clean, approachable, responsive educational dashboard for university students:

- Top-level experiment navigation (see modules below).
- On desktop: parameter sliders/numeric inputs on the left, SVG mechanical animation and charts on the right; stack vertically on mobile.
- Two friendly teaching sections for every experiment:
  1. **「先來看看它為什麼會這樣」** — intuitive concept, what causes the observed behavior, why the parameters matter, and explanations of formulas and symbols.
  2. **「實際調整參數算給你看」** — current inputs → selected equations → substitutions with units → intermediate steps → numerical answer → physical interpretation.
- **Never hard-code demonstration answers as the live result:** regenerate calculations and explanatory numbers from the user's current parameters.
- Update plotted series, readouts and animations together when any control changes.
- Provide reset, play, pause, replay, speed controls, curve overlay, legends, axes with units, tooltips, CSV export and PNG chart export.
- Use keyboard-accessible controls, descriptive labels, sane color contrast, and meaningful error/empty-state messages.
- Display initial conditions, model assumptions and differences between transient and steady-state results.
- All animations **must share the same simulation time/state** as the plotted waveform, rather than being merely decorative.

## Physics core: SDOF translational vibration

Use the governing equation:

`m*x''(t) + c*x'(t) + k*x(t) = F(t)`

where:
- `m` [kg]: effective mass; `c` [N·s/m]: viscous damping coefficient; `k` [N/m]: stiffness.
- `x` [m]: displacement about equilibrium; `F` [N]: excitation force; `t` [s].
- `x0` [m], `v0` [m/s]: user-specified initial displacement and velocity.

Derived quantities:

- Natural angular frequency: `omega_n = sqrt(k/m)` [rad/s].
- Natural frequency: `f_n = omega_n/(2*pi)` [Hz].
- Natural period: `T_n = 1/f_n` [s].
- Critical damping: `c_critical = 2*sqrt(k*m)` [N·s/m].
- Damping ratio: `zeta = c/c_critical` [dimensionless].
- Damped angular frequency (only if `0 <= zeta < 1`): `omega_d = omega_n*sqrt(1-zeta^2)`.

Use correct free-response solutions for all damping regimes (`zeta = 0`, `0 < zeta < 1`, `zeta = 1`, `zeta > 1`), satisfying both `x(0)=x0` and `x'(0)=v0`. **Do not apply the underdamped sine formula to critical or overdamped cases.** Validate physical parameter ranges; require strictly positive mass and stiffness, nonnegative damping.

### Experiment 1: Natural frequency and free vibration

- Controls: `m` 1–20 kg (default 2), `k` 10–2000 N/m (default 200), `c` 0–200 N·s/m (default 2), `x0` -0.2–0.2 m (default 0.1), `v0` -2–2 m/s (default 0), simulation duration 1–30 s (default 10).
- Show mass-spring-damper animation, displacement versus time, `omega_n`, `f_n`, `T_n`, `zeta`, `omega_d` when defined.
- Overlay two cases to show why increasing `m` lowers frequency and increasing `k` raises frequency.
- Explain **undamped natural frequency** versus damped oscillation frequency accurately.

### Experiment 2: Damping comparison

- Compare `zeta` = 0, 0.1, 0.3, 0.7, 1.0 and 1.5 under the same mass, stiffness and initial conditions.
- Calculate each corresponding `c = 2*zeta*sqrt(k*m)` and plot labeled curves together; allow visibility toggles.
- Explain zero damping, underdamping, critical damping and overdamping and why overdamping can return to equilibrium more slowly.

### Experiment 3: Forced vibration and resonance

For sinusoidal input `F(t)=F0*sin(omega*t)` with `omega=2*pi*f`:

`m*x'' + c*x' + k*x = F0*sin(omega*t)`

- Controls: `m`, `k`, `c`, `F0` 0–100 N (default 10), `f` 0.1–10 Hz (default 1), `x0`, `v0`, and time span.
- Calculate the **full transient + steady-state** response using RK4 or a comparably validated numerical method.
- Where finite, theoretical steady-state displacement amplitude:
  `X = F0/sqrt((k-m*omega^2)^2+(c*omega)^2)`.
- Use `atan2(c*omega, k-m*omega^2)` for phase quadrant handling and label the phase convention.
- Display input force and output displacement on **separate graphs or axes with clearly different units** (N versus m).
- Provide low-frequency / near-resonance / high-frequency presets, a current-frequency marker, and a steady-state-only view that clarifies whether initial transients have decayed.
- **Do not claim resonance always occurs exactly at `omega_n` in damped displacement FRFs.** For the force-to-displacement FRF, an interior peak exists only if `zeta < 1/sqrt(2)` and occurs at `r_peak = sqrt(1-2*zeta^2)`.
- For the undamped, exact-resonance case, do **not** chart infinite theoretical amplitude: show the finite-time growing dynamic solution and a helpful explanation.

### Experiment 4: Frequency response function (FRF)

- Compute complex displacement/force FRF:
  `H(omega) = 1/(k-m*omega^2+i*c*omega)` [m/N].
- Magnitude: `|H| = 1/sqrt((k-m*omega^2)^2+(c*omega)^2)` [m/N].
- Plot against `r=omega/omega_n`, typically 0–3; offer overlays across damping ratios.
- Mark `r=1` as the undamped natural-frequency ratio, distinguish it from any damped FRF peak.
- For divisions by zero, display a meaningful singularity/unbounded ideal-model notice instead of `NaN` or `Infinity` plot points.

## Physics extension: rotating unbalance and eccentricity

### Experiment 5: Rotating shaft with nonuniform mass distribution

Use one rigid, horizontal cylindrical shaft on two symmetric supports. Its cross-section has circumferential density variation, repeated along the length. Divide it into equal-area mass elements and normalize the weights to the same total mass M when the distribution changes. Determine the actual center of mass from the first moments of these elements. In the section plane, O is the geometric axis and G is the computed center of mass. Use e = hypot(xG, yG), U = Me, ω = 2π rpm/60, and F₀ = Uω².

Model two uncoupled transverse translations with identical k and c. Use M as the effective moving mass because the rigid shaft alone translates and support inertia is neglected. Drive x and y with cosine and sine forces using the calculated center-of-mass phase. Retain free transients from initial offsets. Use the same physical samples for SVG translation, x/y time histories, orbit and CSV. Display the visual displacement scale. Render sector density, O, G, eccentricity, and left/right bearings.

Provide controls for uniformity, concentration direction, total mass, length, radius, speed, stiffness and damping. Compare uniform, slight, moderate and severe density variation at fixed speed, mass and support conditions. Report e (mm), U (kg·mm), F₀ (N), per-axis steady-state amplitude, peak-to-peak and RMS (mm). Plot amplitude against eccentricity at fixed speed and against speed at fixed mass distribution. Explain why squared growth of the unbalance force can coexist with a displacement peak followed by a decline. At undamped exact resonance leave the steady-state value blank and show finite-time motion. At zero speed or centered mass preserve initial-condition response.

### Experiment 6: Guided scenario comparison

Provide an optional guided comparison screen combining:
- Natural frequency variation (`m`, `k`),
- damping effects (`c` and `zeta`),
- forcing frequency and resonance,
- rotor eccentricity and rpm.

Each guided scenario should have a short prediction question and a reveal/explanation after running it. This can be shipped after Experiments 1–5 are stable.

## Interactive vibration handout

Use the seven-page Traditional Chinese Word handout as the primary source for units 01–14. Check the docs directory and project root before editing. Preserve original topic order, core explanations, and example inputs. Render material as semantic HTML with original SVG diagrams and editable examples. Preserve the last unit and reading position when returning from a hash-routed experiment.
Unit 15 is an extension for static unbalance from the whole shaft center of mass. Reuse the existing rotor simulation, label eccentricity separately from displacement amplitude, and explain the limitation for couple unbalance. Keep curriculum data, example calculations, and page rendering separately maintainable. Validate the example outputs and links.

## Numerical accuracy and performance

- Use validated closed forms for free vibration where appropriate and RK4 for the full forced response.
- Numerical time step must resolve the **highest relevant excitation / natural frequency** sufficiently. Adapt/refine it as needed and decimate only for chart rendering, not for physics. Warn about impractical settings rather than silently returning nonsense.
- At `omega=0`, `e=0` or `F0=0`, respect force and initial-condition behavior.
- Never pass `NaN`, `Infinity` or undefined arrays into charts.
- Make distinctions between phase, displacement, velocity, acceleration, amplitude and instantaneous values.
- Keep all imported/exported data units explicit.

## Mandatory tests

Add numerical tests for at least:

1. `omega_n`, `f_n`, `T_n`, `c_critical`, `zeta`, `omega_d` at known inputs.
2. Free-response initial displacement/velocity satisfied for zero, under-, critical and overdamping.
3. `F=0`, `c=0` has approximately conserved mechanical energy within numerical tolerance; with damping, energy is non-increasing within tolerance.
4. `m` increase lowers natural frequency; `k` increase raises it.
5. Forced-response numerics match theoretical steady-state amplitude after transients have decayed (for positive damping and sufficient run time).
6. Undamped exact resonance produces valid finite-time data rather than `NaN`/`Infinity`.
7. Correct damped FRF peak condition and frequency; no false claim that its peak always equals `omega_n`.
8. Mass elements preserve total mass and yield the correct first moments, centered uniform distribution and center-of-mass direction.
9. U = Me, rpm conversion and square-law force are correct; the speed sweep follows the analytical response, including non-monotonic behavior.
10. Centered mass or zero rpm cancels unbalance excitation while preserving initial-condition response.
11. At fixed speed and support settings, changes in density distribution affect e, F₀ and finite steady-state amplitude proportionally.
12. Exports, plot data, and animations remain in sync when parameters change.
13. No invalid chart values at singular limits or boundary inputs.
14. `npm run build` succeeds; GitHub Pages asset base path works for a repository project site.

## GitHub Pages delivery

- Produce `.github/workflows/deploy.yml` for static Pages deployment, using current documented GitHub Pages actions and suitable permissions. Repository name should be configurable; do not silently assume the site lives at the domain root.
- Ensure Vite `base` works for `https://<username>.github.io/<repo>/`; document adjustments for custom domains or user/organization root sites.
- Provide `README.md` in Traditional Chinese covering setup, run/build/test, model assumptions, equations, controls, worked examples, limitations and deployment.
- Avoid secrets and hardcoded credentials. No backend required.

## How to process development requests

When asked to implement or modify this project:

1. Inspect code, working tree and available project commands.
2. Identify the smallest working change that satisfies the request.
3. Implement calculation logic first, then connect synchronized plots/animations, followed by teaching copy and controls.
4. Add tests and execute available validation (`npm test`, `npm run build`, or the project's equivalent).
5. Confirm no obvious page overflow, clipping, missing labels or mobile breakage.
6. Report in Traditional Chinese: files changed, functionality delivered, test results, limitations and exact run instructions.
7. Never claim a remote GitHub deployment succeeded unless it actually occurred and was confirmed.

## Initial implementation request if this repository is empty

Bootstrap the complete Vite/TypeScript app and a functional first release with:

1. **Natural frequency/free vibration**, including working m/k/c controls, wave plot and animated SDOF schematic.
2. **Damping comparison** including all damping regimes.
3. **Forced vibration/resonance** with reliable time-domain RK4 and FRF view.
4. **Rotor eccentricity experiment** with synchronized rotating unbalance visualization, rpm sweep and fixed-mass distribution comparison.
5. Tests, README, CSV/PNG export, and Pages workflow.

Complete and validate each module in order. If unable to finish all modules in one run, leave a functioning app with truthful status and next steps rather than scaffolding nonfunctional buttons.

