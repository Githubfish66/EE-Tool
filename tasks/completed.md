# Completed

## Add SIMetrix Laplace Expression Output

- Completion date: 2026-06-02
- Modified files:
  - `src/lib/compensatorCalculator.ts`
  - `src/lib/compensatorCalculator.test.ts`
  - `src/App.tsx`
  - `src/styles.css`
  - `tasks/in-progress.md`
  - `tasks/completed.md`
- Notes: Added a copy-ready `simetrixLaplaceExpression` to analog compensator results. The expression uses normalized `1+s/w` factors with all zero and pole frequencies converted from Hz to rad/s, and scales `K` so the expression matches the internal `Gc(s)` gain at `f_C`. The analog compensator result panel now shows the SIMetrix Laplace expression in a read-only preview with a copy button and clipboard fallback. Added Type I/II/III assertions for generated expressions. Validation passed with `npm run lint`, `npx vitest run src/lib/compensatorCalculator.test.ts`, `npm run test`, and `npm run build`. Browser verification was attempted via tool discovery, but the in-app Browser tool was not exposed in this environment.

## Digital Controller Draft Input Optimization

- Completion date: 2026-06-02
- Modified files:
  - `src/App.tsx`
  - `tasks/in-progress.md`
  - `tasks/completed.md`
- Notes: Further reduced digital controller page input lag by moving editable digital parameters into local draft state. Typing in `f_s`, `f_PWM`, delay, duty, ADC, DPWM, or PWM carrier now avoids updating top-level `App` state and keeps the heavy Plotly result panel stable. The draft values are synchronized back to the shared state only when the user clicks "Run Digital Analysis" / "更新數位分析". Wrapped the digital result panel in `React.memo` so unchanged analysis results do not rerender while editing inputs. Validation passed with `npm run lint`, `npx vitest run src/lib/digitalCompensatorCalculator.test.ts src/lib/compensatorCalculator.test.ts`, and `npm run build`.

## Digital Controller Render Optimization

- Completion date: 2026-06-02
- Modified files:
  - `src/App.tsx`
  - `tasks/in-progress.md`
  - `tasks/completed.md`
- Notes: Reduced digital controller page input lag by memoizing the expensive digital analysis and switching parameter edits to a manual refresh flow. Changing `f_s`, `f_PWM`, PWM carrier, delay, duty, ADC, or DPWM settings now marks the digital result stale instead of recalculating Bode/delay/aliasing/SIMPLIS output on every keystroke. Users refresh the result with the new "Run Digital Analysis" / "更新數位分析" button. Validation passed with `npm run lint`, `npx vitest run src/lib/digitalCompensatorCalculator.test.ts src/lib/compensatorCalculator.test.ts`, and `npm run build`.

## Split Analog And Digital Controller Pages

- Completion date: 2026-06-02
- Modified files:
  - `src/App.tsx`
  - `tasks/in-progress.md`
  - `tasks/completed.md`
- Notes: Split the loop compensation workflow into separate Analog Compensator and Digital Controller navigation pages. The analog page now focuses on Bode import, Type I/II/III design, component values, analog Bode plots, and calculation steps. The digital page reuses the latest analog `Gc(s)` result, owns sampling/PWM/delay/ADC/DPWM settings, shows a clear empty state when analog analysis has not run, and warns when analog settings changed after the last run. Validation passed with `npm run lint`, `npx vitest run src/lib/digitalCompensatorCalculator.test.ts src/lib/compensatorCalculator.test.ts`, and `npm run build`.

## Add RLC Backend Retry

- Completion date: 2026-06-02
- Modified files:
  - `src/App.tsx`
  - `src/styles.css`
  - `tasks/completed.md`
- Notes: Updated the RLC Symbolic Analyzer availability check so a temporary backend miss does not leave the page permanently stuck on the backend-not-connected state. The workspace now retries `/rlc-original/` automatically and provides a manual reconnect button. Started the local FastAPI backend and confirmed both `:8000` and Vite proxy `:5173` return `Netlist Solver`. Validation passed with `npm run build`, `npm run test`, and `.venv\Scripts\python.exe -m pytest -q backend\tests`.

## Add RLC Backend Availability State

- Completion date: 2026-05-27
- Modified files:
  - `src/App.tsx`
  - `src/styles.css`
  - `tasks/completed.md`
- Notes: Fixed the blank RLC Symbolic Analyzer page when the frontend is opened without the FastAPI backend ready. The RLC workspace now probes `/rlc-original/` before rendering the iframe, shows a clear backend-not-connected state instead of an empty frame, and renders the iframe once the original solver HTML is available. Started the local backend for verification. Validation passed with `npm run build`, `.venv\Scripts\python.exe -m pytest -q backend\tests`, and HTTP checks confirming both `:8000` and Vite proxy `:5173` return `Netlist Solver` for `/rlc-original/`.

## Aliasing Explanation Clarification

- Completion date: 2026-05-27
- Modified files:
  - `src/App.tsx`
  - `src/styles.css`
  - `tasks/in-progress.md`
  - `tasks/completed.md`
- Notes: Rewrote the Sampling & Aliasing diagnostics explanation in plainer language so users can understand that PWM high-frequency noise may be misread as low-frequency noise after digital sampling. Added a camera-and-spinning-wheel analogy, a first-row table example, and renamed table headers to describe the disturbance, PWM sideband, sampled alias, foldback strength, and risk. Validation passed with `npm run lint` and `npm run build`.

## Sampling Aliasing Diagnostics

- Completion date: 2026-05-27
- Modified files:
  - `src/lib/digitalCompensatorCalculator.ts`
  - `src/lib/digitalCompensatorCalculator.test.ts`
  - `src/App.tsx`
  - `src/styles.css`
  - `tasks/in-progress.md`
  - `tasks/completed.md`
- Notes: Added first-pass PWM sampling and aliasing diagnostics based on the harmonic-spectrum article. The digital calculator now reports Nyquist frequency, control update frequency, lower-sideband frequencies `f_PWM - f_m`, folded alias frequencies, alias/direct gain ratio, and risk classification. The UI now shows a Sampling & Aliasing diagnostics panel with a risk table. Validation passed with `npm run lint`, `npx vitest run src/lib/digitalCompensatorCalculator.test.ts src/lib/compensatorCalculator.test.ts`, and `npm run build`. Browser validation at `http://127.0.0.1:5173/` was attempted but the in-app browser runtime was blocked by the local Windows sandbox.

## Digital Parameter Delay Categories

- Completion date: 2026-05-27
- Modified files:
  - `src/App.tsx`
  - `src/styles.css`
  - `tasks/in-progress.md`
  - `tasks/completed.md`
- Notes: Classified digital controller guide parameters by delay impact. Added badges and visual left borders for direct delay impact, indirect delay impact, and no small-signal delay impact. Direct delay parameters include `f_PWM`, `PWM_UPDATE_CYCLES`, PWM carrier type, `COMPUTE_DELAY`, and `OUTPUT_DELAY`; indirect parameters include `f_s` and duty settings; ADC/DPWM resolution is marked as not affecting small-signal delay. Validation passed with `npm run lint` and `npm run build`. Browser validation at `http://127.0.0.1:5173/` was attempted but the in-app browser runtime was blocked by the local Windows sandbox.

## N-Cycle Hold Delay Illustration

- Completion date: 2026-05-27
- Modified files:
  - `src/App.tsx`
  - `src/styles.css`
  - `tasks/in-progress.md`
  - `tasks/completed.md`
- Notes: Added a visual N-cycle hold delay explanation to the digital controller guide. The figure compares the N=1 baseline with an N=4 update window, marks the equivalent hold centers, and labels the extra delay as `(N - 1) * T_PWM / 2`. Validation passed with `npm run lint` and `npm run build`. Browser validation at `http://127.0.0.1:5173/` was attempted but the in-app browser runtime was blocked by the local Windows sandbox.

## Digital Controller N-Cycle Update Delay

- Completion date: 2026-05-27
- Modified files:
  - `src/lib/digitalCompensatorCalculator.ts`
  - `src/lib/digitalCompensatorCalculator.test.ts`
  - `src/App.tsx`
  - `src/styles.css`
  - `tasks/in-progress.md`
  - `tasks/completed.md`
- Notes: Replaced the guide explanation with a clearer total-delay equation: `T_delay,total = T_compute + T_output + T_PWM + T_update_hold`. Added `PWM_UPDATE_CYCLES` to model duty updates that occur every N PWM cycles, using the low-frequency hold-delay approximation `T_update_hold ~= (N - 1) * T_PWM / 2`. Added the parameter to the UI, SIMPLIS parameter export, delay breakdown, and tests. Expanded the digital guide with a complete system flow diagram from power stage feedback through ADC, `G_c(z)`, duty clamp, DPWM, PWM, and back to the power stage. Validation passed with `npm run lint`, `npx vitest run src/lib/digitalCompensatorCalculator.test.ts src/lib/compensatorCalculator.test.ts`, and `npm run build`. Browser validation at `http://127.0.0.1:5173/` was attempted but the in-app browser runtime was blocked by the local Windows sandbox.

## Digital Parameter Guide Formulas

- Completion date: 2026-05-27
- Modified files:
  - `src/App.tsx`
  - `src/styles.css`
  - `tasks/in-progress.md`
  - `tasks/completed.md`
- Notes: Extended the digital controller parameter guide with formulas for sampling period, Nyquist frequency, delay phase, PWM period, PWM modulator delay, duty clamp, computation delay, output delay, ADC LSB, and DPWM duty step. Added PWM carrier type diagrams for pure delay, trailing-edge sawtooth, leading-edge sawtooth, and symmetric PWM. Added explicit cross references from the delay-flow figure to the parameter cards for `COMPUTE_DELAY`, `OUTPUT_DELAY`, and `f_PWM + carrier type`. Validation passed with `npm run lint` and `npm run build`. Browser validation at `http://127.0.0.1:5173/` was attempted but the in-app browser runtime was blocked by the local Windows sandbox.

## Digital Controller Parameter Guide

- Completion date: 2026-05-27
- Modified files:
  - `src/App.tsx`
  - `src/styles.css`
  - `tasks/in-progress.md`
  - `tasks/completed.md`
- Notes: Added an in-app digital controller parameter guide directly after the delay budget section. The guide explains `f_s`, `f_PWM`, PWM carrier type, duty limits and initial duty, computation delay, output delay, ADC bits, and DPWM bits with what each parameter affects, when to adjust it, when it can be left unchanged, and a practical example. Added a visual timing-flow figure showing ADC sampling, compute delay, IIR duty calculation, output delay, PWM load, carrier delay, and active duty. Validation passed with `npm run lint` and `npm run build`. Browser validation at `http://127.0.0.1:5173/` was attempted twice but the in-app browser runtime was blocked by the local Windows sandbox.

## PWM Delay Model Upgrade

- Completion date: 2026-05-27
- Modified files:
  - `src/lib/digitalCompensatorCalculator.ts`
  - `src/lib/digitalCompensatorCalculator.test.ts`
  - `src/App.tsx`
  - `src/styles.css`
  - `tasks/in-progress.md`
  - `tasks/completed.md`
- Notes: Expanded the digital controller delay model into a PWM-aware delay budget. The calculator now separates computation delay, output-register delay, and PWM modulator delay; supports pure delay, trailing-edge, leading-edge, and symmetric PWM modes; adds symmetric PWM magnitude attenuation to the digital controller and loop Bode curves; and reports PWM attenuation at crossover. The compensator UI now includes PWM frequency, PWM carrier type, computation delay samples, and a delay breakdown table. Validation passed with `npm run lint`, `npx vitest run src/lib/digitalCompensatorCalculator.test.ts src/lib/compensatorCalculator.test.ts`, and `npm run build`. Browser validation was attempted at `http://127.0.0.1:5173/`, but the in-app browser runtime was blocked by the local Windows sandbox.

## Digital Controller Delay Bode And SIMPLIS Guide

- Completion date: 2026-05-27
- Modified files:
  - `src/lib/digitalCompensatorCalculator.ts`
  - `src/lib/digitalCompensatorCalculator.test.ts`
  - `src/App.tsx`
  - `src/styles.css`
  - `tasks/in-progress.md`
  - `tasks/completed.md`
- Notes: Added delay-aware digital controller verification to the compensator workflow. The digital calculator now generates `Gc(z)` and `Gc(z)z^-N` Bode data, digital loop gain with and without delay, delay budget, and delay-aware stability margins. The UI now shows analog-vs-digital controller Bode comparison, digital loop gain comparison, f_s/20 and f_s/10 guide lines, delay margin summary cards, and an expandable SIMPLIS C-Code DLL usage guide covering project setup, pins, parameters, action.c flow, and Type III third-order handling. Validation passed with `npm run lint`, `npx vitest run src/lib/digitalCompensatorCalculator.test.ts src/lib/compensatorCalculator.test.ts`, `npm run build`, and browser checks at `http://127.0.0.1:5176/`.

## Digital Compensator Design Flow

- Completion date: 2026-05-27
- Modified files:
  - `src/lib/digitalCompensatorCalculator.ts`
  - `src/lib/digitalCompensatorCalculator.test.ts`
  - `src/App.tsx`
  - `src/styles.css`
  - `tasks/in-progress.md`
  - `tasks/completed.md`
- Notes: Added a first-pass digital controller stage to the existing compensator workflow. The tool now accepts sampling frequency, duty clamp, initial duty, output delay, ADC bits, and DPWM bits, then converts the analog compensator result with Tustin into IIR coefficients, SIMPLIS parameter text, and a downloadable C-Code DLL core function. Type III full Tustin conversion is surfaced as third-order output so users can expose B3/A3 or split into cascaded sections rather than silently losing a pole. Validation passed with `npm run lint`, `npx vitest run src/lib/digitalCompensatorCalculator.test.ts src/lib/compensatorCalculator.test.ts`, `npm run build`, and browser checks at `http://127.0.0.1:5176/`. Full `npm run test` still hits the existing `r2-file-share/test/validation.test.js` Vitest suite-discovery issue.

## EE Tool sidebar grouping and title refresh

- Completion date: 2026-05-26
- Modified files:
  - `src/App.tsx`
  - `src/styles.css`
  - `tasks/in-progress.md`
  - `tasks/completed.md`
- Notes: Reorganized the main EE Tool sidebar into 周邊電路計算, SIMetrix 工作流, and 電路分析. Moved MOSFET 接面溫度迭代 under SIMetrix 工作流, refreshed the visible feature titles in Traditional Chinese and English, and widened the desktop sidebar so the new labels fit cleanly. Validation passed with `npm run lint`, `npx vitest run src/lib`, `npm run build`, and browser desktop/mobile layout checks. Full `npm run test` still hits the existing `r2-file-share/test/validation.test.js` Vitest suite-discovery issue.

## 精簡 SIMetrix 指南並補充 Convergence Dialog 用法

- Completion date: 2026-05-25
- Modified files:
  - `docs/simetrix/SIMetrix_simulation_speed_guide.md`
  - `tasks/in-progress.md`
  - `tasks/completed.md`
- Notes: 將 SIMetrix 指南從重複的長篇清單精簡成診斷流程、Convergence Dialog 使用時機、電路修改清單與最終驗證檢查。依 SIMetrix 官方文件補充 Iteration mode、Absolute current、Minimum time step、Slew rate for discontinuous sources、Shunt capacitance、Inductor loss TC 的適用與不適用情境。驗證通過 `npm run lint`、`npm run build`，並在瀏覽器確認 app 內指南頁已載入新版內容。

## 補齊 Choose Analysis 三張設定圖用法

- Completion date: 2026-05-25
- Modified files:
  - `docs/simetrix/SIMetrix_simulation_speed_guide.md`
  - `tasks/completed.md`
- Notes: 依使用者提供的三張圖片補上 `Choose Analysis > Options`、`Choose Analysis > Transient`、`Transient Advanced Options` 的設定說明。每個會影響速度、輸出資料量、收斂或 transient debug 的選項都加入使用時機與簡單例子，包含 tolerance、temperature、initial condition force resistance、data output、PRINT step、multi-step、snapshot、max/min timestep、Gear/Trapezoidal、Skip DC bias point、Fast start。驗證通過 `npm run lint` 與 `npm run build`。

## Fix RLC Iframe Route

- Completion date: 2026-05-25
- Modified files:
  - `backend/rlc_symbolic_solver/api.py`
  - `src/App.tsx`
  - `tasks/in-progress.md`
  - `tasks/completed.md`
- Notes: Fixed the RLC page nesting EE Tool inside the iframe by mounting the original solver web bundle explicitly at `/rlc-original/` and pointing the React iframe to the trailing-slash route. This prevents the SPA fallback from serving `dist/index.html` inside the iframe. Validation passed with `npm run build`, `.venv\Scripts\python.exe -m pytest -q backend\tests`, direct HTTP checks for `/rlc-original/`, and browser verification that the iframe contains `Netlist Solver` and not the Bootstrap page.

## 加入 Google Drive 分享服務上傳密碼

- Completion date: 2026-05-24
- Modified files:
  - `r2-file-share/.env.example`
  - `r2-file-share/src/config.js`
  - `r2-file-share/src/server.js`
  - `r2-file-share/public/index.html`
  - `r2-file-share/public/app.js`
  - `r2-file-share/README.md`
  - `tasks/in-progress.md`
  - `tasks/completed.md`
- Notes: Added required `UPLOAD_PASSWORD` protection before issuing Google Drive upload authorization. The frontend now asks for an upload password and sends it only to `/api/uploads/session`; invalid or missing passwords receive `401 Invalid upload password`. Updated README and `.env.example`. Validation passed with `npm run lint`, `npm test`, and `npm audit --omit=dev` inside `r2-file-share`.

## 將大檔案分享服務改為 Google Drive 版

- Completion date: 2026-05-24
- Modified files:
  - `r2-file-share/package.json`
  - `r2-file-share/package-lock.json`
  - `r2-file-share/.env.example`
  - `r2-file-share/render.yaml`
  - `r2-file-share/src/config.js`
  - `r2-file-share/src/server.js`
  - `r2-file-share/src/validation.js`
  - `r2-file-share/public/index.html`
  - `r2-file-share/public/app.js`
  - `r2-file-share/test/validation.test.js`
  - `r2-file-share/README.md`
  - `r2-file-share/docs/decisions/ADR-001-presigned-r2-direct-upload.md`
  - `tasks/in-progress.md`
  - `tasks/completed.md`
- Notes: Replaced the Cloudflare R2 presigned URL backend with Google Drive OAuth and resumable direct upload. Added `/auth/google`, `/oauth2callback`, `/api/uploads/session`, `/api/files/share`, and `/api/files/:file_id`; the browser now creates the Google Drive resumable session itself for CORS compatibility, uploads directly to Google Drive, and then requests an `anyone` + `reader` sharing link. Updated local and Render environment variable documentation. Validation passed with `npm run lint`, `npm test`, `npm audit --omit=dev`, and `node -e "import('./src/server.js').then(() => console.log('server module import ok'))"` inside `r2-file-share`.

## 建立 R2 大檔案臨時分享服務

- Completion date: 2026-05-24
- Modified files:
  - `r2-file-share/package.json`
  - `r2-file-share/package-lock.json`
  - `r2-file-share/.env.example`
  - `r2-file-share/render.yaml`
  - `r2-file-share/src/config.js`
  - `r2-file-share/src/server.js`
  - `r2-file-share/src/validation.js`
  - `r2-file-share/public/index.html`
  - `r2-file-share/public/styles.css`
  - `r2-file-share/public/app.js`
  - `r2-file-share/test/validation.test.js`
  - `r2-file-share/README.md`
  - `r2-file-share/docs/decisions/ADR-001-presigned-r2-direct-upload.md`
  - `tasks/in-progress.md`
  - `tasks/completed.md`
- Notes: Added an isolated Node.js + Express service that uses Cloudflare R2 S3-compatible presigned URLs for direct browser uploads and short-lived downloads. The frontend provides a Tailwind-based drag-and-drop upload UI, XMLHttpRequest percentage progress, generated share URLs, and one-click copy. Documented Render environment variables and R2 CORS. Validation passed with `npm run lint`, `npm test`, and `node -e "import('./src/server.js').then(() => console.log('server module import ok'))"` inside `r2-file-share`.

## 更新 GitHub 與 Render 部署

- Completion date: 2026-05-24
- Modified files:
  - `package.json`
  - `package-lock.json`
  - `README.md`
  - `docs/README.md`
  - `docs/simetrix/SIMetrix_simulation_speed_guide.md`
  - `src/App.tsx`
  - `src/styles.css`
  - `src/lib/verilogAModelLibrary.ts`
  - `src/lib/verilogAModelLibrary.test.ts`
  - `tasks/in-progress.md`
  - `tasks/completed.md`
- Notes: 將版本升級到 v0.4.0，準備提交並推送本機尚未同步到 GitHub/Render 的 SIMetrix 指南、Verilog-A 模型更新、RLC workbench 既有本機 commit 與文件整理。驗證通過 `npm run lint`、`npm run test`、`npm run build`。

## 將 SIMetrix 模擬速度指南加入側邊工具列

- Completion date: 2026-05-24
- Modified files:
  - `src/App.tsx`
  - `src/styles.css`
  - `README.md`
  - `tasks/in-progress.md`
  - `tasks/completed.md`
- Notes: 在左側工具選單新增 `SIMetrix 指南`，位置放在 `SIMetrix 腳本` 下方、`RLC 符號求解` 上方。頁面直接載入 `docs/simetrix/SIMetrix_simulation_speed_guide.md`，並將標題、段落、清單與表格轉成 app 內可讀版面。驗證通過 `npm run lint`、`npm run test`、`npm run build`，並用瀏覽器確認選單項目與指南內容可正常顯示。

## 安排 SIMetrix transient 模擬速度文件位置

- Completion date: 2026-05-24
- Modified files:
  - `docs/simetrix/SIMetrix_simulation_speed_guide.md`
  - `docs/README.md`
  - `README.md`
  - `tasks/in-progress.md`
  - `tasks/completed.md`
- Notes: 將根目錄的 SIMetrix transient 模擬速度優化手冊移到 `docs/simetrix/`，並新增 `docs/README.md` 與根目錄 README 的文件入口，讓後續 SIMetrix 操作手冊可以集中放在同一區。

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
