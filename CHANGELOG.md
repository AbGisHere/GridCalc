# Changelog

All notable changes to this project are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses [Semantic Versioning](https://semver.org/).

## [Unreleased]

## [0.1.22] - 2026-10-14

### Fixed
- Screen readers now announce the status bar's messages, such as "Sheet cleared", import results and "Undid: …", through a live region. Before, they appeared on screen only.
- A message no longer disappears while the pointer is over it or the keyboard focus is on its **Undo** button, so the button can't vanish just as you reach it. After that **Undo**, focus returns to the sheet instead of being lost.
- A drag on the selection grip, fill handle, headers or a column edge now follows only the finger or pointer that started it. A second finger landing mid-drag used to take it over; now it's ignored.

### Changed
- A status message too long for the bar, such as one with a long file name, shows in full as a tooltip.
- Arabic and Hebrew text in a cell starts at the cell's right edge and reads right to left, as in other spreadsheets.

## [0.1.21] - 2026-10-14

### Changed
- In the **Semi** theme the column letters and row numbers are dark too, so only the cells are white.

## [0.1.20] - 2026-10-14

### Added
- Three themes: **Light**, **Dark** and **Semi**. Semi keeps the toolbar, formula bar and panels dark and the sheet itself white, the way it would print. Pick one in the new **Theme** menu next to Shortcuts, or at the bottom of the **Sheet** menu on a phone; each choice shows a small picture of the theme.
- Until you pick a theme, the app follows the system's light or dark setting, as before. The choice is saved in the browser under `gridcalc:theme`, and any other stored value is ignored.

### Changed
- The colour tokens are keyed on a `data-theme` attribute instead of the `prefers-color-scheme` media query. `public/theme.js`, a same-origin script in the page head, sets it before the first paint, so a saved theme never flashes the wrong one. The CSP is unchanged.
- The sheet sets its own text colour instead of inheriting it, which Semi needs for dark text on the white sheet.
- Buttons no longer show the browser's blue flash when tapped on a phone.

## [0.1.19] - 2026-10-14

### Changed
- CI runs only on pushes to `main`; pull requests no longer trigger it. The PR-only branches in the workflow are gone with the trigger.
- Vercel builds only `main`: `vercel.json` skips the build for every other branch, so pull requests get no preview deployment.

## [0.1.18] - 2026-10-14

### Fixed
- Function suggestions under the formula bar line up with the formula's text; they sat 16 px to the right. Their position now comes from the `--gutter` token instead of a fixed number.
- On the 404 and error pages, the error code (`#REF!`, `#ERROR!`) is red as intended; a more specific rule had turned it grey. The explanation under the formula wraps on a phone instead of being cut off mid-word.

### Changed
- On touch screens the suggestion list drops its keyboard hints (↑↓, Tab, Enter, Esc); a tap inserts a suggestion.

### Removed
- Class names that no style or script used (`muted`, `formula`, `fb-overlay-inner`, `diag-formula`), with the wrapper elements that only carried them.

## [0.1.17] - 2026-10-14

### Added
- Range selection by touch: a round grip on the selection's top-left corner, shown on touch screens, drags out a range. A swipe on the cells still scrolls the sheet.

### Changed
- On a phone, **Import CSV**, **Export CSV** and **Clear** are in one **Sheet** menu, each with a line saying what it does, so the toolbar fits on one row at 320 px. Menus on a phone open full-width under the toolbar.
- On touch screens of any width, toolbar buttons, the formula bar, the ƒx button and the close buttons are at least 44 px, and the error navigator and the status bar's **Undo** are 36 px tall. The status bar's **Undo** is 24 px tall everywhere, up from 22 px.
- The fill handle and the column edges have 44 px touch targets on touch screens.

### Fixed
- Drag-to-fill and column resizing work by touch; both were mouse-only. Grid drags use pointer events and end on release, cancel, or when the window loses focus.
- At 320 px the last toolbar button ran past the screen's edge, and the Demos menu could open partly off-screen.

## [0.1.16] - 2026-10-14

### Removed
- References to a specific event in the README and `PRODUCT.md`. The product brief now describes its audience as technical reviewers and its checklist as core requirements.

## [0.1.15] - 2026-10-14

### Fixed
- Cell references in the formula bar now have AA contrast in both themes. The eight reference colours are CSS tokens (`--ref-0` to `--ref-7`) with their own light and dark values, each at least 4.5:1. Before, one set was used for both themes and every colour failed in at least one of them (yellow was 2.9:1 in light, purple 3.3:1 in dark).
- `TRUE`, `FALSE` and error values in a formula use the theme's warning colour instead of a fixed orange that was 3.6:1 in dark mode.
- **Apply fix** and a fully selected column or row header use the page background for their text instead of white, which was 2.3:1 on the dark theme's green.

### Changed
- Selected text uses the accent green instead of the browser's default blue.

## [0.1.14] - 2026-10-14

### Changed
- A shorter toolbar: **Sample sheet** and **10k-row stress test** are now in one **Demos** menu, each with a line saying what it loads, and **Clear** sits on its own at the right. The **ƒ Functions** button is gone, because the **ƒx** button in the formula bar opens the same list (and now shows when it's open).
- Replacing the whole sheet (a demo, a CSV import or Clear) asks for no confirmation. Instead, the status bar shows an **Undo** button next to the message for 8 seconds, or until you make another edit.
- Undo, redo, import and export have drawn icons. On a phone they show only the icon (the label stays for screen readers), the shortcuts list is hidden, and the toolbar fits on one row instead of three.
- Long text no longer spills over the empty cells to its right; a cell never grows on its own. Instead, loading a sheet sizes each whole column to its longest value, so the sample sheet and the stress test show every value in full.
- Clear is disabled when the sheet is already empty.

## [0.1.13] - 2026-10-14

### Changed
- A type scale of four roles (11, 12, 13 and 14 px) as CSS tokens replaces the twelve one-off sizes (11.5, 12.5, 13.5 px and so on) used before.
- The engine metrics in the status bar have labels: **Recalc**, **DOM cells** and **Used**, each with its value in bold.
- On a phone the status bar wraps to two lines, so the Recalc and DOM cells metrics stay visible next to the error count. Before, everything but Recalc was hidden.
- The suggested fix's formula is the same size as the formula above it, and both sit in full-width bands that line up with the formula bar's text.

### Fixed
- Secondary text (`--muted`) now has AA contrast: 5.3:1 on white and 5.0:1 on the toolbar and status bar, up from 4.3:1 and 4.0:1. The separate header text colour it now matches is gone.
- On phones the formula bar, name box, cell editor and function search use 16 px text, so iOS Safari no longer zooms the page when you tap into them.

## [0.1.12] - 2026-10-14

### Added
- `ROADMAP.md`: multiple sheets with cross-sheet references in Excel's `Sheet!A1` syntax. Unknown sheet names get a caret and a "did you mean" fix, errors from other sheets link to their source, and loops across sheets are detected. Planned before share-by-link.

## [0.1.11] - 2026-10-14

### Added
- `ROADMAP.md`: double-clicking a column edge to auto-fit its width, as in Excel.

### Changed
- The diagnostics panel is docked at the bottom of the sheet, just above the status bar and its error count, instead of floating over the cells in the bottom-right corner. The sheet shrinks to make room, so nothing it shows moves or is covered, and the active cell is scrolled back into view if needed. On a phone the panel spans the full width.
- The panel's left column is exactly as wide as the name box and ƒx button, so the formula and its caret line up character for character under the formula bar's text. The colored left stripe is replaced by a tinted column holding the error code.
- Live diagnostics wait until you pause typing, and stay quiet while the autocomplete list is open. Typing `=SU` no longer flags `#NAME?` with a wrong "wrap it in quotes" fix. The last result stays up while you keep typing, so the panel doesn't flicker.

## [0.1.10] - 2026-10-14

### Added
- Advice for errors found while calculating: `#DIV/0!` and `#N/A` offer a one-click fix that wraps the formula in `IFERROR`, and `#VALUE!`, `#NUM!` and `#CIRC!` explain what to change. Errors passed on from another cell still point to their source instead.
- The status bar shows how many cells hold an error, with a **Next** button that selects the next one. F8 and Shift+F8 do the same from the keyboard. On a phone, where the example errors are off-screen, this is the way in.
- Long text spills over empty cells to its right instead of being cut off with an ellipsis, as in other spreadsheets.

### Changed
- The sample sheet lists the errors that have a one-click fix first (a typo in a function name, then a missing parenthesis), so the first red cell clicked shows the whole diagnosis. The hint above them reads "Click a red cell ↓" and fits its column, and labels that were cut off are shorter.

## [0.1.9] - 2026-10-14

### Added
- `PRODUCT.md`: who the app is for, what it must prove and the principles behind design decisions.
- Esc, then Tab, leaves the sheet, and F6 / Shift+F6 move focus between the toolbar, the formula bar and the sheet. Both are listed under Shortcuts.
- Screen readers hear the active cell, its value and its formula, or the selected range, as the selection moves. The sheet describes how to use and leave it.
- A visible focus ring on every button and control.

### Changed
- Tab no longer traps keyboard users inside the sheet: inside it Tab still moves one cell, as in other spreadsheets, but Esc then Tab now lets focus out.
- The sheet uses `role="application"` with a "spreadsheet" description instead of a `role="grid"` that had no rows or cells.
- Function autocomplete is a proper combobox: screen readers follow the highlighted suggestion.
- The Shortcuts popover closes on Esc (focus goes back to its button) or a click outside, instead of when the mouse leaves it, and fits on phone screens. The function list closes on Esc and returns focus to the sheet.
- The fill handle keeps its look but now has a 24 px pointer target.

### Fixed
- Autocomplete no longer runs off the right edge of the window when editing a cell near the last visible column.
- A drag (selection, fill or column resize) now ends if the window loses focus mid-drag, instead of following the pointer after you come back.
- CSV import refuses files over 20 MB instead of freezing the tab, reports files it can't read, and says when cells outside A1:CV100000 were left out.
- If autosave fails because storage is full or blocked, a message says so once instead of failing silently.
- Long status messages, such as an imported file's name, are cut off with an ellipsis instead of overflowing.

## [0.1.8] - 2026-10-14

### Changed
- Commit history renumbered so every push has its own version (0.1.2 to 0.1.7), with matching `package.json`, `package-lock.json`, CHANGELOG entry and tag. The first two commits use the `type(vX.Y.Z): message` format too.

### Fixed
- CI commit checks no longer fail on a force-push or a new branch, where the previous commit is not in the history. They check the whole history instead, and the commit range is worked out once instead of in each step.

## [0.1.7] - 2026-10-14

### Changed
- Every push to `main` is a release: `package.json`, `package-lock.json` and the CHANGELOG are bumped together and the commit is tagged. CI fails a push whose commit version, `package.json`, `package-lock.json` and latest CHANGELOG heading don't match.

## [0.1.6] - 2026-10-14

### Fixed
- Clicking a cell no longer selects everything from A1 to that cell. The drag loop started tracking the pointer from the top-left corner of the screen, so on its first frame it extended the selection to A1. This hit any click held longer than one frame, and column and row header clicks too.

## [0.1.5] - 2026-10-14

### Added
- `sitemap.xml`, a canonical URL and absolute Open Graph URLs for the production site, https://gridcalc.abgupta.me.
- Live demo link in the README and `llms.txt`.

### Changed
- `robots.txt` is generated from `src/app/robots.ts` and now points to the sitemap.

## [0.1.4] - 2026-10-14

### Added
- `ROADMAP.md` listing planned features, starting with sharing a sheet by link.

## [0.1.3] - 2026-10-14

### Fixed
- The CI workflow failed to parse because a step name contained `: `. The step name is now quoted.

## [0.1.2] - 2026-10-14

### Changed
- Commit subjects use the format `type(vX.Y.Z): message`, and CI enforces it.

## [0.1.1] - 2026-10-14

### Added
- Custom 404 and error pages (`not-found`, `error`, `global-error`) in the style of the app's error diagnostics, replacing the default Next.js/Vercel pages. They show an error digest, never raw messages or stack traces.
- `npm run check:h1`, which runs in CI and fails unless every built page has exactly one `<h1>`.

### Fixed
- Every page now has exactly one `<h1>`. Before this, no page had one. The brand name in the toolbar and the loading screen is the `<h1>`, and on narrow screens it is visually hidden instead of removed, so it stays in the accessibility tree.

## [0.1.0] - 2026-10-14

First public release.

### Added
- Virtualized 100,000 × 100 grid with selection, keyboard navigation, in-cell editing and resizable columns.
- Formula engine written from scratch: lexer, Pratt parser and tree-walking evaluator with 96 functions.
- Dependency graph with incremental recalculation and circular-reference detection (Tarjan's SCC).
- Self-explaining errors with a caret under the problem, suggestions and verified one-click fixes.
- Formula bar with syntax highlighting, click-to-insert references, function autocomplete and signature hints.
- Drag-to-fill, undo/redo, copy/cut/paste with reference shifting, CSV import/export and automatic saving.
- `robots.txt`, `llms.txt`, Open Graph metadata and light/dark theme colour.
- CI on every push and PR: commit-trailer check, unused-code check (knip), typecheck, tests, build and `npm audit`. Dependabot for npm and GitHub Actions.

### Security
- Security headers on every response: Content-Security-Policy, HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy and Cross-Origin-Opener-Policy. The `X-Powered-By` header is removed.
- CSV export neutralizes text that other spreadsheet apps would run as a formula (CSV injection).
- Sheet data and column widths loaded from `localStorage` are validated before use.

[Unreleased]: https://github.com/AbGisHere/GridCalc/compare/v0.1.8...HEAD
[0.1.8]: https://github.com/AbGisHere/GridCalc/compare/v0.1.7...v0.1.8
[0.1.7]: https://github.com/AbGisHere/GridCalc/compare/v0.1.6...v0.1.7
[0.1.6]: https://github.com/AbGisHere/GridCalc/compare/v0.1.5...v0.1.6
[0.1.5]: https://github.com/AbGisHere/GridCalc/compare/v0.1.4...v0.1.5
[0.1.4]: https://github.com/AbGisHere/GridCalc/compare/v0.1.3...v0.1.4
[0.1.3]: https://github.com/AbGisHere/GridCalc/compare/v0.1.2...v0.1.3
[0.1.2]: https://github.com/AbGisHere/GridCalc/compare/v0.1.1...v0.1.2
[0.1.1]: https://github.com/AbGisHere/GridCalc/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/AbGisHere/GridCalc/releases/tag/v0.1.0
