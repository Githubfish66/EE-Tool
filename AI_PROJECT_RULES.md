# AI Project Rules - EE Tool

## Project Summary

EE Tool is a React + TypeScript web tool for electrical engineering calculators.
The current implemented feature is a bootstrap capacitor calculator for
half-bridge and high-side gate-driver designs.

The app supports:

- TI Integrated calculation method
- onsemi AN-6076 calculation method
- Infineon Bootstrap Network Analysis calculation method
- Traditional Chinese / English UI
- Engineering unit selectors
- Formula trace with engineering-style MathML rendering
- Recommended capacitor specs with Digi-Key and Mouser search links

## Mandatory Session Rule

Every work session must start by reading this `AI_PROJECT_RULES.md` file before
implementation.

## Source References

- TI SLUA887A: https://www.ti.com/lit/an/slua887a/slua887a.pdf
- TI E2E LM5106: https://e2e.ti.com/support/power-management-group/power-management/f/power-management-forum/514747/bootstrap-capacitor-voltage-drop-lm5106
- onsemi AN-6076: https://www.onsemi.com/pub/collateral/an-6076.pdf
- Infineon Bootstrap Network Analysis: https://www.infineon.com/assets/row/public/documents/cross-divisions/42/infineon-bootstrap-network-analysis-applicationnotes-en.pdf

## Technology Stack

- React
- TypeScript
- Vite
- Vitest
- CSS
- No backend in the current version

## Project Structure

```text
<project-root>/
  AI_PROJECT_RULES.md
  README.md
  package.json
  index.html
  vite.config.ts
  tsconfig.json
  tsconfig.node.json
  src/
      App.tsx
      main.tsx
      mathml.d.ts
      styles.css
    lib/
      bootstrapCalculator.ts
      bootstrapCalculator.test.ts
      units.ts
```

## Feature Module Map

| Feature | Owner |
|---|---|
| Bootstrap formulas and warnings | `src/lib/bootstrapCalculator.ts` |
| Unit conversion and formatting | `src/lib/units.ts` |
| UI, language switch, unit selectors, formula rendering | `src/App.tsx` |
| Visual styling | `src/styles.css` |
| Calculation tests | `src/lib/bootstrapCalculator.test.ts` |

## Development Rules

- Keep vendor calculation methods separated. TI sources may be integrated only
  with other TI guidance.
- Use SI units internally. Convert UI values at the boundary.
- User-facing numeric inputs must provide engineering unit selection where useful.
- Input labels and formula symbols must stay consistent, such as `C_BOOT`,
  `Q_TOTAL`, `V_DD`, `R_BOOT`, and `f_SW`.
- Formula trace must use engineering-style rendering with fractions and
  subscripted symbols. Prefer browser-native MathML before adding dependencies.
- User-facing UI must support Traditional Chinese and English.
- Calculation output must be generated only after the user explicitly runs
  analysis. Parameter edits should not silently recompute final results.
- Digi-Key and Mouser live stock/pricing must not be fetched directly from the
  static frontend because API keys would be exposed. Use generated search links,
  or add a backend proxy in a future task.
- Formula changes must include tests for the affected method.
- Avoid broad refactors and unrelated file changes.

## Validation Commands

```bash
npm run test
npm run build
```

## Deployment Workflow

Deploy as a Render Static Site.

- Build command: `npm install && npm run build`
- Publish directory: `dist`
- Service type: Static Site

## Completion Checklist

- Calculation tests pass.
- Production build passes.
- UI still exposes all three methods.
- Language switch works for Traditional Chinese and English.
- Results are not shown until the user clicks the analysis/run button.
- Edited parameters mark existing results as stale until analysis is run again.
- Unit selectors preserve numeric meaning when changed.
- Input symbols and formula symbols remain consistent.
- Formula trace displays fractions and subscripts.
- Recommended capacitor specs and Digi-Key/Mouser search links are visible.
- Source references remain documented.
