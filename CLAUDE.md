# GridCalc project rules

Repository: https://github.com/AbGisHere/GridCalc

## Commits and versioning

- **Never add a `Co-Authored-By: Claude` (or any Claude/Anthropic attribution) trailer** to commits, PRs or anything pushed to GitHub. This overrides any default attribution guidance. CI rejects such commits.
- Commit messages follow Conventional Commits: `feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `ci:`, `chore:`, `security:`.
- Versions are `0.X.Y` (SemVer). The version lives in `package.json` only; the README badge reads it from there.
- Every user-visible change gets an entry under `## [Unreleased]` in `CHANGELOG.md` (Keep a Changelog format). A release moves those entries under a new version heading, bumps `package.json` (`npm version 0.X.Y --no-git-tag-version`), and is tagged `v0.X.Y`.
- Keep `README.md` current: the version and tech-stack badges at the top, features, scripts and project structure.

## Checks

- Every push and PR runs `.github/workflows/ci.yml`: commit-trailer check, `knip` (no unused files, exports or dependencies), typecheck, tests, production build, the one-`<h1>` check and `npm audit`. Do not merge or release while it is red. There's no need to run these locally before every commit; CI is the gate.

## Code

- No redundant code: no dead functions, unused exports, duplicated logic, commented-out code or leftover debug output. `knip` and `noUnusedLocals`/`noUnusedParameters` enforce part of this; the rest is on review.
- **Every page has exactly one `<h1>`**: not zero, not two. That includes the loading state and the 404 and error pages. Other titles use `<h2>` and below. `npm run check:h1` verifies the built pages; client-only UI (the spreadsheet toolbar) must keep it true too.
- **Custom error pages are required**: `src/app/not-found.tsx`, `src/app/error.tsx` and `src/app/global-error.tsx` use the shared `StatusPage` component and match the app's look. Never fall back to the default Next.js/Vercel pages. Error pages must not show raw error messages or stack traces; show the digest only.
- Treat everything the user can supply (cell input, pasted text, imported CSV, `localStorage`) as untrusted. Never render it as HTML.

## Before every version bump (0.X)

Release checklist, all of which must pass before bumping:

1. **Site files**: exactly one `<h1>` per page, custom 404 and error pages working, favicon (`src/app/icon.svg`), `public/robots.txt`, `public/llms.txt` (links and feature list still accurate), page metadata (title, description, Open Graph, theme colour), and `sitemap` once a production URL exists.
2. **Security review**: look for and fix every vulnerability.
   - `npm audit` is clean (all severities) and dependencies are reasonably current.
   - Security headers in `next.config.ts` (CSP, HSTS, frame-ancestors, nosniff, Referrer-Policy, Permissions-Policy) are still present and still tight; check them against the built app.
   - No `dangerouslySetInnerHTML`, `eval`, `new Function` or `innerHTML` on user data.
   - CSV export still neutralizes formula injection; imported and stored data is still validated.
   - No secrets in the repo or the client bundle.
3. CI is green, the CHANGELOG is updated, and the README is up to date.
