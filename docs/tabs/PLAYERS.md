# Tab Architecture — Players

**Status (2026-07-24): the "KPI Capability" panel described in this doc's history has been removed entirely.** See §1.2 for its full lifecycle (static → dynamic → removed) and why.

**Data-tab attribute**: `players`
**HTML**: `web/index.html` (`data-tab="players"` section)
**Render entry point**: `refreshOpsHealth()` (triggered by the "Refresh OPS health" button) and `refreshAll()` (on every general refresh) both call `renderOpsAggregate()` → `renderKpis()`

---

## 1. Current implementation (verified)

Two panels remain: "OPS Health Aggregate" (a table) and "Read-only KPI Panels" (computed cards). A third panel, "KPI Capability," existed between 2026-07-24's dynamic-status fix and its removal later the same day — see §1.2.

### 1.1 "OPS Health Aggregate" table

One row per refresh, showing the same totals as the NOC Overview's summary cards (Players/Online/Offline/Farm Sites), plus Ready/Alive and Last Read, built by `renderOpsAggregate()`. The `#empty-state` div correctly distinguishes three states:
- **Unavailable** (`!snapshot.available`): shown, text via `unavailableMessage()` — "Not available — [reason]".
- **Available, zero rows**: shown, text: "OPS health bridge returned zero player rows and zero farm rows. This is live aggregate data, not placeholder content."
- **Available, has rows**: hidden entirely.

No defects found in this panel. Known, deliberately-out-of-scope overlap: this table duplicates the same 4 numbers (Players/Online/Offline/Farm Sites) already shown as metric-cards on the Overview tab — a data-architecture question, not a visual one, tracked separately, not fixed as part of any content/visual pass so far.

### 1.2 "KPI Capability" panel — removed entirely (2026-07-24)

**Full lifecycle, for history:**

1. **Original defect**: seven `<article class="capability-card">` rows, entirely static HTML, each hardcoded `<span class="capability-status capability-supported">supported</span>` — confirmed via direct search that zero occurrences of `capability-grid`/`capability-card`/`capability-status` existed anywhere in `web/addon.js`, meaning the panel never reflected real bridge state. One claim (Location & Territory) was permanently false, since Location is closed out-of-scope by owner decision (`docs/tabs/LOCATION.md`) and will never be implemented.
2. **Fixed to be dynamic** (Tier 2.1, PR #71): removed the Location row, wired each status span to a real `data-capability-sources` attribute read by a new `renderCapabilities()` function, added SOC/Metrics rows. Computed a real `supported`/`partial`/`unavailable` status every refresh from actual per-source `SourceResult.status`. Shipped with icons in the later visual-redesign pass (PR #73).
3. **Removed entirely** (Tier 2.6 follow-up, same day): on further review, the panel was judged to add little real value even once dynamic and honest — it was meta/diagnostic information (which data *sources* are live) sitting on the Players tab specifically, showing status for Combat, Economy, Inventory, SOC, and Metrics — none of which are Players data at all. A user opening the Players tab to check population numbers doesn't need a cross-tab health dashboard bolted on top; if a specific tab's data is actually down, that tab's own `.availability-note` already surfaces it exactly when and where it's relevant. Maintainer decision: delete the panel (HTML section, `renderCapabilities()`/`capabilityStatusFor()`/`makeStatusIcon()`, the 8 covering tests, and the now-unused `.capability-*` CSS) rather than keep maintaining a real but low-value feature.

**What remains reusable from this panel's work**: `SVG_NS` and the general "real inline `<svg>` icon, not a data-URI/icon-font" pattern are still used by the Spice Melange PvP/PvE combat badges (`makeCombatIcon()`), which are unrelated to this panel and were not removed.

### 1.3 "Read-only KPI Panels"

Active Rate / Average Level / Top Faction / Top Guild — computed by `renderKpis()` directly from the same OPS-health snapshot as §1.1. Handles missing sub-fields correctly (`kpis.averageLevel === null ? "—" : ...`).

---

## 2. Data flow (current, verified)

Identical upstream data source as NOC Overview (`ops.health.summary.v2`/`.players`/`.farms` via the addon-bridge path — see `docs/tabs/NOC-OVERVIEW.md` §2 for the verified server-side routing). This tab and NOC Overview render the *same* underlying snapshot into two different panel layouts; there is no separate provider call for this tab.

---

## 3. Recommended design changes

None outstanding for this tab specifically. If a future need arises to show cross-tab data-source health at a glance again, do not re-add it to the Players tab — the §1.2 lifecycle is the reasoning for why it doesn't belong there. Diagnostics (the `diag` tab) would be a more appropriate home if this is ever revisited, since that tab already exists for meta/debug information.
