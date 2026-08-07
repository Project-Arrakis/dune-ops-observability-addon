# PROMPT: AAA Game Operations Metrics — Gap Implementation

**Severity:** HIGH + MEDIUM | **Domain:** Game Operations  
**Repository:** `dune-ops-observability-addon` + `dune-awakening-selfhost-docker` (Core)  
**Timeout estimate:** 8-12 hours

## Context

The dune-ops-observability-addon (v0.4.7) provides 10 tabs of game server
metrics but is missing 11 key metrics expected by AAA game operations teams.
These gaps were identified in the 2026-08-07 eight-hats review.

**Architecture note:** The addon itself is a static UI with no server-side
code. All data arrives through Core's postMessage bridge. New metrics need
BOTH a Core-side bridge action (new or expanded `addonOps*()` function in
`duneDb.js`, new bridge route in `server.js`) AND an addon-side renderer.

## Task 1: Player Retention Cohorts (G-1) — HIGH

**What's needed:** D1/D7/D14/D30 returning-player rates by cohort. This is
the #1 missing game ops metric.

**Core side (dune-awakening-selfhost-docker):**
- Write a new `addonOpsRetentionCohorts(db)` function in `console/api/src/duneDb.js`
- Query: for each day in the last 30 days, count players who first joined
  that day (the cohort), then count how many returned within 1/7/14/30 days
- Return shape: `{ cohorts: [{ date, newPlayers, d1, d7, d14, d30 }] }`
- Add to the bridge action route table with permission `ops:read`
- Existing `dune.player_state` and `dune.accounts` tables have
  `created_at`/`last_login` fields — use these

**Addon side (dune-ops-observability-addon):**
- Add a new `ops.retention.cohorts` bridge action in `web/data-providers.js`
- Add a "Player Retention" section to the Players tab OR a new "Retention"
  sub-panel
- Render: table with cohort rows (date, size, D1%, D7%, D14%, D30%) plus a
  small trend line or color gradient showing decay

**Verification:**
- Core: unit test with mock data
- Addon: behavioral test with fixture data

## Task 2: Session Duration Distribution (G-2) — HIGH

**Core side:**
- New `addonOpsSessionDuration(db)` function
- Query `dune.player_sessions` or equivalent: compute p50/p95/p99 session
  length in minutes, average sessions per player per day
- Return shape: `{ p50, p95, p99, avgPerPlayerPerDay, totalSessions, uniquePlayers }`

**Addon side:**
- Add to the Players tab or NOC Overview as a "Session Health" card
- Show: "Median session: 45m", "95th percentile: 3h", "2.1 sessions/player/day"

## Task 3: Progression Funnel (G-3) — HIGH

**Core side:**
- New `addonOpsProgressionFunnel(db)` function
- Query: level distribution histogram (buckets: 1-10, 11-20, 21-30, etc.),
  time-to-level-X averages for key milestones, active characters by level band
- Return shape: `{ distribution: [{levelBand, count}], milestones: [{level, avgHours}] }`

**Addon side:**
- Add a "Progression" panel to the Players tab
- Show: level distribution bar chart (text-based, no canvas needed —
  proportional div widths with CSS), milestone table

## Task 4: Economy Health Indicators (G-4) — HIGH

**Core side:**
- Expand `addonOpsEconomySummary()` or create `addonOpsEconomyHealth(db)`
- Query: money supply velocity (transactions/day / total supply), weekly
  supply change rate, wealth Gini coefficient (top 1%/10%/50% share),
  sink-vs-source ratio (items destroyed vs. created per day)
- Return shape: `{ velocity, inflationRate, gini: {top1, top10, top50}, sinkRate }`

**Addon side:**
- Add an "Economy Health" sub-section to the Economy tab
- Show derived indicators with thresholds: green/orange/red for
  velocity, inflation, Gini

## Task 5: Remaining Medium-Priority Metrics

| # | Metric | Complexity | Core Query |
|---|---|---|---|
| G-5 | New player funnel (tutorial dropout, time-to-first-death) | Medium | `player_state` + tutorial states |
| G-6 | DAU/MAU ratio (compute from existing active counts) | Low | Already have counts — just compute ratio |
| G-7 | Item economy velocity (crafted/day, sink/source rates) | Medium | `items` table + timestamps |
| G-8 | Combat balance (weapon usage, TTK distribution) | Medium | `combat_events` or equivalent |
| G-9 | Map heat maps (activity by zone) | Medium | `player_state` location data |
| G-10 | Guild health (activity trend, retention) | Low | `guild_members` + activity |
| G-11 | Resource economy (harvest rate, depletion) | Low | `spice_fields` + timestamps |

**Verification for each:**
- Core: `node --test test/addonOpsRetention.test.js` (or similar) with mock DB
- Addon: behavioral jsdom test with fixture data
- Bridge action: registered in the route table, parity test passes
- Existing tests: all 57 must continue to pass

## State After Completion

For EACH metric implemented:
- [ ] Core-side `addonOpsXxx()` function in `duneDb.js` with unit tests
- [ ] Bridge action registered in Core's `server.js` with `ops:read` permission
- [ ] Addon-side `getXxx()` provider method in `data-providers.js`
- [ ] Addon-side `renderXxx()` function in `addon.js`
- [ ] Behavioral test in jsdom verifying correct rendering for live and
      unavailable states
- [ ] PANEL_CONFIG entry in addon.js (if new panel)
- [ ] README bridge-action table updated
- [ ] SourceResult envelope contract respected (`status`, `data`, `reason`)
- [ ] All existing tests pass (Core: `node --test`, Addon: `npm test`)

## Prioritization

Implement in this order:
1. G-6 (DAU/MAU) — lowest hanging fruit, data already exists
2. G-3 (Progression funnel) — high value, moderate complexity
3. G-1 (Retention cohorts) — highest value, highest complexity
4. G-2 (Session duration) — high value, depends on session data availability
5. G-4 (Economy health) — high value, complex queries
6. G-5, G-7 through G-11 — medium priority, can be batched

## Reference Files

- Core bridge actions: `console/api/src/server.js` (search for `addonBridgeRoute`)
- Core DB queries: `console/api/src/duneDb.js` (search for `addonOps`)
- Addon data providers: `web/data-providers.js`
- Addon rendering: `web/addon.js`
- Addon HTML structure: `web/index.html`
- Metric classification standard: `ops-observability/roadmap/metric-classification-standard.md`
- Database event inventory: `docs/DATABASE-EVENT-INVENTORY.md`
