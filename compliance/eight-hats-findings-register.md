# dune-ops-observability-addon — Eight-Hats Findings Register

**Date:** 2026-08-07 | **Version:** 0.4.7  
**Review scope:** Full addon (web/, test/, docs/, ops-observability/, scripts/, pipeline/, .github/)  
**Status key:** ✅ Resolved | 📝 Documented | 🔧 Needs Fix | 🐛 Issue Filed | ⏳ Deferred

---

## HIGH Findings (2)

### H-1: Ops health composite is a single failure zone
**Status:** 🔧 Needs Fix | **Hat:** Architect  
`web/data-providers.js:399-401` — `getOpsHealth()` returns `unavailableResult` if *any* of 3 sub-calls fails. The ops health snapshot feeds NOC Overview, Players tab, KPI panels, and freshness tracking. Other panels independently handle their own failures (correctly), but the ops health composite bundles 3 independent sources into one failure domain.  
**Fix:** Return partial results — mark individual sub-sources as `status:"unavailable"` within the composite rather than marking the entire composite unavailable.

### H-2: Branch protection documented but not enabled on `main`
**Status:** 🔧 Needs Fix | **Hat:** GRC  
`docs/GITHUB-RULESETS.md` describes the exact ruleset config (`main-required-checks`), but the 2026-07-22 gap analysis and current GitHub API confirm it's not active. The CHANGELOG marks S-2 (missing branch protection) as resolved, but the control doesn't exist.  
**Fix:** Enable the ruleset via GitHub repo settings or `gh api` with the documented configuration.

---

## MEDIUM Findings (8)

### M-1: Bridge detection can silently fall back to sample mode
**Status:** 🔧 Needs Fix | **Hat:** Architect  
`web/data-providers.js:280-282` — If the iframe hosting context changes, `isConsoleIframe()` returns false and the addon silently switches to sample/preview data. The operator sees the amber "PREVIEW" watermark but may not notice it amidst live-looking data.  
**Fix:** Add an explicit "Preview mode — not connected to live server" banner in the status bar when in sample mode, distinct from the card-level watermark.

### M-2: Hardcoded public IP in deploy script
**Status:** 🔧 Needs Fix | **Hat:** Security  
`scripts/deploy/deploy-lib.sh:24` — `SERVER_IP="${SERVER_IP:-50.123.64.61}"` — a real, routable public IP hardcoded as a default. Exposes the maintainer's server address to anyone cloning the repo.  
**Fix:** Remove the hardcoded default. Require the operator to explicitly set `SERVER_IP` in their environment.

### M-3: Compliance scaffolding is ACP-ecosystem artifacts, not addon-specific
**Status:** 📝 Documented | **Hat:** GRC  
`compliance/README.md` references SOC 2 controls for the ACP ecosystem. Every policy and runbook it lists (`threat-model.md`, `backup-recovery.md`, `rollback.md`) is missing from this repo. This is a stale artifact from the ACP bot repo, not a real compliance baseline for this addon.  
**Fix:** Either update compliance docs to reference the addon specifically, or remove the compliance scaffolding and document that this addon's compliance lives within the Core repo's compliance framework.

### M-4: Release evidence version-gapped
**Status:** 📝 Documented | **Hat:** GRC  
Only two evidence versions exist (`0.2-telemetry-discovery/`, `0.3-expanded-db-bridge/`) despite the shipped version being 0.4.7. The `release-standard.md` requires 16-file evidence bundles per release. v0.4.0–v0.4.7 (~5 releases) have no corresponding evidence.  
**Fix:** Generate evidence bundles for the current release. Document a threshold for when evidence is required (major/minor releases vs. patch releases) or commit to generating it for every release.

### M-5: `refreshAll()` hardcodes 9 provider calls at 4 coordination points
**Status:** 📝 Documented | **Hat:** Architect  
`web/addon.js:1108-1118,1083,1146` — The refresh cycle, source names array, and result array must stay in sync when adding a new panel. 4 separate locations must be updated manually.  
**Fix:** Refactor to a single data-driven configuration array that drives all 4 points. The `check-bridge-action-drift.js` already catches schema-level drift; this is mechanical cleanup.

### M-6: `.gitleaks.toml` allowlists `gho_` token regex globally
**Status:** 🔧 Needs Fix | **Hat:** Security  
`.gitleaks.toml:17` — The `gho_[A-Za-z0-9]{40}` pattern is globally whitelisted, intended for cache-file false positives but applied repo-wide. A real `gho_` token committed anywhere would be silently ignored.  
**Fix:** Scope the allowlist to the specific cache file paths that need it (`.placeable-cache`, `.augment-cache`) using gitleaks' path-scoped allowlist syntax.

### M-7: Bridge action strings duplicated between code and README
**Status:** 📝 Documented | **Hat:** Architect  
`web/data-providers.js:2-38` vs README bridge-action table. Drift is caught by `check-bridge-action-drift.js` but only in CI — no pre-commit hook prevents a new action from being added to code without README update.  
**Fix:** Add `check-bridge-action-drift.js` to the pre-commit hook configuration.

### M-8: Deploy scripts require Docker socket + `sudo`
**Status:** 📝 Documented | **Hat:** Security  
`scripts/deploy/deploy-lib.sh` uses `docker`, `sudo rm -rf`, `sudo chown`, and `network_mode: host`. These are test-infrastructure scripts, not part of the shipped addon package.  
**Fix:** No action needed for the shipped addon. Document the elevated-privilege requirement in the deploy script README.

---

## LOW Findings (15)

| # | Finding | Hat | Status |
|---|---|---|---|
| L-1 | No client-side permission validation — addon trusts Core's route table | Architect | 📝 Documented |
| L-2 | `faction-tagger.js` MutationObserver on entire documentElement | Architect | 📝 Documented |
| L-3 | No offline/error-caching strategy — state lost on refresh | Architect | 📝 Documented |
| L-4 | `addon.json` SHA256 must be updated on every re-build | Architect | 📝 Documented |
| L-5 | Console auth is implicit same-origin trust — no independent auth (correct design) | Security | 📝 Accepted |
| L-6 | Raw bridge data exposed in Diag tab — regression risk if bridge adds per-player data | Security | 🔧 Add note |
| L-7 | Combat state string used as CSS class suffix without sanitization | Security | 📝 Low risk |
| L-8 | GRC backup/recovery docs reference missing files | GRC | 📝 Documented |
| L-9 | Repository docs reference stale checkout path (`~/dune-work/addon-main`) | GRC | 🔧 Fix path |
| L-10 | Cloudflare dependency is indirect (Console's concern, not addon's) | Cloud | 📝 Accepted |
| L-11 | No dedicated light theme (dark-only, consistent with Console) | UI | 📝 Accepted |
| L-12 | Persistent refresh state is browser-session-only | UI | 📝 Accepted |
| L-13 | No E2E tests in real Docker Console with actual bridge | QA | 📝 Documented |
| L-14 | No accessibility tests (axe-core, pa11y) | QA | ⏳ Deferred |
| L-15 | `npm audit` override pin (`undici@7.29.0`) manually maintained | QA | 📝 Documented |

---

## AAA/NOC/SOC Metrics Gap Analysis

### AAA Game Operations Metrics (11 missing)

| # | Metric | Severity | Notes |
|---|---|---|---|
| G-1 | **Retention cohort analysis** (D1/D7/D14/D30) | High | Raw active/inactive counts exist but no cohort curve |
| G-2 | **Session duration distribution** (p50/p95/p99) | High | Roadmap candidate, not yet implemented |
| G-3 | **Progression funnel** (time-to-level, level histogram, active by band) | High | Only average level shown |
| G-4 | **Economy health** (money velocity, inflation rate, Gini coefficient, sink-vs-source) | High | Raw totals only — no derived signals |
| G-5 | **New player funnel** (first-session completion, tutorial dropout, time-to-first-death) | Medium | Only "new players" count |
| G-6 | **Engagement scoring** (DAU/MAU ratio, sessions-per-day) | Medium | Raw counts exist but ratio not computed |
| G-7 | **Item economy velocity** (crafted/day, sink/source rates, trade volume by category) | Medium | Static snapshots only |
| G-8 | **Combat balance telemetry** (weapon usage, TTK distribution, NPC difficulty tiers) | Medium | Raw death counts only |
| G-9 | **Map/zone heat maps** (activity by zone, gathering hotspots, PvP zones) | Medium | v0.6.0 candidate |
| G-10 | **Guild health** (activity trend, member retention) | Low | Static guild table only |
| G-11 | **Resource economy** (harvest rate, depletion tracking, spawn-to-harvest cycle) | Low | Point-in-time snapshots only |

### NOC Metrics (10 missing)

| # | Metric | Severity | Notes |
|---|---|---|---|
| N-1 | **Server tick rate / simulation FPS** | Critical | No direct game-server performance indicator. Single most important NOC metric |
| N-2 | **Per-service RED metrics** (request rate, error rate, latency p50/p95/p99) | Critical | SOC tab shows aggregate bridge counts only. No per-endpoint breakdown |
| N-3 | **Real-time CPU/Memory/Disk without Prometheus** | High | NOC Overview blank unless `dune metrics start` is run |
| N-4 | **Service dependency health map** (Postgres, RabbitMQ, game server, Console) | High | Depends on optional metrics stack |
| N-5 | **Database health** (connection pool, slow queries, replication lag, vacuum) | High | No DB health surface |
| N-6 | **SLO/SLI dashboard** (availability %, latency, freshness compliance) | Medium | Core R5 dependency |
| N-7 | **Alertmanager integration** (active alerts, silences, delivery status) | Medium | Core R2 dependency |
| N-8 | **Container health** (restart count per container, OOM events) | Medium | cAdvisor limitation |
| N-9 | **Network I/O** (bandwidth, connection count, packet loss) | Low | Not represented |
| N-10 | **Log error rate** (error/minute, categorized by source) | Low | No log telemetry |

### SOC Metrics (10 missing)

| # | Metric | Severity | Notes |
|---|---|---|---|
| S-1 | **Authentication failure rate** (failed-login count, per-IP brute-force detection) | Critical | Core R4 dependency. #1 SOC signal for any internet-facing service |
| S-2 | **Admin audit trail** (commands executed, privilege changes, config mods by user) | Critical | No visibility into who changed what |
| S-3 | **Permission drift detection** (actual vs. declared perms, changes over time) | High | v1.0.0 candidate |
| S-4 | **Rate limit telemetry** (per-client hits, abuse trends, IP rotation) | High | Core R4 dependency |
| S-5 | **CSP violation reporting** (blocked violations, iframe sandbox events) | High | CSP meta tag exists but no reporting endpoint |
| S-6 | **Suspicious player behavior** (join/leave cycling, inventory duping, economy spikes) | Medium | `cheat_type_enum` exists in DB but not surfaced |
| S-7 | **Data integrity checks** (bridge schema validation, checksum drift) | Medium | CI-only, no runtime surface |
| S-8 | **Secret exposure monitoring** (runtime detection in logs/env/bridge payloads) | Medium | Static scanning only |
| S-9 | **Session hijacking indicators** (concurrent from different IPs, anomalous tokens) | Medium | Core R4 dependency |
| S-10 | **Incident runbook linkage** (per-metric runbook links, escalation paths) | Low | Not implemented |
