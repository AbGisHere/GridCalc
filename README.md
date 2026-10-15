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

**[Live demo →](https://gridcalc.abgupta.me)**

Sheet contents and formulas stay in your browser. Vercel Web Analytics measures page visits; no sheet data is sent to analytics.

For Vercel deployments, enable **Web Analytics** in the project's Vercel dashboard, then deploy. The root layout includes `@vercel/analytics/next` in production; analytics uses same-origin insights routes allowed by the existing Content Security Policy. Development visits are not tracked.

## Features

**Grid & editing**
- 10,000,000 addressable cells (100,000 rows × 100 columns) with custom virtualization. Only about 600 cells are mounted at any time, and scrolling runs at 60 fps.
- Click, drag or Shift+Arrow selection, plus whole-row, whole-column and select-all from the headers.
- Keyboard navigation: arrows, Tab, Enter, Home, Ctrl+Home/End, Page Up/Down, and Ctrl+Arrow to jump to the edge of the data.
- In-cell editing and a **formula bar** with syntax highlighting. Each colour-coded reference matches the border drawn around its cells in the grid, with a separate set of reference colours for the light and dark themes so the text stays readable (at least 4.5:1) in both.
- **Click cells while typing a formula** to insert references. Drag to insert a range.
- **Function autocomplete** and a signature hint that highlights the argument you are currently typing. Suggestions fit beside the name box on narrow screens; long signatures and examples wrap within the function reference panel. Choosing a function on a narrow screen closes the reference and focuses the formula bar so editing stays visible.
- **Drag-to-fill**: formulas are copied with relative references shifted, numeric series are continued, and numbered text counts up. Ctrl+D / Ctrl+R fill down / right.
- Fill ranges are limited to 250,000 cells per operation, with a recovery message for larger selections. Unchanged destinations do not allocate edits or add undo history.
- **Undo / redo** for every action, including fills, pastes and sheet loads. Replacing the whole sheet (a demo, a CSV import, a restore or Clear) puts an **Undo** button next to its message in the status bar, so there is no confirmation dialog. **Sheet → Previous sheet** brings the replaced sheet back, even after a reload.
- Copy, cut and paste. Pasting inside the sheet re-targets formula references, and tab-separated data pastes in from Excel or Google Sheets.
- Resizable columns by dragging or entering a width in the **Sheet** menu, which groups backup/restore and CSV import/export, then the column width, then **Clear N cells** on its own in the error colour. Automatic saving to `localStorage` shows Saved in this browser (Saved on a phone), Saving, or a persistent Not saved state; only a failed save is announced to screen readers. It shows with a visible storage explanation and a **Download backup** action that preserves formulas. CSV export includes calculated values, not formulas. Loading a sheet sizes each whole column to its longest value, so nothing starts cut off.
- **Works by touch**: on a phone or tablet, a swipe scrolls the sheet, the round grip on the selection's top-left corner drags out a range, the fill handle and column edges drag with a finger, and every control has a tap area of at least 44 px. On phones narrower than 390 px the status bar shortens 10,000,000 to 10M so the engine metrics still fit. On a phone the theme and help share a **⋯** menu, and below 390 px the menu chevrons go, so the toolbar fits on one row down to 320 px.
- **Editing on a phone or tablet**: tap a cell to select, then edit its contents in the formula bar, or double-tap to start there. Visible **Apply** and **Cancel** controls finish the edit without keyboard shortcuts. The workspace responds to the software keyboard, menus and suggestions scroll within the available height, and controls stay clear of screen cutouts.
- **Three themes**: Light, Dark, and **Semi**, a dark interface (column letters and row numbers included) around white cells, so the sheet looks the way it would print. **System**, the default, follows the device's light or dark setting, including changes while the page is open. Pick one in the **Theme** menu (the **⋯** menu on a phone); the choice is saved in the browser and applied before the first paint, so there is no flash.
- A status bar that shows the engine at work: how many cells the last edit recalculated and how long it took (the **Recalc** metric pulses with each recalculation, and status messages use the same timing), and how many cells are in the DOM out of 10,000,000. The **?** beside the metrics explains each one. Every edit, undo and redo also gets a short message such as *"Edit B2: 10,008 formulas recalculated in 17.3 ms"*, shown beside the selection's Sum, Average and Count rather than in place of them. Committing a formula that errors says so instead (*"J20 has a formula error: Missing closing parenthesis."*) with a **Show** button that opens its diagnosis.
- The status bar wraps its feedback and Engine group as space narrows. Numeric selections lead with Sum, Average and Count; **More stats** reveals Min and Max.
- A **recalculation wave**: after an edit, the recalculated cells light up one dependency level after another, so you can see which cells depended on it. With reduce-motion on it's a single gentle fade, and the copied range's marching ants stand still.
- Color reinforces the workspace hierarchy across all three themes: green for selection and save state, blue engine labels, and red errors with tinted cells. Status text and error codes remain visible alongside color.
- Custom 404 and error pages styled like the app's own error diagnostics.
- IME composition keeps candidate navigation and confirmation inside both cell editors. Column widths stay between 36 and 2,000 px when resized or restored, with the accepted range shown beside the width field; hiding diagnostics returns keyboard focus to the sheet.
- **Opens on the sample sheet** on a first visit, so the engine and its error diagnostics show straight away (**Start blank** in its guide empties it); later visits restore the sheet saved in this browser. Open **Demos → Sample sheet** for working formulas and intentional errors, or **Demos → 10k-row stress test** for 60,000 cells and 30,000 formulas. Each demo has a dismissible guide: **Try a fix** (or press F8; on touch screens the guide says to tap a red cell, and screen readers hear it on load), load 10k rows or start blank, or compare recalculation at B2 and B10001. **Demos → Show the demo guide** reopens it. Both the guide and Demos menu explain before loading that a demo replaces the sheet, and that **Sheet → Previous sheet** brings it back.
- Toolbar popups dismiss when keyboard focus leaves them; function search keeps a visible focus ring, and editing and panel controls provide hover feedback.
- Keyboard focus outlines the sheet viewport separately from the selected cell, so a selected cell does not imply that keyboard input is still directed to the grid.
- **Help & shortcuts** explains touch editing, range selection and fill as well as keyboard commands. On narrow or zoomed layouts it moves into the **⋯** menu instead of disappearing.
- **Keyboard and screen-reader access**: Esc then Tab leaves the sheet, F6 moves between the toolbar, formula bar and sheet, the active cell and its value are announced, status messages such as "Sheet cleared" are read out and stay up while you hover or focus them, an error cell is read with its one-line explanation, the toolbar, formula bar, sheet, diagnostics and status bar are each a landmark, autocomplete is a proper combobox, and every control shows a visible focus ring.

**Formula engine**
- Browse function signatures and descriptions without editing the sheet (**Shift+F3**, as in Excel, or the ƒx button). Each compact row inserts its function, the list is one Tab stop with arrow-key movement, category buttons jump to Math, Lookup, Text and the rest, the focused function's example shows at the bottom, and the panel names the destination cell.
- **96 functions** including `SUM`, `IF`, `VLOOKUP`, `XLOOKUP`, `INDEX`/`MATCH`, `SUMIFS`, `COUNTIFS`, `TEXTJOIN` and `TEXT`. See [docs/FUNCTIONS.md](docs/FUNCTIONS.md) for the full list.
- Arithmetic, comparison, concatenation (`&`), percent and unary operators with spreadsheet precedence. Supports cell references (`A1`, `$A$1`, `A$1`), ranges, and arbitrarily nested expressions and function calls.
- Short-circuit evaluation for `IF`, `IFERROR`, `IFS`, `SWITCH` and `CHOOSE`.
- Wildcard (`*`, `?`) and comparison criteria (`">10"`, `"<>x"`) for the `*IF(S)` functions and lookups.

**Dependency tracking**
- A dependency graph with a spatial index for range references.
- **Incremental recalculation**: only the transitive dependents of an edit are re-evaluated, in topological order. The status bar shows the count and the time taken.
- **Circular references** (direct, indirect, or through ranges) are detected with Tarjan's SCC algorithm. They show `#CIRC!` and an explanation such as *"H5 → H6 → H5"* whose cells are links, the loop is outlined on the grid, and they never cause an infinite loop or a crash. The **Circular** metric counts the cells in loops across the sheet.

**Error diagnostics**
- Every error explains itself in a panel showing the formula with a **caret under the problem**, a **suggestion**, and, where possible, a verified **one-click fix** labelled **Fixed formula**.
- Calculation errors get advice too: `#DIV/0!` and `#N/A` offer a one-click `IFERROR` wrap, and `#VALUE!`, `#NUM!` and `#CIRC!` explain what to change.
- Diagnostics dock below the sheet, above the error count, with the formula lined up under the formula bar's text. They never cover cells, and opening them doesn't move the sheet.
- Live diagnostics appear once you pause typing, and not while the autocomplete is open, so a half-typed name isn't flagged.
- Errors that flow in from other cells name their source and link to it.
- The status bar counts the sheet's errors; **Next** (or F8 / Shift+F8) jumps from one to the next, so they're easy to reach on a phone too. **Ctrl/⌘ + .** applies the suggested fix, and the status bar then says how many errors are left.
- Committing a formula that doesn't parse keeps the selection on it, as Excel does, so its diagnosis opens in place.

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
| Formula engine | Hand-written lexer, Pratt parser and evaluator with no external runtime dependencies |
| Analytics | Vercel Web Analytics for production page visits; sheet data stays local |
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
| `npm run check:h1` | Check that every built page has exactly one `<h1>` (run after `build`) |
| `npm run docs:functions` | Regenerate `docs/FUNCTIONS.md` from the function registry |

## Backups and CSV

Use **Sheet → Download backup** to save cell contents and formulas as a `.gridcalc.json` file on your device, including any current edit. Use **Sheet → Restore backup** to replace the sheet with that file; Undo, or **Sheet → Previous sheet** after a reload, brings the replaced sheet back. Restored columns are fitted to their contents. Backup files preserve raw cells rather than undo history, theme or column widths.

Backups use a versioned format and a 20 MB limit. Restore validates the whole file before changing the sheet and rejects invalid addresses, non-text cell data or unsupported versions. If the sheet changes while the file is opening, restore stops so newer work is preserved. All processing stays on your device.

**Export values as CSV** produces calculated values for other spreadsheet apps. It omits formulas; use a GridCalc backup to preserve formula work.

## Demos

First-time visitors start on the **Sample sheet**, so the formula engine and its error diagnostics are visible straight away; its guide's **Start blank** button empties the sheet. Later visits restore the sheet saved in this browser. Open **Demos** in the toolbar to load an example:

| Demo | What to try |
| --- | --- |
| **Sample sheet** | Working formulas and intentional errors. Choose **Try a fix**, click a red cell or press **Next** in the status bar to see an explanation and suggested repair. |
| **10k-row stress test** | About 60,000 cells and 30,000 formulas. Use the guide's jump buttons to edit **B2**, then **B10001**, and compare the **Recalc** counter for a long dependency chain versus its end. |

Loading a demo replaces the current sheet; **Undo**, or **Sheet → Previous sheet** after a reload, brings it back. The demo guide can be dismissed. To return to a blank sheet, choose **Start blank** in the guide or **Sheet → Clear**.

## Deployment

The app is a standard Next.js project and deploys to **Vercel**. `vercel.json` builds only the `main` branch, so other branches and pull requests get no preview deployment:

1. Push the repository to GitHub.
2. In Vercel, choose **Add New → Project**, then import the repository and click **Deploy**.

Or from the command line: `npx vercel`.

**Live demo:** https://gridcalc.abgupta.me

## How it works

See **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)** for the full explanation. In short:

- **Parser.** A hand-written lexer feeds a Pratt parser that produces an AST. Every token keeps its source position, so each error reports exactly where it happened along with a targeted message. Suggested fixes are re-parsed before they are offered.
- **Evaluator.** A recursive interpreter over the AST with spreadsheet type coercion. Errors are ordinary values that carry the span of the sub-expression that caused them and the cell they originated from. Functions are declarative definitions in one registry, which also powers validation, autocomplete and the docs.
- **Dependency tracking.** Edges are stored from each input cell to the formulas that read it. Range references live in a 64-row-bucket spatial index instead of being expanded. An edit triggers a breadth-first search to find the affected cells, then Tarjan's SCC algorithm (iterative, so long chains can't overflow the stack) to order them topologically and detect cycles in the same pass.

## Project structure

```
src/
  app/                 Next.js App Router entry (layout, page, 404/error pages, robots, sitemap, styles)
  engine/              Framework-free calculation engine
    lexer.ts           Tokenizer with positions and typo diagnostics
    parser.ts          Pratt parser, validation, verified fix suggestions
    evaluator.ts       AST interpreter
    engine.ts          Cell store, dependency graph, incremental recalculation
    graph.ts           Range spatial index, iterative Tarjan SCC
    references.ts      Reference extraction, formula shifting for fill/paste
    functions/         96 functions, grouped by category
  components/          React UI: Grid (virtualized), FormulaBar, DiagnosticsPanel, ...
  state/               Undo/redo, drag-to-fill, selection, CSV, backups, sample data
tests/                 Vitest unit tests
docs/                  FUNCTIONS.md (generated), ARCHITECTURE.md
public/                llms.txt, theme.js (applies the saved theme before the first paint)
.github/               CI workflow (runs on pushes to main only), Dependabot
vercel.json            Deploys main only
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
| F8 / Shift + F8 | Next / previous error |
| Ctrl/⌘ + . | Apply the suggested fix |
| F9 | Recalculate everything (re-rolls `RAND`) |
| Shift + F3 | Open or close the function list |
| Esc, then Tab | Leave the sheet |
| F6 / Shift + F6 | Move between toolbar, formula bar and sheet |

## Roadmap

Planned features, including multiple sheets with cross-sheet references and sharing a sheet by link, are in [ROADMAP.md](ROADMAP.md). [PRODUCT.md](PRODUCT.md) records who the app is for, what it must prove and the principles behind design decisions.

## Changelog

See [CHANGELOG.md](CHANGELOG.md). Every push to `main` is a tagged release (`v0.X.Y`): the version in `package.json`, `package-lock.json` and the CHANGELOG is bumped together, and CI checks that they match. Release rules, the pre-release checklist and the rules for coding agents (Codex, Claude Code and others) are in [AGENTS.md](AGENTS.md).
