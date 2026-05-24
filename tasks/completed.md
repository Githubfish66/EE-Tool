# Completed

## Restore RLC Iframe Loading

- Completion date: 2026-05-24
- Modified files:
  - `src/App.tsx`
  - `dist/*`
  - `tasks/completed.md`
- Notes: Diagnosed the blank RLC page as the embedded `/rlc-original` app not being served because the local FastAPI backend was not running. Started the backend on port 8000, updated the iframe cache key to `workbench-fill-result`, rebuilt the production frontend, and verified the RLC iframe loads content at `http://127.0.0.1:8000/`.

## Fill RLC Quick Result Width

- Completion date: 2026-05-24
- Modified files:
  - `backend/rlc_symbolic_solver/web/index.html`
  - `backend/rlc_symbolic_solver/web/styles.css`
  - `tasks/in-progress.md`
  - `tasks/completed.md`
- Notes: Changed the RLC Quick Result area to a full-width single-column section so the result panel and summary row fill the available Workbench width. Tightened formula grids to use flexible `minmax(0, 1fr)` tracks and added CSS cache busting for the refreshed stylesheet. Browser layout measurement confirmed the Quick Result panel expanded to the full Workbench width.

## Compact RLC Workbench Layout

- Completion date: 2026-05-24
- Modified files:
  - `backend/rlc_symbolic_solver/web/index.html`
  - `backend/rlc_symbolic_solver/web/styles.css`
  - `tasks/in-progress.md`
  - `tasks/completed.md`
- Notes: Tightened the RLC Workbench layout after visual review. The top row now uses a two-column input/analysis layout, the quick-result area spans the full width below it with summary cards beside the result panel, formula cards use the available horizontal space, and the stylesheet URL is versioned to avoid stale cached CSS. Browser layout measurement confirmed the updated Workbench geometry at `http://127.0.0.1:5178/rlc-original`.

## Apply RLC Workbench Layout

- Completion date: 2026-05-24
- Modified files:
  - `backend/rlc_symbolic_solver/web/index.html`
  - `backend/rlc_symbolic_solver/web/styles.css`
  - `src/App.tsx`
  - `README.md`
  - `tasks/in-progress.md`
  - `tasks/completed.md`
- Notes: Applied template A to the RLC original web app as a Workbench layout: top action toolbar, left netlist editor, middle analysis/output picker, right quick results, and lower waveform/component detail area. Added a versioned iframe URL so EE Tool loads the refreshed RLC page instead of stale cached markup. Validation passed with `npm run lint`, `npm run test`, `.venv\Scripts\python.exe -m pytest -q backend\tests`, `npm run build`, browser DOM checks for the Workbench iframe at `http://127.0.0.1:5178/`, and direct RLC analyze/solve API checks.

## Embed Original RLC Solver UI

- Completion date: 2026-05-24
- Modified files:
  - `backend/rlc_symbolic_solver/web/index.html`
  - `backend/rlc_symbolic_solver/web/app.js`
  - `backend/rlc_symbolic_solver/web/styles.css`
  - `backend/rlc_symbolic_solver/api.py`
  - `src/App.tsx`
  - `src/styles.css`
  - `vite.config.ts`
  - `README.md`
  - `tasks/in-progress.md`
  - `tasks/completed.md`
- Notes: Replaced the React-reimplemented RLC workspace with an iframe that loads the original `rlc-symbolic-solver` web UI from `/rlc-original`. The backend now serves the original static files under `/static`, preserving the original `Netlist Solver`, `Analyze outputs`, `Version Updates`, selection, expression sandbox, and waveform interactions. Removed the previous TypeScript approximation files so RLC behavior is owned by the original Python/FastAPI/SymPy app. Validation passed with `npm run lint`, `npm run test`, `npm run build`, `.venv\Scripts\python.exe -m pytest -q backend\tests`, `.venv\Scripts\python.exe -m compileall backend`, and browser iframe interaction checks at `http://127.0.0.1:5178/`.

## Add Full RLC Solver Backend

- Completion date: 2026-05-24
- Modified files:
  - `backend/rlc_symbolic_solver/*`
  - `backend/tests/*`
  - `backend/run_api.py`
  - `src/App.tsx`
  - `src/styles.css`
  - `src/lib/rlcSolverApi.ts`
  - `vite.config.ts`
  - `package.json`
  - `requirements.txt`
  - `pytest.ini`
  - `render.yaml`
  - `README.md`
  - `example.txt`
  - `tasks/in-progress.md`
  - `tasks/completed.md`
- Notes: Integrated the original Python/FastAPI/SymPy RLC symbolic solver backend into EE Tool. The RLC page now calls `/api/analyze` and `/api/solve-many`, showing original SymPy expressions, numeric substitutions, inverse-Laplace time-domain expressions, and waveform previews. FastAPI can serve the built React app from `dist`, Vite proxies `/api` during development, and Render is configured as a Python web service. Validation passed with `.venv\Scripts\python.exe -m pytest -q backend\tests`, `npm run lint`, `npm run test`, `npm run build`, `.venv\Scripts\python.exe -m compileall backend`, and browser verification at `http://127.0.0.1:5177/`.

## Integrate RLC Symbolic Solver

- Completion date: 2026-05-24
- Modified files:
  - `src/App.tsx`
  - `src/styles.css`
  - `src/lib/rlcSymbolicSolver.ts`
  - `src/lib/rlcSymbolicSolver.test.ts`
  - `tasks/in-progress.md`
  - `tasks/completed.md`
- Notes: Added a front-end TypeScript port of the RLC symbolic solver from `C:\Users\0662TX\Desktop\rlc-symbolic-solver`. The new EE Tool page imports or pastes RLC netlists, parses R/L/C/V components, supports `.PRINT V(node)`, `.PRINT V(node_a,node_b)`, `.PRINT I(Vsource)`, labels outputs from `.GRAPH curveLabel`, solves the MNA system in s-domain, and displays symbolic expressions plus numeric substitutions. Time-domain waveform plotting was intentionally not migrated because the original implementation depends on SymPy inverse Laplace support. Validation passed with `npm run lint`, `npm run test`, `npm run build`, and browser verification at `http://127.0.0.1:5176/`.

## Remove unused loss monitor and Power Probe script features

- Completion date: 2026-05-23
- Modified files:
  - `src/App.tsx`
  - `src/lib/simetrixScriptGenerator.ts`
  - `src/lib/simetrixScriptGenerator.test.ts`
  - `src/lib/verilogAModelLibrary.ts`
  - `src/lib/verilogAModelLibrary.test.ts`
  - `src/styles.css`
  - `README.md`
  - `tasks/completed.md`
- Notes: Removed the unstable SIMetrix Power Probe post-process script generator from the UI and script library, and removed the unused `mosfet_loss_monitor.va` and `auto_nmos_loss.va` entries from the Verilog-A model library. Kept the working `vds_edge_marker.va` timing-window model and the SIMetrix model sweep generator.

## Use Vec for SIMetrix window net references

- Completion date: 2026-05-23
- Modified files:
  - `src/lib/simetrixScriptGenerator.ts`
  - `src/lib/simetrixScriptGenerator.test.ts`
- Notes: Updated the SIMetrix Power Probe post-process generator to reference timing-window and state nets with `Vec('net_name')` instead of `V(net_name)`, matching SIMetrix vector-expression syntax for saved node vectors. The generated script now uses forms such as `Vec('Q1#pwr')*Vec('WIN_Q1_ON')`. Updated tests and validated with `npm run lint`, `npm run test`, and `npm run build`.

## Use SIMetrix Power Probe vectors in post-process script

- Completion date: 2026-05-23
- Modified files:
  - `src/lib/simetrixScriptGenerator.ts`
  - `src/lib/simetrixScriptGenerator.test.ts`
- Notes: Replaced generated `Power('Q1')` expressions with `Vec('Q1#pwr')`, matching SIMetrix's documented vector name after using Probe > Power In Device. Added a generated-script comment reminding users to create the Power Probe vector first. Updated tests and validated with `npm run lint`, `npm run test`, and `npm run build`.

## Quote SIMetrix Power Probe references

- Completion date: 2026-05-23
- Modified files:
  - `src/lib/simetrixScriptGenerator.ts`
  - `src/lib/simetrixScriptGenerator.test.ts`
  - `tasks/in-progress.md`
  - `tasks/completed.md`
- Notes: Updated the SIMetrix Power Probe post-process generator to quote component references inside `Power()` expressions, producing forms such as `Power('Q1')*V(WIN_Q1_OFF)`. This avoids SIMetrix interpreting unquoted refs like `Q1` as waveform vector names. Updated unit tests and validated with `npm run lint`, `npm run test`, and `npm run build`.

## Add Power Probe timing-window post-process mode

- Completion date: 2026-05-23
- Modified files:
  - `src/lib/simetrixScriptGenerator.ts`
  - `src/lib/simetrixScriptGenerator.test.ts`
  - `src/App.tsx`
  - `README.md`
  - `tasks/completed.md`
- Notes: Added a timing-window mode to the SIMetrix Power Probe post-process generator. The UI now defaults to `vds_edge_marker` window nets with prefix `WIN`, producing `Power(Qx)*V(WIN_Qx_ON)` and `Power(Qx)*V(WIN_Qx_OFF)` curves while retaining the previous `auto_nmos_loss` state-net mode for conduction/body-diode slicing. Added unit test coverage for the new `WIN_Q1_ON/OFF` script output. Validation passed with `npm run lint`, `npm run test`, and `npm run build`.

## Sharpen VDS marker output edges

- Completion date: 2026-05-23
- Modified files:
  - `src/lib/verilogAModelLibrary.ts`
  - `src/lib/verilogAModelLibrary.test.ts`
  - `tasks/in-progress.md`
  - `tasks/completed.md`
- Notes: Reduced the default `vds_edge_marker.va` marker output rise/fall time from `1n` to `100p`, making start/end marker pulse edges easier to inspect with SIMetrix cursors. The measured `t_turn_on` and `t_turn_off` outputs continue to use event-time differences, so marker edge speed only affects visual inspection. Updated tests and validated with `npm run lint`, `npm run test`, and `npm run build`.

## Add switching start/end timing outputs

- Completion date: 2026-05-23
- Modified files:
  - `src/lib/verilogAModelLibrary.ts`
  - `src/lib/verilogAModelLibrary.test.ts`
  - `README.md`
  - `tasks/in-progress.md`
  - `tasks/completed.md`
- Notes: Extended `vds_edge_marker.va` with separate start markers, end markers, active switching windows, and scaled timing outputs. The model now exposes `mark_turn_on_end`, `mark_turn_off_end`, `win_turn_on`, `win_turn_off`, `t_turn_on`, and `t_turn_off`; `VDS_END_DELTA` controls the opposite-plateau end point and `TIME_SCALE` controls timing readout units. Updated model metadata and tests. Validation passed with `npm run lint`, `npm run test`, and `npm run build`.

## Tighten gate-qualified VDS marker arming

- Completion date: 2026-05-23
- Modified files:
  - `src/lib/verilogAModelLibrary.ts`
  - `src/lib/verilogAModelLibrary.test.ts`
  - `README.md`
  - `tasks/in-progress.md`
  - `tasks/completed.md`
- Notes: Added `ARM_TIMEOUT` to `vds_edge_marker.va` so a gate edge can only arm the matching VDS departure marker for a bounded interval. The VDS crossing handlers now also re-check `V(g,s)` against `VGS_ON_ARM` or `VGS_OFF_ARM` before firing, reducing stale-arm false markers when the gate input is not aligned with the actual power transition. Updated README wording and tests. Validation passed with `npm run lint`, `npm run test`, and `npm run build`.

## Add gate-qualified VDS edge marker

- Completion date: 2026-05-23
- Modified files:
  - `src/lib/verilogAModelLibrary.ts`
  - `src/lib/verilogAModelLibrary.test.ts`
  - `README.md`
  - `tasks/in-progress.md`
  - `tasks/completed.md`
- Notes: Updated `vds_edge_marker.va` to include a gate input and require gate-command qualification before VDS platform departure can create turn-on or turn-off markers. A rising `VGS_ON_ARM` crossing arms the next turn-on marker, and a falling `VGS_OFF_ARM` crossing arms the next turn-off marker; the marker then fires only when VDS leaves the configured stable plateau in the expected direction. Updated metadata, README wording, and tests. Validation passed with `npm run lint`, `npm run test`, and `npm run build`.

## Improve VDS edge timing marker start detection

- Completion date: 2026-05-23
- Modified files:
  - `src/lib/verilogAModelLibrary.ts`
  - `src/lib/verilogAModelLibrary.test.ts`
  - `README.md`
  - `tasks/in-progress.md`
  - `tasks/completed.md`
- Notes: Updated `vds_edge_marker.va` to detect the beginning of VDS transitions by watching when VDS leaves its stable high or low plateau. Replaced the mid-transition `VDS_ON_TH` / `VDS_OFF_TH` marker parameters with `VDS_HIGH_STABLE`, `VDS_LOW_STABLE`, and `VDS_DEPART_DELTA`, so turn-on is marked at `VDS_HIGH_STABLE - VDS_DEPART_DELTA` and turn-off is marked at `VDS_LOW_STABLE + VDS_DEPART_DELTA`. Updated model metadata, README wording, and tests. Validation passed with `npm run lint`, `npm run test`, and `npm run build`.

## Add VDS edge timing marker

- Completion date: 2026-05-23
- Modified files:
  - `src/lib/verilogAModelLibrary.ts`
  - `src/lib/verilogAModelLibrary.test.ts`
  - `README.md`
  - `tasks/in-progress.md`
  - `tasks/completed.md`
- Notes: Added a small `vds_edge_marker.va` Verilog-A model library entry for confirming turn-on and turn-off timing from VDS threshold crossings before building loss windows. The model outputs visible marker pulses when VDS falls below `VDS_ON_TH` and rises above `VDS_OFF_TH`, with tunable `MARK_WIDTH`, output levels, and transition times. Added tests for the model source and SIMetrix parameter paste block. Validation passed with `npm run lint`, `npm run test`, and `npm run build`.

## Improve auto N-MOSFET loss classifier windows

- Completion date: 2026-05-23
- Modified files:
  - `src/lib/verilogAModelLibrary.ts`
  - `src/lib/verilogAModelLibrary.test.ts`
  - `tasks/in-progress.md`
  - `tasks/completed.md`
- Notes: Updated `auto_nmos_loss` to classify turn-on and turn-off with VDS threshold crossings plus timer-cleared hold windows instead of instantaneous dVDS/dt states. Added `VDS_ON_TH`, `VDS_OFF_TH`, `TON_HOLD`, and `TOFF_HOLD` parameters, removed the `DVDS_DT_MIN` threshold from the public parameter list, refreshed usage guidance, and updated tests to verify the crossing/timer behavior and parameter paste block. Validation passed with `npm run lint`, `npm run test`, and `npm run build`.

## Add SIMetrix Power Probe post-process script generator

- Completion date: 2026-05-23
- Modified files:
  - `src/lib/simetrixScriptGenerator.ts`
  - `src/lib/simetrixScriptGenerator.test.ts`
  - `src/App.tsx`
  - `src/styles.css`
  - `README.md`
  - `tasks/in-progress.md`
  - `tasks/completed.md`
- Notes: Added a SIMetrix Power Probe post-process script generator on the SIMetrix page. It creates `Curve` commands that multiply native `Power(ref)` waveforms by `auto_nmos_loss` state nets such as `ST_Q1_ON`, `ST_Q1_OFF`, `ST_Q1_COND`, and `ST_Q1_BODY`, so classified full-device power curves can be created without manual Add Curve steps. Added options for MOSFET refs, state net prefix, state high scale, and raw Power(Qx) curve output. Added unit tests for generated curve expressions, scaling, identifier sanitization, and required inputs. Validation passed with `npm run lint`, `npm run test`, and `npm run build`; browser UI check passed at `http://127.0.0.1:5176/`.

## Add auto N-MOSFET loss monitor

- Completion date: 2026-05-23
- Modified files:
  - `src/lib/verilogAModelLibrary.ts`
  - `src/lib/verilogAModelLibrary.test.ts`
  - `README.md`
  - `tasks/in-progress.md`
  - `tasks/completed.md`
- Notes: Added a separate `auto_nmos_loss.va` Verilog-A model library entry that keeps the external-window MOSFET monitor intact while automatically slicing N-channel drain-path loss into total, conduction, turn-on, turn-off, and body-diode outputs. The model prioritizes VDS slew switching states, then reverse-current negative-VDS body-diode behavior, then low-VDS gate-on conduction, and exposes `state_*` outputs plus tunable VGS, VDS, current, and dVDS/dt thresholds for validation. Added tests for the source pattern and SIMetrix parameter assignment text, documented the additional library model in README, verified the model page in the browser, and passed `npm run lint`, `npm run test`, and `npm run build`.

## Add MOSFET loss-separation Verilog-A monitor

- Completion date: 2026-05-22
- Modified files:
  - `src/lib/verilogAModelLibrary.ts`
  - `src/lib/verilogAModelLibrary.test.ts`
  - `src/styles.css`
  - `README.md`
  - `tasks/in-progress.md`
  - `tasks/completed.md`
- Notes: Added a downloadable `mosfet_loss_monitor.va` model library entry for SIMetrix. The monitor measures drain-path `VDS x ID` loss with an inline zero-volt drain-current sensor, measures gate-driver supply power with a separate inline supply sensor, and exposes externally windowed total, conduction, turn-on, turn-off, dead-time, and body-diode power outputs. Documented sensor orientation, window overlap guidance, and 1 V = 1 W output usage in the model page. Added model-library tests for the source pattern and parameter paste block, tightened Verilog-A summary metric sizing for long identifiers, verified the model page in the browser, and passed `npm run lint`, `npm run test`, and `npm run build`.

## Add SIMetrix parameter paste panel

- Completion date: 2026-05-22
- Modified files:
  - `src/lib/verilogAModelLibrary.ts`
  - `src/lib/verilogAModelLibrary.test.ts`
  - `src/App.tsx`
  - `src/styles.css`
  - `tasks/in-progress.md`
  - `tasks/completed.md`
- Notes: Added a read-only SIMetrix parameter paste panel to each Verilog-A model page. The text is generated from model parameter metadata as one `Param=value` assignment per line, so future models inherit the same copy-ready output. Added a unit test for the dead-time generator assignment block and verified the rendered textarea content in the browser. Validation passed with `npm run lint`, `npm run test`, and `npm run build`.

## Add Verilog-A model library

- Completion date: 2026-05-22
- Modified files:
  - `src/lib/verilogAModelLibrary.ts`
  - `src/lib/verilogAModelLibrary.test.ts`
  - `src/App.tsx`
  - `src/styles.css`
  - `README.md`
  - `CLAUDE.md`
  - `tasks/in-progress.md`
  - `tasks/completed.md`
- Notes: Added a scalable Verilog-A model library feature with sidebar navigation, model selection, port and parameter summaries, source preview/download, and SIMetrix usage steps. Seeded it with the timer-based dead-time generator, kept model metadata in `src/lib` for incremental additions, added unit tests that guard the shipped source pattern, and verified the new page in the browser at desktop and mobile widths. Validation passed with `npm run lint`, `npm run test`, and `npm run build`.

## Pair compensator values with circuit artwork

- Completion date: 2026-05-22
- Modified files:
  - `src/App.tsx`
  - `src/styles.css`
  - `tasks/in-progress.md`
  - `tasks/completed.md`
- Notes: Added the selected compensator topology diagram beside the component value table so symbols such as R1, R2, C1, C2, and C3 can be matched to calculated values without opening calculation steps. Kept the existing circuit diagram in the calculation flow and added a responsive stacked layout for narrower viewports. Validation passed with `npm run test` and `npm run build`.

## Update compensator circuit artwork

- Completion date: 2026-05-22
- Modified files:
  - `參考資料/Type I polished.png`
  - `參考資料/Type II polished.png`
  - `參考資料/Type III polished.png`
  - `src/App.tsx`
  - `src/mathml.d.ts`
  - `tasks/in-progress.md`
  - `tasks/completed.md`
- Notes: Added polished generated Type I, Type II, and Type III compensator circuit artwork, kept the original reference JPGs, switched the UI image imports to the new PNG files, and added PNG module typing for the TypeScript build. Validation passed with `npm run test` and `npm run build`.

## Improve EE Tool visual design

- Completion date: 2026-05-22
- Modified files:
  - `src/App.tsx`
  - `src/styles.css`
  - `package.json`
  - `package-lock.json`
  - `tasks/in-progress.md`
  - `tasks/completed.md`
- Notes: Refreshed the app with a cleaner engineering dashboard style, modernized typography, surfaces, navigation, tabs, form controls, action buttons, metric cards, focus states, and added lucide-react icons for feature navigation and key actions. Updated shared pending-analysis copy to fit all tool pages. Validation passed with `npm run test`, `npm run build`, and browser checks on Bootstrap, Compensator, and SIMetrix views.

## Deploy EE Tool to Render

- Completion date: 2026-05-21
- Modified files:
  - `render.yaml`
  - `README.md`
  - `tasks/in-progress.md`
  - `tasks/completed.md`
- Notes: Added a Render Static Site Blueprint that builds with `npm ci && npm run build`, publishes `./dist`, and rewrites paths to `index.html`. Updated deployment documentation for Render Dashboard and Blueprint setup. Validation passed with `npm run test` and `npm run build`.

## Add SIMetrix sweep script generator

- Completion date: 2026-05-21
- Modified files:
  - `src/lib/simetrixScriptGenerator.ts`
  - `src/lib/simetrixScriptGenerator.test.ts`
  - `src/App.tsx`
  - `src/styles.css`
  - `tasks/in-progress.md`
  - `tasks/completed.md`
- Notes: Added a SIMetrix script tool that imports or pastes netlist text, detects Q/M/S/X switch candidates, lets users select references and enter model names, supports same-model and all-combination sweeps, previews/downloads `.sxscr`, and includes unit tests for parsing, model normalization, run counting, and script generation.

## Fix compensator exact topology formulas

- Completion date: 2026-05-21
- Modified files:
  - `src/lib/compensatorCalculator.ts`
  - `src/lib/compensatorCalculator.test.ts`
  - `src/App.tsx`
  - `tasks/in-progress.md`
  - `tasks/completed.md`
- Notes: Updated Type II manual component synthesis to use the exact feedback-network pole equation, corrected displayed Type II pole formula, added Type II/III topology back-calculation assertions, and expanded Type III UI formulas to show the exact component-to-pole-zero relationships.

## Add AGENTS.md governance files

- Completion date: 2026-05-21
- Modified files:
  - `.gitignore`
  - `.env.example`
  - `CLAUDE.md`
  - `tasks/backlog.md`
  - `tasks/in-progress.md`
  - `tasks/completed.md`
  - `tasks/blocked.md`
  - `docs/decisions/README.md`
  - `package.json`
- Notes: Added the missing workflow, security, task tracking, and validation scaffolding required by AGENTS.md.
