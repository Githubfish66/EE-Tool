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
- RLC symbolic solver for SIMPLIS/SPICE-like R/L/C/V netlists with `.PRINT`
  voltage/current outputs, SymPy MNA s-domain expressions, numeric
  substitution, inverse-Laplace time-domain expressions, and waveform previews.
  The EE Tool RLC page serves the original `rlc-symbolic-solver` web app from
  `/rlc-original`, with a Workbench layout that keeps netlist input, output
  selection, and quick results visible together.
- Verilog-A model library with reusable `.va` source preview/download for a
  timer-based dead-time generator plus a VDS edge timing marker for confirming
  when VDS leaves its stable high or low plateau soon after the matching gate
  command at the start of turn-on and turn-off.

Live distributor stock and pricing require API keys, so this frontend
generates distributor search links instead of calling Digi-Key or Mouser APIs
directly.

## Run Locally

```bash
npm install
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe backend\run_api.py
npm run dev
```

The Vite dev server proxies `/api/*` to the FastAPI backend at
`http://127.0.0.1:8000`.

## Validate

```bash
npm run test
.\.venv\Scripts\python.exe -m pytest -q backend\tests
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

Create a Render Web Service from that GitHub repository:

- Render Dashboard: **New** -> **Web Service**
- Repository: `Githubfish66/EE-Tool`
- Branch: `main`
- Build command: `pip install -r requirements.txt && npm ci && npm run build`
- Start command: `python backend/run_api.py`
- Environment variable: `HOST=0.0.0.0`

This repository also includes `render.yaml`, so you can create the site as a
Render Blueprint instead. The Blueprint config deploys a Python web service
named `ee-tool`, builds the React frontend into `dist`, serves the built app
from FastAPI, and exposes the RLC solver API under `/api/*`.

## Notes

All calculations convert UI inputs into SI units internally. Results are intended
for design guidance only; final values must be checked against the selected gate
driver, MOSFET, diode, capacitor derating, layout, and measured waveforms.
