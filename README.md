# EE Tool - Bootstrap Capacitor Calculator

A single-page React calculator for sizing bootstrap capacitors in high-side and
half-bridge gate-driver circuits.

## Methods

- **TI Integrated** combines TI SLUA887A with TI E2E practical guidance.
- **onsemi AN-6076** uses the onsemi charge-budget equation.
- **Infineon Network Analysis** separates Rboot drop from bootstrap capacitor
  ripple and duty-cycle limits.

## UI Features

- Traditional Chinese / English language switch.
- Engineering-unit selectors for voltage, charge, current, capacitance,
  frequency, time, duty cycle, and resistance.
- Input labels use the same engineering symbols shown in the formula trace.
- Analysis runs only after the user clicks the run button; editing parameters
  marks the previous result as stale.
- Recommended MLCC specification plus Digi-Key and Mouser search links.
- SIMetrix model sweep script generator for selected switching instances.
- Verilog-A model library with reusable `.va` source preview/download for a
  timer-based dead-time generator and an externally windowed MOSFET loss monitor
  that separates drain-path, gate-driver supply, conduction, turn-on, turn-off,
  dead-time, and body-diode power waveforms.

Live distributor stock and pricing require API keys, so this static frontend
generates distributor search links instead of calling Digi-Key or Mouser APIs
directly.

## Run Locally

```bash
npm install
npm run dev
```

## Validate

```bash
npm run test
npm run build
```

## Git And Render

This folder is a Git repository. Push the latest committed code to GitHub:

```bash
git status
git add .
git commit -m "feat: bootstrap capacitor calculator"
git branch -M main
git remote add origin <your-github-repo-url>
git push -u origin main
```

Create a Render Static Site from that GitHub repository:

- Render Dashboard: **New** -> **Static Site**
- Repository: `Githubfish66/EE-Tool`
- Branch: `main`
- Build command: `npm ci && npm run build`
- Publish directory: `dist`

This repository also includes `render.yaml`, so you can create the site as a
Render Blueprint instead. The Blueprint config deploys a static site named
`ee-tool` using `type: web` with `runtime: static`, builds with
`npm ci && npm run build`, publishes `./dist`, and rewrites all paths to
`index.html` for client-side routing compatibility.

## Notes

All calculations convert UI inputs into SI units internally. Results are intended
for design guidance only; final values must be checked against the selected gate
driver, MOSFET, diode, capacitor derating, layout, and measured waveforms.
