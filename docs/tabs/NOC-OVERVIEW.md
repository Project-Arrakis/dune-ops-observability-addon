# Tab Architecture — NOC Overview

**Data-tab attribute**: `overview` (default-active tab)
**HTML**: `web/index.html:47-177`
**Render entry point**: `refreshAll()` (`web/addon.js:880`) → `renderOpsAggregate()` (line 401), `renderNocService()` (line 788), `renderNocResources()` (line 800)

---

## 1. Current implementation (verified)

This tab has four panels, three of which currently work correctly and one that doesn't.

### 1.1 "OPS health totals" summary grid (index.html:50-67)

Four cards: Players / Online / Offline / Farm Sites. Populated by `renderOpsAggregate()` from `normalizeOpsHealth(opsHealth)`'s `.totals` object, which itself comes from the `ops.health.summary.v2` + `ops.health.players` + `ops.health.farms` bridge actions (all real, live — `duneDb.addonOpsHealthSummaryV2`).

**Correct behavior confirmed**: when `snapshot.available` is `false` (the OPS health source itself is unavailable — a rejected/errored provider call), all four cards render `"—"`, not `0` (fixed in the F-1 refactor, `addon.js:405-414`). When the source is available but genuinely returns zero rows, the cards correctly show `0` with a distinct "live aggregate data, not placeholder content" empty-state note (visible on the Players tab, not this one — see `docs/tabs/PLAYERS.md`).

### 1.2 "OPS Health Foundation" panel (index.html:69-100)

Four cards: Source Health / Freshness / Aggregate Impact / Operator Status. Populated by `updateOpsHealth()` (`addon.js:314`), which computes operator-facing labels from `lastSuccessfulReadAt`, a rolling staleness threshold (`STALE_READ_THRESHOLD_MS = 5 * 60 * 1000`), and a player-count delta since the previous refresh (`playerDeltaLabel()`, line 301). This is addon-internal bookkeeping about the *addon's own read health*, not about the game server — an intentional and correctly-labeled distinction ("Source Health," not "Server Health").

No defects found here.

### 1.3 "Service Health Map" panel (index.html:102-117) — **real defect**

**Section copy** (index.html:110): *"Service dependency status: Postgres, RabbitMQ, Director, Gateway, Survival_1, Overmap, TextRouter."*

**What `renderNocService()` (addon.js:788-798) actually renders** — five rows, none of which are the services named above:

```js
appendRow(nocServiceBodyEl, ["OPS Health Bridge", isBridge ? "Connected" : "Preview", ...]);
appendRow(nocServiceBodyEl, ["Player Aggregate", totals.total > 0 ? "Populated" : "No Data", ...]);
appendRow(nocServiceBodyEl, ["Farm Aggregate", totals.farms > 0 ? "Populated" : "No Data", ...]);
appendRow(nocServiceBodyEl, ["Data Freshness", lastSuccessfulReadAt ? "Current" : "Stale", ...]);
appendRow(nocServiceBodyEl, ["Provider Mode", isBridge ? "Live Bridge" : "Sample Data", ...]);
```

**Impact**: an operator reading this panel's own description, then scanning the table for "is Postgres up," will not find that answer — the table shows something else entirely, with no indication the promise wasn't kept. This is not a fabricated *number* (nothing here is invented data presented as real), but it is a **broken promise about what the panel shows**, which is its own category of trust defect distinct from F-1's false-zero pattern.

**Root cause**: this looks like a section-copy sentence that was written for an intended future data source (per-container/per-service health, matching `docker-compose.yml`'s actual service names) that was never built, and the placeholder rows that *were* built were never reconciled with the copy that describes them.

**What real service-level data exists today** (verified):
- `runningContainerNames()` (`dune-awakening-selfhost-docker/console/api/src/services/publicDirectory.js:401`) — a real `docker ps --format "{{.Names}}"` call, currently only used internally for `isBattlegroupRunning()`'s boolean check against 4 hardcoded container names (`dune-director`, `dune-server-gateway`, `dune-server-survival-1`, `dune-server-overmap`). This is real, live, per-container up/down data — but it is not currently exposed via any bridge action, and it only covers 4 of the 7 named services (no Postgres, RabbitMQ, or TextRouter container names in that list — verify against the actual `docker-compose.yml` service names before building on this, since the 4-name list may itself be incomplete/stale relative to what's actually deployed).
- No existing Core function returns Postgres/RabbitMQ health specifically as a named row (Postgres connectivity is implicitly proven by every successful `duneDb` query succeeding at all, but there's no explicit "is Postgres reachable" health check function separate from just running a query).

### 1.4 "Server Resources" panel — REMOVED 2026-08-17 (#133, PR 1 of 3)

This panel (previously permanently hardcoded to `"—"` for CPU/Memory/
Disk/Uptime, described below as "correctly honest" at the time this
audit was written) has been **removed and replaced** with a new
"Containers" panel showing real, live, per-container CPU/memory/network
I/O/status via `ops.health.containers` — see
`docs/design/noc-overview-rebuild-l1-design-2026-08-17.md` for the full
design and `#133` for the tracking issue. This section is left below,
unedited, as a historical record of the panel that no longer exists;
do not use it as a description of the current NOC Overview tab. A full
rewrite of this document to match the rebuilt tab is scoped as part of
`#133`'s PR 3.

Original text (2026-07-26 audit, now historical): CPU (%) / Memory (MB) / Disk (%) / Uptime cards are unconditionally hardcoded to `"—"` in `renderNocResources()` (addon.js:800-804), matching the section copy's own disclaimer: *"Live CPU, memory, and disk metrics require Prometheus bridge (Core R2)."* No fabrication — this panel already does the honest thing. See `docs/tabs/SOC.md` for the real, currently-unused Prometheus stack that could eventually back this.

### 1.5 "Deployment Health" panel (index.html:148-175)

Farm totals, ready/alive counts, connected players, S2S connection counts — all real, sourced from `addonOpsHealthFarms()`'s live query (`duneDb.js`, aggregating `dune.farm_state`). No defects found.

---

## 2. Data flow (current, verified)

```
refreshAll() [addon.js:880]
  → provider.getOpsHealth() [data-providers.js: bridge.getOpsHealth or sample.getOpsHealth]
      → bridge: Promise.all([bridgeRequest("ops.health.summary.v2"), .players, .farms])
      → sample: previewResult(sampleOpsHealth) fixture
  → normalizeOpsHealth(result) [addon.js:258] → snapshot {available, totals, kpis, hasRows, ...}
  → renderOpsAggregate(snapshot, refreshedAt) [addon.js:401] → populates §1.1's 4 cards + Players-tab table
  → renderNocService(provider, snapshot, refreshedAt) [addon.js:788] → populates §1.3's table (defect: see above)
  → renderNocResources(snapshot) [addon.js:800] → populates §1.4's 4 cards (correctly all "—")
```

**Server-side, verified**: `ops.health.summary`/`.v2`/`.players`/`.farms` are handled **only** by `server.js:609`'s addon-bridge action dispatch (`assertInstalledAddonPermission(config, id, "ops:read")`, the path used by installed third-party addons calling `POST /api/addons/bridge` from inside the Console iframe) — confirmed by direct search: these four action strings do not appear anywhere in `routes.js`/`adapter.js` (the Discord bot's adapter). This is a real, important distinction from the other four live actions (`ops.activity.summary` etc.), which *are* reachable both via the addon-bridge (`server.js`) and the Discord adapter (`opsProvider.js`/`routes.js`). In the addon's actual runtime (loaded inside the Console iframe via `web/dune-addon-bridge.js`'s `window.DuneAddon.request()`), this distinction doesn't matter — the addon always goes through the addon-bridge path, never the Discord adapter, regardless of which action it calls. It matters only if someone ever tries to make the Discord *bot* itself report OPS health data — that would require adding `ops.health.*` to `opsProvider.js`/`routes.js`, which does not exist today.

---

## 3. Recommended design changes

1. **Fix or remove the "Service Health Map" panel's mismatch** (§1.3). Two honest options, no in-between:
   - **(a) Rewrite the section copy** to describe what the table actually shows (addon-internal read health, not named infrastructure services) — the cheapest fix, ships today, zero new Core work.
   - **(b) Build the real thing the copy promises** — requires exposing `runningContainerNames()` (or an expanded version covering all 7 named services, verified against the actual `docker-compose.yml` service list) via a new bridge action, then wiring `renderNocService()` to render real per-service up/down rows. Real, buildable, but new scope — not a quick fix.
2. Do not silently leave the mismatch as-is — pick (a) or (b) explicitly; see `docs/prompts/NOC-OVERVIEW.md` for a scoped prompt covering both options with the maintainer choosing which to execute.
