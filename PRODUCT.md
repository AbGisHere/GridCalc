# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Technical reviewers evaluating GridCalc in a short demo. They have limited time and look for engineering depth: grid virtualization, the formula engine, dependency tracking, circular-reference detection and error diagnostics. Most will use a laptop or desktop with a keyboard, but some may open the live link on a phone.

## Product Purpose

GridCalc is a spreadsheet that runs entirely in the browser, with a formula engine written from scratch. Success means a reviewer can see, within the first minute, that the core requirements are met and exceeded, and can verify each one live instead of taking the README's word for it.

Core requirements it must visibly satisfy:

- A grid of at least 10,000 cells with virtualization; selection, editing, keyboard navigation, a formula bar, drag-to-fill and undo/redo.
- A custom parser and evaluator with at least 30 functions, including SUM, IF and VLOOKUP; expressions, references, ranges and nesting.
- Dependency tracking with partial recalculation, and circular-reference detection.
- Error diagnostics with a caret under the problem and a suggestion.

## Positioning

- **Self-explaining errors.** Every error shows the formula with a caret under the problem, a plain-language explanation, a suggestion and, where possible, a one-click fix that is re-parsed before it is offered. Errors that flow in from other cells name and link to their source.
- **Built from scratch.** Hand-written lexer, Pratt parser, tree-walking evaluator and dependency graph (iterative Tarjan SCC). The formula engine has no external runtime dependencies. The app uses React, Next.js and Vercel Web Analytics; no spreadsheet or formula library.
- **Visible engine.** The status bar shows how many cells an edit recalculated and how long it took, and how many cells are in the DOM out of 10,000,000 (the "DOM cells" counter), and the recalculated cells light up in dependency order after each edit, so a reviewer can watch virtualization and incremental recalculation working.
- **Local sheet data.** Sheet contents stay in `localStorage`. Vercel Web Analytics measures page visits without receiving cell contents or formulas.

## Operating Context

- Live at https://gridcalc.abgupta.me (Vercel); source at https://github.com/AbGisHere/GridCalc.
- A first visit opens on the sample sheet (working formulas and intentional error examples) with a dismissible guide that jumps directly to a fixable error or starts a blank sheet; later visits restore the sheet saved in this browser. Demos → Sample sheet loads it again.
- A "10k-row stress test" entry in the toolbar's Demos menu loads 60,000 cells and 30,000 formulas to demonstrate scale.
- Reviewers may read the README, `docs/ARCHITECTURE.md` and `docs/FUNCTIONS.md` alongside the app.

## Capabilities and Constraints

- 100,000 × 100 grid (10,000,000 addressable cells), about 600 mounted at a time.
- 96 functions; `SUM`, `IF`, `VLOOKUP`, `XLOOKUP`, `INDEX`/`MATCH`, `SUMIFS`, `TEXTJOIN` and `TEXT` among them.
- Formula bar with syntax highlighting, colour-matched reference borders, click-to-insert references, autocomplete and signature hints.
- Drag-to-fill, undo/redo for every action, copy/cut/paste with reference shifting, CSV import and values-only export, formula-preserving backup/restore, resizable columns, autosave. Backups preserve raw cell contents; restored columns fit their contents.
- Every page has exactly one `<h1>`. Custom 404 and error pages use the shared `StatusPage` component and never show raw errors.
- Strict security headers, including a Content-Security-Policy; no `dangerouslySetInnerHTML` or HTML rendering of user data. Any design change that needs a new external origin (fonts, images, scripts) must update the CSP deliberately.
- Every push to `main` is a versioned release (see `AGENTS.md`).
- Undecided: sharing a sheet by link (planned in `ROADMAP.md`, no version assigned).

## Brand Commitments

- Name: GridCalc. Favicon at `src/app/icon.svg`.
- Three themes: light, dark and semi (a dark interface around a white sheet). The app follows the system setting until the user picks one; the page metadata's theme colour follows the system setting.

## Evidence on Hand

- The live app, its sample sheet and stress test.
- `README.md`, `docs/ARCHITECTURE.md`, `docs/FUNCTIONS.md`, `CHANGELOG.md`, `ROADMAP.md`.
- 153 unit tests and green CI on every push.
- No users, testimonials, benchmarks against other products, or press exist. Do not invent any.

## Product Principles

1. **Proof over claims.** Every capability a reviewer cares about should be demonstrable in the live app within seconds, not only described in docs.
2. **Errors teach.** A failure state is a feature: it explains what went wrong, where, and how to fix it.
3. **Show the engine.** Make the invisible work (recalculation, dependencies, virtualization) observable without cluttering the sheet.
4. **Spreadsheet expectations first.** Keyboard behaviour, selection and editing match what Excel and Google Sheets users already know.
5. **Sheet contents stay in the browser.** No sheet backend; page-visit analytics must never receive cell contents or formulas.

## Accessibility & Inclusion

- WCAG 2.2 AA: contrast, visible focus, full keyboard operation, and accessible names for controls.
- Desktop first: keyboard-heavy work on a laptop or desktop is the main scene.
- Mobile must be good, not merely functional: reviewers may open the live link on a phone.
