# Changelog

All notable changes to this project are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses [Semantic Versioning](https://semver.org/).

## [Unreleased]

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
