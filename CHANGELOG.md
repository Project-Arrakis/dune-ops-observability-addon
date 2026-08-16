# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Fixed
- **`enforce_admins` was `false` on `main`'s branch protection, meaning
  required status checks did not actually apply to admin/owner direct
  pushes.** `docs/BRANCH-PROTECTION.md`/`docs/GITHUB-RULESETS.md`
  previously and incorrectly claimed "direct pushes remain possible for
  the maintainer, gated only by required status checks" — per GitHub's
  own documentation, admin permissions bypass ALL branch protection
  restrictions, including required status checks, unless
  `enforce_admins` is explicitly enabled. This is exactly how the
  `containerHealth` revert commit (`22ad998`, below) landed on `main`
  while failing 4 of 7 required checks. Both docs corrected;
  `enforce_admins` flipped to `true` on this repo and, since the same
  misconfiguration was independently confirmed on this account's other
  three repos, on `acp-landing`, `Arrakis-Control-Panel`, and
  `dune-awakening-selfhost-docker` as well. See issue #85.
- **Critical: addon was completely non-functional due to stale Subresource
  Integrity (SRI) hashes.** `web/index.html`'s `<script integrity="sha384-...">`
  attributes for `data-providers.js` and `addon.js` had drifted from those
  files' real content across 9 commits (the `containerHealth`/NOC-Infra
  feature branch and its subsequent revert), starting immediately after
  the last correct SRI regeneration in `43f50b1`. Because SRI failures are
  enforced silently by the browser (no console error visible to a typical
  operator, the script simply never executes), this left every tab
  unresponsive and no data provider loaded, for every operator who
  installed the addon in this state. See GitHub issue #119 for the full
  root-cause writeup.
- **Incomplete revert of the `containerHealth`/NOC Infra feature.** Commit
  `22ad998` ("revert: remove containerHealth feature — broken tabs") left
  `getContainerHealth()` live in `web/data-providers.js` and the NOC Infra
  tab's live-data markup in `web/index.html`, causing `npm test` to report
  56/57 (a README/bridge-action-drift failure) instead of the claimed
  57/57. Finished the revert: `noc-infra` is back to its original Phase 0
  "Planned — requires Core R3" placeholder state in code, markup, and
  provider wiring. See GitHub issue #120.
- **`pre-commit` had been red on every push to `main`** since before
  either of the above two fixes existed, for reasons entirely unrelated
  to them (a `trailing-whitespace` hook stripping intentional Markdown
  hard-breaks, and a genuine extra trailing newline in `web/addon.css`) —
  meaning the required `pre-commit` CI check had provided zero real
  signal for some time. See GitHub issue #123.
- **Root cause of the original `containerHealth` breakage, established
  2026-08-16**: not a defect in this addon at all — a one-line logic
  error in `dune-awakening-selfhost-docker`'s bridge-route dispatcher
  (missing `if (`, commit `7ea2011f` in that repo) caused an
  action-fallthrough bug where unmatched bridge actions silently
  returned container-health data instead of their own. That bug was
  fixed upstream before this repo's own revert landed, unnoticed. Full
  incident detail: `compliance/eight-hats-findings-register-2026-08-16.md`.
- **Corrected a stale, inaccurate claim in the `[0.5.1]` entry below.**
  "All 57 tests pass. No regressions." was true when written (2026-08-08,
  before the `containerHealth` feature branch merged later that same
  day) but had been false since (`npm test` reported 56/57 until the
  fix above). Per this project's own documentation-currency discipline,
  corrected here rather than silently left stale. The `containerHealth`
  feature itself was also merged directly to `main` with no PR (branch
  protection does not cover repo-admin pushes, tracked as issue #85).
- `docs/design/metrics-l1-design-audit-2026-08-08.md`'s 11→14-tab
  expansion plan (AAA/NOC Infra/Audit tabs) is formally superseded by a
  narrower scope-reduction recommendation — see the same findings
  register above for the full rationale.

### Added
- `scripts/check-sri-integrity.js` — governance check (wired into
  `npm test` via `test/governance.test.js`, CI, and pre-commit) that fails
  if any `<script integrity="sha384-...">` hash in `web/index.html` ever
  stops matching the real, current content of the file it references.
  Same drift-detection discipline already used for the README/bridge-action
  and version-consistency checkers, applied to SRI hashes specifically
  because hand-maintaining them is what caused this incident.
- `scripts/update-sri.js` — regenerates `web/index.html`'s SRI hashes and
  cache-buster query strings from the real, current content of every
  referenced script, so these never need to be computed by hand again.
- `compliance/eight-hats-findings-register-2026-08-16.md` — full findings
  from a 2026-08-16 Eight Hats scope/UX review (3 Critical, 6 High, 5
  Medium), prompted by a "world-class metrics board" feature request.

## [0.5.1] - 2026-08-10

### Added (2026-08-08)
- **L1 Design Audit — AAA/NOC/SOC metrics architecture.** 31 metric gaps
  documented across AAA (11), NOC (10), SOC (10). 14-tab architecture designed
  with 3 new tabs (AAA/Auth, NOC Infra, Audit Log). Tab-aware lazy loading
  with 60s cache. Phase plan: 6 phases over ~8 weeks. DBA: 3 new Postgres
  tables, 6 partial indexes, additive only. See `docs/design/metrics-l1-design-audit-2026-08-08.md`.
- **Phase 0: Tab-aware lazy loading.** `refreshAll()` restructured so the
  active tab dispatches only its providers (2-5 calls vs all 9). 60s in-memory
  cache per source. `_tabCache` Map + `_tabProviders` config. Backward-compatible —
  initial load still populates all tabs.
- **Placeholder tabs** (AAA, NOC Infra, Audit Log) with design-document links
  and "Requires Core R3" copy. Cool-blue accent styling for infra tabs distinct
  from amber game-operational tabs.
- **NOC Overview system service health table** (PROMPT-09). Split into System
  Services (Prometheus-fed: 6 targets) + Bridge & Data Sources. CTA message
  when metrics stack isn't running.
- **Live NOC resource gauges.** CPU/Memory/Disk/Uptime wired from Prometheus
  bridge data when metrics stack is running. Falls back to "—" when unavailable.
- **Freshness badges** on every panel header. Green (<60s), amber (<5m), red (>5m).
  `updateFreshnessBadges()` call at end of each refresh cycle.
- **Known-gap tooltips** on PvP Deaths, Total Crafted, Restarts (24h) metrics.
- **Preview mode warning** wired to show/hide based on active provider.
- **Bridge-action drift check** added to pre-commit hooks.

### Changed
- All 57 tests pass. No regressions. **(True as of this entry's own
  commit only — see the `[Unreleased]` entry above: this stopped being
  true later the same day and was not corrected until 2026-08-16.)**
- **Complete in-game Dune Awakening aesthetic redesign (v0.5).** Sand-toned
  elevation surface system, warm amber/bronze default palette (replacing purple),
  game-style tab navigation with accent underlines, metric card glow effects,
  horizontal grain texture overlay, status beacon dots, graduated card shadows,
  improved table zebra/hover states, tab fade-in animation. Default faction
  theme now matches the game's desert aesthetic: Amber + Flat 2.0 + Border
  Pattern + Glowing Edges + Metal Border + Stone textures. Harkonnen spice
  colors harmonized with faction palette (red instead of purple).
- **Availability notes redesigned.** Replaced dashed pink `⚠` icon with solid
  amber `⊗` icon and amber left-border accent. Text contrast improved for
  readability on dark backgrounds.

### Security
- **Removed hardcoded public IP** from `scripts/deploy/deploy-lib.sh` (was
  `50.123.64.61`). Script now requires explicit `SERVER_IP` export or exits
  with an error (M-2, from 8-hats review).
- **Scoped gitleaks `gho_` allowlist** from global regex to per-rule path scope
  (only placeable-cache + augment-cache paths). Previously any `gho_` token
  committed anywhere in the repo was silently ignored (M-6).
- **Added data-classification note to Diag tab.** Warning that diagnostic
  output may contain raw bridge data — do not share screenshots (L-6).

### Documentation
- **Eight-hats findings register** created at `compliance/eight-hats-findings-register.md`
  covering all 25 findings (2 HIGH, 8 MEDIUM, 15 LOW) plus AAA/NOC/SOC metrics
  gap analysis (31 specific metrics missing across game ops, NOC, and SOC domains).
- **Six Sonnet 5 implementation prompts** created at `prompts/` covering
  architecture, security, GRC, AAA metrics, NOC metrics, and SOC metrics.
- Fixed stale checkout path in repository docs (L-9).

### Fixed
- **CI: `npm audit` high-severity `undici` advisory is now resolved.** The
  transitive `undici@7.28.0` (via devDependency `jsdom`) failed `npm audit
  --audit-level=moderate` on every push, which cascaded into the CI Gate
  failing on `main`. Added an `overrides` pin to the patched `undici@7.29.0`
  (same major, advisory-fixed), leaving the installed dependency tree
  otherwise unchanged.

## [0.4.6] - 2026-07-24

### Removed
- **Players tab — KPI Capability panel**: removed entirely. This panel showed cross-tab data-source health (Combat, Economy, Inventory, SOC, Metrics) on the Players tab specifically — none of which is Players data. Each tab already surfaces its own unavailability directly, exactly when and where it's relevant; this panel was a redundant, misplaced second path to the same information, always visible whether or not anything was actually wrong.

## [0.4.5] - 2026-07-24

### Changed
- **Rewrote every tab's heading text** (eyebrow + section title + provider-label) addon-wide — most previously communicated little beyond internal-engineering jargon (e.g. "KPI Capability", "Read-only support map") without reading the paragraph below them. Removed 11 stale version-tag eyebrows (leftover feature-milestone numbers like "v0.7.0"/"v1.0.0" that didn't correspond to this addon's real version). Provider-labels that showed a raw bridge action name now lead with plain-English framing ("Live · ops.economy.summary") while keeping the exact action name visible.
- **Location tab**: copy now states plainly that per-player location tracking is permanently out of scope by design, rather than describing a feature that will never exist.
- **Combat tab**: copy now discloses that PvP/PvE death classification is not yet available and all deaths currently report as PvE — a known limitation, not a silent gap.
- Added a missing explanatory paragraph to the Players tab's "Player & Farm Totals" section (previously the only section in the addon with no such explanation at all).

### Fixed
- **Inventory tab — Total Crafted false-zero**: this stat rendered a fabricated `0` for a field that has no real data source anywhere in Core's schema (Core always returns `totalCrafted: null`, by design, never estimated). Now correctly shows as unavailable ("—") instead of a misleading zero whenever the rest of the inventory source is genuinely live.

## [0.4.4] - 2026-07-24

### Changed
- **Visual redesign — Players and Spice Melange tabs**: addressed the addon's flat, unpolished visual system with a real design-token system (elevation/shadow tokens, a proper type scale), the branded "Dune Rise" display font applied to every heading (previously used in exactly one place), differentiated card treatments with real hover states (metric/capability/kpi cards were previously visually identical), the addon's first icons anywhere (checkmark/exclamation/x on capability-status pills, crossed-swords/shield on PvP/PvE combat badges), real tinted backgrounds on status pills, and zebra-striped/hoverable tables.
- **Players tab**: replaced internal ticket-ID eyebrow labels ("A3"/"A4"/"A5") with real, human-readable labels; removed a stale version reference in the KPI Panels copy; gave the OPS Health Aggregate row more visual weight.
- **Spice Melange tab**: added a real, derived instance-count badge next to each map section's heading ("2 instances"/"1 instance"); instance/sietch cards now have real elevation, hover lift, and a colored glow-ring on hover matching their real PvP/PvE state; removed 3 redundant inline color styles already covered by an existing CSS rule.

## [0.4.3] - 2026-07-24

### Fixed
- **Players tab — KPI Capability panel**: was 7 cards of entirely static HTML, all hardcoded "supported" regardless of real bridge state (confirmed zero JS ever touched this panel). Removed the permanently-false "Location & Territory" row (Location is closed out-of-scope by owner decision) and made the remaining panel dynamic — each capability's status is now computed fresh every refresh from the real status of the data sources it depends on, using a new `data-capability-sources` attribute and `renderCapabilities()`. Capabilities backed by more than one source (e.g. Population & Activity) can now show a "partial" state when only some of their sources are live. Added SOC and Metrics (Prometheus) rows, which previously had no row at all.
- **Spice Melange tab — combat-state coloring, labeling, and column corrections** (follow-up to the 0.4.2 Deep Desert/Hagga Basin rework): each instance/sietch card is now visually accented (border + name color) by its real combat state — red for PvP, green for PvE. Removed the per-size "amount" column from each instance's size-breakdown table entirely (it previously showed a permanent dash; there is no real per-size spice figure in the schema, so the column is now omitted rather than dashed). Renamed the one real, instance/sietch-level spice total from "Remaining Spice" to "Potential Spice" (with an explanatory tooltip) — the old name implied a precision/permanence guarantee this live, point-in-time snapshot can't honestly make.
- **Pipeline**: fixed a pre-push hook bug where `ggshield secret scan pre-push` legitimately printing "Skipping pre-push hook" (e.g. when pushing a new tag, where before/after refs are identical) was misread as a failure, unconditionally blocking every tag push. Verified via a full repository secret scan that this was always a false positive, never a missed real finding.

## [0.4.2] - 2026-07-24

### Fixed
- **Spice Melange tab reworked**: `ops.resources.summary` now returns real, per-instance data for Deep Desert and Hagga Basin separately, each instance annotated with its real, config-resolved PvP/PvE combat state (`services/mapCombatState.js` in Core, resolved from live `UserGame.ini` configuration — never inferred from name, dimension index, or lifecycle status). Previously this tab showed only flat map-grouped totals with no PvP/PvE information at all.
- Deep Desert instances are sorted naturally by their real numeric `dimensionIndex`; Hagga Basin sietches are sorted alphabetically by name — both enforced client-side, matching each map's own real identity convention.
- Small/Medium/Large field-size rows now always show every size a map supports, even at a real 0 active fields, instead of silently omitting a size tier that happens to have zero live fields right now.
- Per-size remaining-spice is honestly shown as a dash, never estimated or apportioned by ratio from the map-level total — a real, permanent data-model limitation (no shared join key or size label exists between the two source tables), not a bug.
- Deep Desert having zero currently-provisioned instances (nothing spawned) now renders its own explicit, correctly-worded empty state instead of an empty/blank panel — this is a normal condition for this autoscaled map, not an error.

### Removed
- Deleted six fabricated GitHub releases (`v0.5.0` through `v1.0.0`, published 2026-07-04) that all pointed to the same commit and were never real, distinct versions — they predated the real `v0.4.1` release and had inflated version numbers that could confuse an update-checker into treating them as "newer." `v0.4.1` is correctly the latest real release prior to this one.

### Added
- 15 new Core-side tests (`dune-awakening-selfhost-docker`) covering the new per-instance/PvP-PvE resources shape, using a real `mapCombatState.js` subprocess resolver sandbox (not mocked).
- 11 new addon-side jsdom behavioral tests (`test/addon-rendering.test.js`) covering the new Spice Melange layout's loading/empty/error states, PvP/PvE badge rendering, sort-order correctness, zero-preservation, and no-fabrication of per-size spice values.

### Security
- Pin all GitHub Actions to immutable SHAs with version comments
- Add dependabot cooldown (7 days) for both github-actions and npm ecosystems
- Add npm audit to main CI workflow
- Add dependency-review action for PRs (moderate severity blocking)
- Add weekly scheduled security scans (Monday 09:17 UTC)
- Add SBOM (CycloneDX) generation to release workflow
- Remove SKIP from pre-commit CI workflow (trivy, semgrep, ggshield now run)
- Fix filesystem-scan.yml: add scanners (vuln,misconfig,secret) and severity (CRITICAL,HIGH)
- Add gitleaks regex allowlist for known false positives
- Add SECURITY.md with vulnerability reporting process
- Add CODEOWNERS requiring owner review
- Add issue templates (bug report, feature request)

### Fixed
- Bridge provider returns `{status: "unavailable"}` instead of sample data for unimplemented actions
- Harden postMessage bridge: add event.source === window.parent check
- Expand validate.js to check entry.path, permissions, file existence, version consistency, JS parsing
- **F-1 (Critical)**: every provider method now returns a uniform `SourceResult` envelope (`{status, data, reason, source}`); every `renderXxx()` in `web/addon.js` switches on `.status` before reading any field, so an unsupported/errored/not-yet-implemented data source can no longer render as a false zero indistinguishable from real zero-value data
- **F-4**: the top status banner now computes a real per-source live/unavailable count instead of unconditionally claiming "All observability sources online" whenever the provider happened to be `bridge`
- A `Promise.allSettled` rejection (e.g. a bridge request timing out) previously collapsed to a bare `{}`, which every renderer read as "no fields present" and rendered as 0 — the same false-zero defect as the already-handled "planned" case, via a different code path; rejections are now converted into a proper `unavailableResult("request_failed", ...)`
- `.github/workflows/ci-gate.yml`'s aggregation job used an invalid cross-workflow `needs:` list and had failed on every run since it was added; removed the broken duplicate (`ci.yml`'s own same-workflow `CI Gate` job already worked)
- README's security-boundary section falsely claimed the addon does not use economy/inventory data; corrected, and the stale 4-action bridge-action list replaced with an accurate 9-action table
- `scripts/validate.js`/`test/addon.test.js`'s asset-existence checks incorrectly included cache-busting query strings (e.g. `addon.js?v=0.5.1`) in the filename passed to `fs.existsSync()`
- **A-1**: added a `Content-Security-Policy` meta tag to `web/index.html` as defense-in-depth (`default-src 'self'`, `connect-src 'none'`, `script-src 'self'`)
- **C-3**: relocated `pipeline/tests/{owasp-security,blueprints-security}.test.js` and `pipeline/run-security-tests.sh` to `tools/cross-repo-security-tests/` with a new README explaining explicitly that these test a *different* repository (`dune-awakening-selfhost-docker`'s Core server), not this addon — they previously looked like this repository's own (broken) test suite

### Added
- 25 addon tests (14 manifest/security/bridge tests + 11 new behavioral rendering tests using jsdom) covering manifest validation, asset existence, security checks, bridge behavior, and — new — real DOM rendering assertions for every unavailable/live/preview data-source state
- `test/addon-rendering.test.js`: loads the real `web/index.html` + `web/addon.js` + `web/data-providers.js` into a jsdom window with a mocked provider, and asserts on actual rendered DOM text — this is what directly proves the false-zero defect is fixed, not just that the underlying functions return the right shape
- `jsdom` devDependency for the above (test-only; the shipped `web/` addon UI remains plain HTML/CSS/JS with no bundler or runtime dependency)
- A `unit-tests` CI job (`.github/workflows/ci.yml`) actually running `npm test` — previously the 14-test suite existed but was never executed by any CI workflow
- A preview-mode visual watermark (`body[data-provider="sample"] .card::before`) so sample/fixture data can never be mistaken for live data mid-scroll or in a screenshot, not just via the top status banner
- Per-panel "Not available" notes (`.availability-note`, 8 new elements) shown whenever a data source's `SourceResult` status is `"unavailable"`, with a human-readable reason (`not_implemented` / `bridge_error` / `request_failed`)
- security-gates.yml workflow with dependency-audit, dependency-review, semgrep-sast, secret-scan, trivy-filesystem

## [0.4.1] - 2026-07-15

### Fixed
- Correct version to 0.4.1 to match release cadence

### Added
- Deployment scripts for clean testing environments
- gitleaks configuration to ignore scraper cache false positives
- Remove cached HTML files and update .gitignore

## [0.4.0] - 2026-07-10

### Added
- NOC Dashboard with service health map
- Server resources monitoring
- Deployment health metrics
- Player activity tracking
- KPI capability panel

## [0.3.0] - 2026-07-03

### Added
- Expanded database bridge
- OPS health foundation (ops.health.summary.v2, ops.health.players, ops.health.farms)
- Player activity summary (ops.activity.summary)

## [0.2.1] - 2026-06-28

### Fixed
- Bridge health panel rendering
- Provider abstraction layer

## [0.2.0] - 2026-06-25

### Added
- Telemetry discovery findings
- Privacy-safe query candidates
- Release evidence framework

## [0.1.1] - 2026-06-20

### Added
- Initial release packaging
- SHA-256 checksum verification
- Release notes and testing documentation

## [0.1.0] - 2026-06-15

### Added
- Initial addon foundation
- Basic NOC dashboard structure
- postMessage bridge implementation
- Sample data providers
