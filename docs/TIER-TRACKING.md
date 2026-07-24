# Tier Tracking — Remaining Gaps & Feature Work

**Created**: 2026-07-24
**Purpose**: Single source of truth for prioritized remaining work across `dune-ops-observability-addon` and `dune-awakening-selfhost-docker`, using the tier structure agreed with the maintainer on 2026-07-24. This document is retroactive for everything already shipped (so the full history is traceable in one place) and forward-looking for everything not yet started.

**PR workflow going forward (agreed 2026-07-24)**: implement a tab/item end-to-end on a feature branch → run full test suite + `npm audit` + `pre-commit run --all-files` locally → maintainer manually verifies the tab/change live or in preview → PR body is written to a file → maintainer runs the exact `gh pr create` command when satisfied (the agent does not run `gh pr create` itself unless explicitly asked to for a given item). This applies to Tier 2 onward; Tier 0/1 items below were completed before this workflow was agreed and were merged directly.

---

## Tier 0 — Foundational (completed before tiering existed)

Everything from the initial security/architecture gap analysis through the Core OPS-data wiring and the Spice Melange rework. Listed here for full traceability; no further action needed unless a regression is found.

| # | Item | Repo | PR(s) | Status |
|---|---|---|---|---|
| 0.1 | Security & architecture gap analysis (initial findings doc) | addon | #61 | Merged |
| 0.2 | CI check fixes (Pre-commit, NPM Audit, Shell Lint) | addon | #62 | Merged |
| 0.3 | Phase 0/1 fixes: S-1 (README boundary claims), S-2 (branch protection + governance docs), S-4 (stale compat claim), S-5 (docs/README contradictions), C-2 (manifest validator cache-busting bug); found+fixed a broken `ci-gate.yml` cross-workflow `needs:` | addon | #63 | Merged |
| 0.4 | `SourceResult` envelope refactor: F-1 (false-zero rendering), F-3 (preview data indistinguishable from live), F-4 ("all sources online" false claim), C-4 (weak substring test → 11 real DOM behavioral tests) | addon | #64 | Merged |
| 0.5 | Phase 3 fixes: C-1 (npm audit on empty manifest), C-3 (OWASP test suite relocated to `tools/cross-repo-security-tests/`), A-1 (CSP added) | addon | #65 | Merged |
| 0.6 | Full 10-tab design review + 9 per-tab architecture docs (`docs/tabs/`) + 9 implementation prompts (`docs/prompts/`) | addon | #66 | Merged |
| 0.7 | Phase 4 governance-automation prompt written (not implemented — see Tier 3.2 below) | addon | #67 | Merged |
| 0.8 | Prometheus "not running" reason passthrough + real false-zero fix (`totalRestarts ?? 0` → `—`) | addon | #68 | Merged |
| 0.9 | Location decision closed permanently (owner decision) across all docs | addon | #69 | Merged |
| 0.10 | Core: security hardening — Discord player-link auth, rate limiting, multi-account linking | core | #108 | Merged |
| 0.11 | Core: security — moved Discord-linking tables out of `dune` schema into new `console` schema | core | #110 | Merged |
| 0.12 | Core: real combat-state resolver — PvP/PvE resolved from `UserGame.ini`, not metadata (`services/mapCombatState.js`) | core | #103, #104 | Merged |
| 0.13 | Core: wired 4 real OPS routes (Phase 1) to existing `duneDb.js` queries | core | #109 | Merged |
| 0.14 | Core: wired `ops.inventory.summary` to real aggregate queries (Discord-adapter path only — later found incomplete) | core | #111 | Merged |
| 0.15 | Core: wired `ops.soc.summary` to a real in-memory bridge-request counter (Discord-adapter path only — later found incomplete) | core | #112 | Merged |
| 0.16 | **Critical fix**: wired Inventory + SOC into `server.js`'s `addonBridgeRoute` — the actual path the real addon uses; #111/#112 had zero effect on the live addon until this | core | #114 | Merged |
| 0.17 | Core: wired `ops.health.prometheus` to a real, precondition-aware Prometheus/cAdvisor integration, into both consumer paths from the start | core | #115 | Merged |
| 0.18 | **Spice Melange rework**: Deep Desert / Hagga Basin per-instance layout, real config-resolved PvP/PvE per instance, size-tier rows, natural/alphabetical sort, zero-preservation, no per-size spice fabrication | core + addon | core #117, addon #70 | Merged |
| 0.19 | `acp-landing`: security/architecture audit + 12/19 findings fixed + branch protection + GOV-1 branch reconciliation | acp-landing | #9, #10, #11, #12 | Merged |

---

## Tier 1 — Cheap, high-signal, no design doc needed

| # | Item | Repo | Status | Notes |
|---|---|---|---|---|
| 1.1 | Delete/mark-prerelease the fabricated `v0.5.0`–`v1.0.0` GitHub releases (S-3) | addon | **Resolved 2026-07-24** | Confirmed fabricated beyond doubt: all 6 tags/releases pointed to the exact same commit (`1ea5fa9`, itself a docs-only commit predating the real `v0.4.1`), all published within the same 9-minute window with identical templated bodies. Deleted via `gh release delete --cleanup-tag` for all 6. `v0.4.1` (then `v0.4.2`) is correctly the latest real release. |
| 1.2 | Sync `docs/tabs/INVENTORY.md` and `docs/tabs/SOC.md` — both still say "not implemented" for features that shipped same-day (core #111/#112/#114/#115) | addon | **Not started** | Docs-only, zero code risk. Can be its own tiny PR or folded into whichever tab PR touches those tabs next. |

---

## Tier 2 — Real per-tab defects (single-tab PRs)

| # | Item | Repo | Tab | Status |
|---|---|---|---|---|
| 2.1 | **Players — KPI Capability panel**: 7 cards 100% hardcoded `supported` in static HTML, zero JS wiring (confirmed: `grep -n "capability" web/addon.js` → 0 matches). One row (Location & Territory) is permanently false since Location is closed out-of-scope. | addon | Players | **Merged** — PR #71, `949358c`. Panel is now dynamic (data-capability-sources attributes + real per-source SourceResult status), Location row removed, SOC/Metrics rows added. |
| 2.2 | **NOC Overview — Service Health Map mismatch**: panel copy (`index.html:110`) promises 7 named services (Postgres, RabbitMQ, Director, Gateway, Survival_1, Overmap, TextRouter); `renderNocService()` actually renders 5 unrelated addon-internal metrics (OPS Health Bridge, Player Aggregate, Farm Aggregate, Data Freshness, Provider Mode). | addon | Overview | **Not started** |
| 2.3 | **Spice Melange UI corrections** (maintainer review of the Tier 0.18 rework): per-instance/sietch cards needed real combat-state accent coloring (not just the small badge); per-size table had a dashed-out "amount" column with no real backing data (should be dropped entirely, not dashed); instance-level spice total mislabeled "Remaining Spice" (overclaimed precision a live snapshot can't back up — renamed "Potential Spice" with an explanatory tooltip). | addon | Spice Melange | **Merged** — PR #72, `714da50`, released as v0.4.3. |
| 2.4 | **Players tab (pilot) visual redesign**: maintainer review found the addon's whole visual system reads as an untheed scaffold, not a professional game-studio dashboard. Audited and confirmed: zero `box-shadow` anywhere (fully flat design); `.metric-card`/`.capability-card`/`.kpi-card` are visually identical boxes regardless of information type/importance; the declared `Inter` font is never actually loaded (silent fallback to system font); the one custom asset (`Dune Rise`) is used in exactly one place (hero title) and nowhere else; status colors (supported/unavailable/PvP/PvE) are plain text-color-only with no background tint or icon reinforcement, except one component (`res-combat-badge`) that does it properly, proving the pattern exists but isn't applied elsewhere; zero icons anywhere in the addon; only 2 CSS transitions exist in 613 lines (no hover states, no loading skeletons, no number-refresh animation). Scoped as a pilot on the Players tab first, to be rolled out to the remaining 9 tabs afterward. | addon | Players (pilot) | **In progress** |
| 2.5 | **Visual-audit-adjacent bug fixes** (found during 2.4's audit, kept as separate small fixes per maintainer decision): (a) Combat tab's `index.html` eyebrow has a leftover inline `style="color:#c4b5fd"` (spice-purple) — copy-paste leftover from the Spice tab, factually wrong color for Combat; (b) the faction color-theming system's parent-inheritance is broken — `faction-tagger.js`'s `inheritFromParent()` sets `data-faction` on `<html>`, but the CSS only ever listens for `data-tagged-faction`, so inheriting the Console's active faction theme silently never applies any of the `:root` faction color variables. | addon | Combat, cross-cutting | **Not started** |

---

## Tier 3 — Cross-cutting, larger effort, needs a design doc first

| # | Item | Repo | Status | Notes |
|---|---|---|---|---|
| 3.1 | Core issue #113 — `server.js`'s `addonBridgeRoute` HTTP route layer has zero test coverage (module-level singletons block unit testing without a DI refactor or integration harness) | core | **Not started** | Needs an ADR-style design doc (DI refactor vs. integration-harness approach) before implementation — architecturally non-trivial, affects every bridge action, not one tab. |
| 3.2 | Phase 4 governance automation: (1) README bridge-action drift check, (2) version-consistency + ancestor-aware release check, (3) release-tagging ancestor guard | addon | **Not started** | Prompt already written and ready: `docs/prompts/PHASE-4-GOVERNANCE-AUTOMATION.md`. Not tab-scoped — its own PR. |
| 3.3 | **Prometheus time-series graphs, in-addon** (maintainer idea, 2026-07-24, prompted by EA/Grafana blog post on dashboard design): `addonOpsPrometheusHealth()` currently does a single instant PromQL query (current CPU%, current memory, current target health) — Prometheus itself already retains 7 days of history (`METRICS_RETENTION_TIME:-7d` in `docker-compose.metrics.yml`) that is never queried. This addon would need its own range-query (`/api/v1/query_range`) support plus a charting approach (this addon has zero charting library today; only real options are inline SVG sparklines matching the zero-runtime-dependency pattern, or introducing the addon's first-ever runtime dependency). Scope is narrow: only meaningful for the Metrics(Prometheus) tab and possibly NOC Overview's currently-placeholder "Server Resources" panel — most other tabs (Players, Combat, Economy, Inventory, Spice Melange, SOC) are direct Postgres snapshot queries with no time-series storage at all, so graphing wouldn't apply to them. | core + addon | **Not started** | Deliberately sequenced after the Tier 2.4 visual redesign work completes. Distinct from 3.4 below — this is charts *inside the existing addon UI*, not a standalone dashboarding tool. |
| 3.4 | **Standalone Grafana deployment** (maintainer request, 2026-07-24): a real, full Grafana instance added to the stack (not addon-embedded sparklines — see 3.3) for genuine multi-panel, multi-metric dashboarding, using the Prometheus/node-exporter/cAdvisor/postgres-exporter stack that already exists (confirmed no Grafana anywhere in the current compose files or docs; explicitly listed as out-of-scope in `docs/E2E-METRICS-TESTING.md`). Maintainer explicitly requested this be designed via genuinely independent multi-agent invocations per-principal-role (not one agent role-playing multiple perspectives sequentially — the same anti-pattern named earlier this session for the post-Spice-Melange review), producing: (1) a design/architecture roadmap and (2) a Sonnet-5 implementation prompt, matching the existing `docs/prompts/PHASE-4-GOVERNANCE-AUTOMATION.md` pattern. | core + addon | **Not started** | Explicitly sequenced for after the current workstream (Players tab visual redesign + remaining Tier 2 items) completes — maintainer confirmed do-not-start-yet. |

---

## Tier 4 — Needs maintainer decision before a design doc is worth writing

| # | Item | Repo | Status | Notes |
|---|---|---|---|---|
| 4.1 | Combat tab PvP/PvE — `addonOpsCombatDeaths` hardcodes `pvpDeaths: 0`, `deathsByMap: []`, `topHostileNpcs: []` permanently. **Correction from an earlier (incorrect) assessment this session**: `mapCombatState.js`'s resolver answers "what is this partition's combat mode *right now*," not "what was it at the time of a specific past death" — and `dune.player_death_log` has no partition/map/killer column at all (schema: `id, player_controller_id, death_time, death_cause` only). Real fix requires a `deathPoller.js` schema + write-time change (capture partition id at death-log-insert time) plus a point-in-time combat-state join — a genuine new feature with schema-migration blast radius, not a wiring fix. | core | **Blocked on maintainer decision** | Needs explicit go-ahead before even a design doc, given the migration risk. |
| 4.2 | Stale issue reconciliation: addon issues #1–6 (original scaffolding tracking issues, June 30, none reference the defects found in the 2026-07-23/24 audits), core issues #82/#84 (observability/KPI tracking issues, functionally substantially delivered but still open on GitHub) | addon + core | **Not started** | Low priority, no code risk, bookkeeping only. |

---

## Change log

- **2026-07-24**: Document created. Tier 0 backfilled from full merged-PR history (`gh pr list --state merged`) for both repos plus `acp-landing`. Tiers 1–4 established per maintainer-agreed priority order. Starting Tier 2, item 2.1 (Players KPI Capability panel).
