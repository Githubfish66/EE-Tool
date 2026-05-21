# Completed

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
