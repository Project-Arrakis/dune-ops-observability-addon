# PROMPT: Addon NOC/SOC Improvements — No Core Changes Required

**Severity:** HIGH | **Repo:** dune-ops-observability-addon  
**Dependencies:** None  
**Core Changes Required:** None (all changes in addon web/ files)  
**Timeout estimate:** 3-5 hours

## Context

The addon's 10-tab dashboard has several structural gaps that undermine its credibility
as a NOC/SOC wallboard. These can all be fixed **without touching Core** — they're
purely UI/data-presentation issues.

## Task 1: Fix NOC Overview Service Table (G6)

**Current state:** The "Bridge & Aggregate Status" table shows addon-internal bookkeeping
(OPS Health Bridge, Player Aggregate, Farm Aggregate) — NOT the actual game stack services.
The section copy below the "Data Freshness & Reliability" heading promises "Postgres,
RabbitMQ, Director, Gateway, Survival_1, Overmap, TextRouter" but the table doesn't
deliver any of that.

**Fix:** Replace the existing `renderNocService()` function to show TWO tables:

**Table A — System Services** (data from existing bridge calls):
| Service | Status | Detail |
|---|---|---|
| Prometheus | Up/Down | From `ops.health.prometheus` |
| Postgres | Up/Down | From `ops.health.prometheus` `services` map |
| RabbitMQ Admin | Up/Down | From `ops.health.prometheus` `services` map |
| RabbitMQ Game | Up/Down | From `ops.health.prometheus` `services` map |
| Node Exporter | Up/Down | From `ops.health.prometheus` `services` map |

**Table B — Data Sources** (current table content, relabeled):
| Source | Status | Detail |
|---|---|---|
| OPS Health Bridge | Live/Unavailable | From existing provider status |
| Player Aggregate | Live/Unavailable | From snapshot.available |
| Farm Aggregate | Live/Unavailable | From snapshot.available |

Update the section copy to say:
> "System service status is reported by Prometheus when the metrics stack is running.
> Data source status reflects the Console bridge connection. Both must be healthy for
> reliable monitoring."

## Task 2: Add Service Health Indicator to SOC Tab

**Current state:** The SOC tab's "Metrics Health" section depends on Prometheus running.
When it's not running (the default), the entire SOC infrastructure panel is blank.

**Fix:** When Prometheus is NOT running, show a "Metrics stack is not enabled" card
with a one-line command: `dune metrics start`. When Prometheus IS running, show the
current hardware metrics + service health table. This is what `ops.health.prometheus`
already returns — the addon just needs to handle the `status:"planned"` case more
gracefully with an actionable message.

In `addon.js`, update `renderPrometheusHealth()` to:
- When `result.status === "unavailable"` (bridge error): show standard availability note
- When `result.data.status === "planned"` (stack not started): show a CALL-TO-ACTION card:
  ```
  "The optional Prometheus metrics stack is not running.
  Run 'dune metrics start' on your server to enable host-level monitoring."
  ```
- When `result.status === "live"`: show current hardware cards + service table

## Task 3: Add Data Age/Freshness Indicator to Every Panel Header

**Current state:** Only the NOC Overview tab shows data freshness. All other tabs show
live snapshots with no indication of how old the data is. If the bridge goes down,
tabs silently show stale data.

**Fix:** Add a small age indicator to each panel header (e.g., "5m ago" or "Stale —
last refresh 12m ago"). The `lastSuccessfulReadAt` variable already exists at line 138
of addon.js. Make it accessible to every render function by:
1. Storing it as a module-level variable alongside `previousTotals`
2. Creating a helper: `function freshnessBadge(secondsAgo)` that returns CSS class
   `fresh` (<60s), `stale` (60s-5m), or `stale-critical` (>5m)
3. Adding a `<span class="freshness-indicator">` next to each panel's `<h3>` heading
4. Calling `updateFreshnessBadges()` at the bottom of `refreshAll()`

## Task 4: Fix NOC Overview Server Resources Section

**Current state:** The "Server Resources" section (CPU, Memory, Disk, Uptime) renders
4 cards but they are **all hardcoded to "—"** in `renderNocResources()`. The data is
available from `ops.health.prometheus` (when Prometheus runs) but this function never
consumes it.

**Fix:** In `renderNocResources(snapshot)`:
1. When snapshot includes prometheus data: render CPU %, Memory MB, Disk %, Uptime
   from `snapshot.summary` or the prometheus bridge result
2. When prometheus is not running: show "Metrics stack not started — run `dune metrics start`"
3. When prometheus reports but values are null: show "— (unavailable)"

Pass the prometheus bridge result through `refreshAll()` to `renderNocResources`.

## Task 5: Add Section Copy to Tabs That Lack It

**Current state:** The Activity, Combat, Economy, Inventory, and SOC tabs have zero
section copy (no explanatory text). New operators have no idea what they're looking at.
Compare with the NOC Overview and Spice Melange tabs which have rich, helpful copy.

**Fix:** Add a `<p class="section-copy">` to each tab that lacks one:
- **Activity:** "Player activity windows show how many distinct players have interacted
  with the server in the given time period. Active counts are derived from the last
  known avatar activity timestamp; stale or missing timestamps are treated as unknown."
- **Combat:** "Combat statistics are derived from the player death log. Deaths by cause
  track environmental and creature hazards. PvP/PvE distinction and per-map breakdowns
  are not yet available in this game version."
- **Economy:** "Economic indicators are live snapshots of the in-game currency and
  exchange system. Supply, orders, and tax data are read directly from live tables."
- **Inventory:** "Item and storage statistics are aggregate-only — no per-player
  identifiers. Total Crafted has no real data source in the current schema."
- **SOC:** "Security and platform health metrics. Bridge request/error counts are
  derived from the in-memory request counter since last Console restart."

## Task 6: Add "What's Missing" Callouts for Known Gaps

**Current state:** Several panels show "—" for metrics that will never have data
(totalCrafted, PvP deaths) without explaining WHY. This looks like a bug.

**Fix:** Add a `title` attribute to the `—` elements or a small info icon (?) that
on hover shows the reason. For example:
- `totalCrafted`: "This metric has no real data source in the game database schema.
  It is intentionally always unavailable."
- PvP/PvE distinction: "The death log schema does not distinguish PvP from PvE kills.
  All deaths currently report as PvE."

## Verification

- [ ] All 57 existing tests pass
- [ ] NOC Overview shows service health table with actual Prometheus data (when stack running)
- [ ] NOC Overview shows friendly message when Prometheus not running
- [ ] SOC tab shows actionable "run `dune metrics start`" when stack not running
- [ ] Every tab has explanatory section copy
- [ ] Freshness badges appear on every panel and update on refresh
- [ ] Server Resources section shows real data (when Prometheus running)
- [ ] Known-gap tooltips appear on intentionally-unavailable metrics
