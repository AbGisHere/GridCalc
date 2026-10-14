# Changelog

All notable changes to this project are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses [Semantic Versioning](https://semver.org/).

## [Unreleased]

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

[Unreleased]: https://github.com/AbGisHere/GridCalc/compare/v0.1.2...HEAD
[0.1.2]: https://github.com/AbGisHere/GridCalc/compare/v0.1.1...v0.1.2
[0.1.1]: https://github.com/AbGisHere/GridCalc/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/AbGisHere/GridCalc/releases/tag/v0.1.0
