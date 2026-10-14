# GridCalc

[![Version](https://img.shields.io/github/package-json/v/AbGisHere/GridCalc?label=version&color=blue)](CHANGELOG.md)
[![CI](https://github.com/AbGisHere/GridCalc/actions/workflows/ci.yml/badge.svg)](https://github.com/AbGisHere/GridCalc/actions/workflows/ci.yml)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)
![Next.js](https://img.shields.io/badge/Next.js-000000?logo=nextdotjs&logoColor=white)
![React](https://img.shields.io/badge/React-149ECA?logo=react&logoColor=white)
![Vitest](https://img.shields.io/badge/Vitest-6E9F18?logo=vitest&logoColor=white)
![GitHub Actions](https://img.shields.io/badge/GitHub_Actions-2088FF?logo=githubactions&logoColor=white)
![Vercel](https://img.shields.io/badge/Vercel-000000?logo=vercel&logoColor=white)

A spreadsheet web app built with **TypeScript, Next.js and React**. The formula engine is written from scratch: a hand-written lexer, a Pratt parser, a tree-walking evaluator, and a dependency graph that recalculates only the cells affected by a change. A custom virtualized grid serves a 100,000 × 100 sheet (10 million cells).

> GDG Tech Wildcard Entry: Spreadsheet Web Application (Frontend / Full-Stack, Advanced)

## Features

**Grid & editing**
- 10,000,000 addressable cells (100,000 rows × 100 columns) with custom virtualization. Only about 600 cells are mounted at any time, and scrolling runs at 60 fps.
- Click, drag or Shift+Arrow selection, plus whole-row, whole-column and select-all from the headers.
- Keyboard navigation: arrows, Tab, Enter, Home, Ctrl+Home/End, Page Up/Down, and Ctrl+Arrow to jump to the edge of the data.
- In-cell editing and a **formula bar** with syntax highlighting. Each colour-coded reference matches the border drawn around its cells in the grid.
- **Click cells while typing a formula** to insert references. Drag to insert a range.
- **Function autocomplete** and a signature hint that highlights the argument you are currently typing.
- **Drag-to-fill**: formulas are copied with relative references shifted, numeric series are continued, and numbered text counts up. Ctrl+D / Ctrl+R fill down / right.
- **Undo / redo** for every action, including fills, pastes and sheet loads.
- Copy, cut and paste. Pasting inside the sheet re-targets formula references, and tab-separated data pastes in from Excel or Google Sheets.
- Resizable columns, CSV import/export, and automatic saving to `localStorage`.

**Formula engine**
- **96 functions** including `SUM`, `IF`, `VLOOKUP`, `XLOOKUP`, `INDEX`/`MATCH`, `SUMIFS`, `COUNTIFS`, `TEXTJOIN` and `TEXT`. See [docs/FUNCTIONS.md](docs/FUNCTIONS.md) for the full list.
- Arithmetic, comparison, concatenation (`&`), percent and unary operators with spreadsheet precedence. Supports cell references (`A1`, `$A$1`, `A$1`), ranges, and arbitrarily nested expressions and function calls.
- Short-circuit evaluation for `IF`, `IFERROR`, `IFS`, `SWITCH` and `CHOOSE`.
- Wildcard (`*`, `?`) and comparison criteria (`">10"`, `"<>x"`) for the `*IF(S)` functions and lookups.

**Dependency tracking**
- A dependency graph with a spatial index for range references.
- **Incremental recalculation**: only the transitive dependents of an edit are re-evaluated, in topological order. The status bar shows the count and the time taken.
- **Circular references** (direct, indirect, or through ranges) are detected with Tarjan's SCC algorithm. They show `#CIRC!` and an explanation such as *"H5 → H6 → H5"*, and never cause an infinite loop or a crash.

**Error diagnostics**
- Every error explains itself in a panel showing the formula with a **caret under the problem**, a **suggestion**, and, where possible, a verified **one-click fix**.
- Live diagnostics appear while you type.
- Errors that flow in from other cells name their source and link to it.

```
Formula: =SUM(A1, B2
Error: Missing closing parenthesis.
=SUM(A1, B2
           ^
Suggestion: Add ')' at the end of the formula.
```

## Tech stack

| Layer | Tools |
| --- | --- |
| Language | TypeScript (strict) |
| Framework | Next.js (App Router), React |
| Formula engine | Hand-written lexer, Pratt parser and evaluator. No runtime dependencies besides React and Next.js |
| Testing | Vitest |
| Code quality | knip (unused code), `tsc --noEmit` |
| CI / security | GitHub Actions, `npm audit`, Dependabot, strict security headers (CSP, HSTS, frame-ancestors) |
| Hosting | Vercel |

## Getting started

Requirements: **Node.js 20+**.

```bash
npm install
npm run dev          # http://localhost:3000
```

| Script | What it does |
| --- | --- |
| `npm run dev` | Start the development server |
| `npm run build` | Production build (includes type checking) |
| `npm start` | Serve the production build |
| `npm test` | Run the unit tests (parser, evaluator, functions, dependency graph, fill, history) |
| `npm run typecheck` | TypeScript type check |
| `npm run knip` | Report unused files, exports and dependencies |
| `npm run docs:functions` | Regenerate `docs/FUNCTIONS.md` from the function registry |

On first load the app opens a **sample sheet** with working formulas and one example of each error type. Click the red cells to see their diagnostics. Use **10k-row stress test** in the toolbar to load 60,000 cells and 30,000 formulas.

## Deployment

The app is a standard Next.js project and deploys to **Vercel** with no configuration:

1. Push the repository to GitHub.
2. In Vercel, choose **Add New → Project**, then import the repository and click **Deploy**.

Or from the command line: `npx vercel`.

**Live demo:** _add your Vercel URL here_

## How it works

See **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)** for the full explanation. In short:

- **Parser.** A hand-written lexer feeds a Pratt parser that produces an AST. Every token keeps its source position, so each error reports exactly where it happened along with a targeted message. Suggested fixes are re-parsed before they are offered.
- **Evaluator.** A recursive interpreter over the AST with spreadsheet type coercion. Errors are ordinary values that carry the span of the sub-expression that caused them and the cell they originated from. Functions are declarative definitions in one registry, which also powers validation, autocomplete and the docs.
- **Dependency tracking.** Edges are stored from each input cell to the formulas that read it. Range references live in a 64-row-bucket spatial index instead of being expanded. An edit triggers a breadth-first search to find the affected cells, then Tarjan's SCC algorithm (iterative, so long chains can't overflow the stack) to order them topologically and detect cycles in the same pass.

## Project structure

```
src/
  app/                 Next.js App Router entry (layout, page, global styles)
  engine/              Framework-free calculation engine
    lexer.ts           Tokenizer with positions and typo diagnostics
    parser.ts          Pratt parser, validation, verified fix suggestions
    evaluator.ts       AST interpreter
    engine.ts          Cell store, dependency graph, incremental recalculation
    graph.ts           Range spatial index, iterative Tarjan SCC
    references.ts      Reference extraction, formula shifting for fill/paste
    functions/         96 functions, grouped by category
  components/          React UI: Grid (virtualized), FormulaBar, DiagnosticsPanel, ...
  state/               Undo/redo, drag-to-fill, selection, CSV, sample data
tests/                 Vitest unit tests
docs/                  FUNCTIONS.md (generated), ARCHITECTURE.md
public/                robots.txt, llms.txt
.github/               CI workflow, Dependabot
```

## Keyboard shortcuts

| Keys | Action |
| --- | --- |
| Arrows / Tab / Shift+Tab | Move |
| Shift + Arrows | Extend selection |
| Ctrl/⌘ + Arrows | Jump to edge of data |
| Enter / F2 / double-click | Edit cell |
| Any character | Start typing (replaces contents) |
| Enter / Tab (while editing) | Commit and move |
| Esc | Cancel edit |
| Delete / Backspace | Clear selection |
| Ctrl/⌘ + Z, Ctrl/⌘ + Y (or Shift+Z) | Undo, redo |
| Ctrl/⌘ + C / X / V | Copy, cut, paste |
| Ctrl/⌘ + D / R | Fill down / right |
| F9 | Recalculate everything (re-rolls `RAND`) |

## Changelog

See [CHANGELOG.md](CHANGELOG.md). Release rules and the pre-release checklist are in [CLAUDE.md](CLAUDE.md).
