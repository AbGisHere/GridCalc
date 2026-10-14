# Changelog

All notable changes to this project are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses [Semantic Versioning](https://semver.org/).

## [Unreleased]

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
