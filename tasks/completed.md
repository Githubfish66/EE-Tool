# Completed

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
