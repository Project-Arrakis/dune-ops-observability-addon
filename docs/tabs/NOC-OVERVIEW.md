# Tab Architecture — NOC Overview

**Data-tab attribute**: `overview` (default-active tab)
**HTML**: `web/index.html` (overview tab body, `data-tab="overview"`)
**Rebuilt**: 2026-08-17, issue `#133` — see
`docs/design/noc-overview-rebuild-l1-design-2026-08-17.md` for the full
design and `compliance/eight-hats-findings-register-2026-08-16.md` for
the audit that scoped it. This document was fully rewritten alongside
that rebuild (PR 3 of 3) to match the tab's real, current state —
everything below describes the tab as of that rebuild, not the
pre-2026-08-17 tab.

**Render entry points**: `refreshAll()` (initial full load) and
`_refreshTab("overview")` (tab-aware lazy load, same render functions)
both call:
- `renderOpsAggregate()` — OPS health totals
- `renderSystemServicesTable()` — Prometheus target status
- `renderPrometheus()` — Metrics-tab-shared Prometheus health card
- `renderFarmSummary()` — farm/population totals
- `renderContainerGrid()` — per-container resource tiles
- `renderFleetRollup()` — fleet-level rollup strip

---

## 1. Current implementation (verified against the rebuilt tab)

Six panels, top to bottom:

### 1.1 "OPS health totals" summary grid

Four cards: Players / Online / Offline / Farm Sites. Populated by
`renderOpsAggregate()` from `normalizeOpsHealth(opsHealth)`'s `.totals`
object (`ops.health.summary.v2` + `.players` + `.farms`, real and live).
Unchanged by the 2026-08-17 rebuild.

**Known, deliberately-out-of-scope overlap**: the Players tab's own
table duplicates these same 4 numbers — documented in
`docs/tabs/PLAYERS.md`, not re-litigated here.

### 1.2 "Data Freshness & Reliability" panel

Four cards: Source Health / Freshness / Aggregate Impact / Operator
Status — addon-internal bookkeeping about the *addon's own read
health* (staleness threshold, player-count delta since last refresh),
not about the game server itself. Unchanged by the rebuild.

### 1.3 "System Services" panel

Prometheus target up/down status (`renderSystemServicesTable()`),
sourced from `ops.health.prometheus`'s real `/api/v1/targets` scrape.
Unchanged by the rebuild, other than no longer being called from the
now-removed `renderNocService()` wrapper (see §1.4 below) — it's
invoked directly from both render entry points now.

### 1.4 "Bridge & Data Sources" panel — REMOVED 2026-08-17 (issue #77, fixed)

**This panel no longer exists.** It previously showed 5 addon-internal
bookkeeping rows ("OPS Health Bridge", "Player Aggregate", "Farm
Aggregate", "Data Freshness", "Provider Mode") under a heading whose
own section copy promised named infrastructure services ("Postgres,
RabbitMQ, Director, Gateway, Survival_1, Overmap, TextRouter") — issue
#77's real, previously-open defect.

**Resolution: Option B** (per #77's own two documented options) — the
real thing the copy promised was built, not just relabeled. The
Containers panel (§1.5) now shows real, live, per-container status for
every container this deployment manages, including `dune-postgres` and
`dune-rmq-admin`/`dune-rmq-game` — this supersedes the removed panel's
unfulfillable promise with actual data. The Fleet Overview panel
(§1.6) gives the "one number, rolled up" view the removed panel never
actually provided either.

### 1.5 "Containers" panel (added #133, PR 1 of 3)

One tile per container `ops.health.containers` returns, scoped to this
project's own containers only (`com.docker.compose.project` label
match — `dune-awakening-selfhost-docker#240`/`#246`). Every tile shows
CPU%, memory used/limit (with a `.meter` bar), network I/O, disk I/O,
and a health-state dot derived from the container's real status string.

**Family-specific extra metrics** (added #133, PR 2 of 3):
`dune-postgres` tiles additionally show connections (active/max, warn
>80%/crit >95%, matching `DunePostgresHighConnections`/
`DunePostgresCriticalConnections`), cache hit ratio (flagged below 95%,
matching `DunePostgresLowCacheHitRatio`), and deadlocks in the last 5
minutes (flagged on any increase, matching `DunePostgresDeadlocks`).
`dune-rmq-admin`/`dune-rmq-game` tiles additionally show broker
up/down state (per-instance, not just an aggregate), queue depth
(ready + unacked, flagged above 1000, matching
`DuneRabbitMQQueueBacklog`/`UnackedBacklog`), memory % of limit (warn
>80%, matching `DuneRabbitMQHighMemory`), and file-descriptor % of
limit (warn >80%, matching `DuneRabbitMQHighFileDescriptors`).

Container → family detection is by container **name** pattern
(`dune-postgres`, `dune-rmq-(admin|game)`), not image tag — see the L1
design doc for why. Every other container (`dune-server-*`, the
console, orchestrator, and metrics-stack containers) gets the generic
tile only — no game-process metrics exist yet for them
(2026-08-07 register's N-1, still an open, unrelated gap).

**Threshold provenance**: every warn/crit threshold above is copied
verbatim from `runtime/metrics/rules/postgres.yml`/`rabbitmq.yml`'s own
Alertmanager rule expressions (pinned by a regression test in
`dune-awakening-selfhost-docker`'s `postgresHealth.test.js`/
`rabbitmqHealth.test.js`) — a tile's color never disagrees with what
would actually page an operator.

### 1.6 "Fleet Overview" panel (added #133, PR 3 of 3)

Five cards: Containers Up (X / total), Fleet CPU (sum across every
container), Fleet Memory (sum, human-scaled via `formatBytesHuman()`),
Host CPU, Host Memory (both from `ops.health.prometheus`, also
human-scaled — this fixes a real, previously-reported bloat finding:
the pre-rebuild tab showed raw unformatted MB integers, e.g. "16384 MB"
instead of "16.4 GB"). Fleet CPU/memory are derived from the exact same
per-container data the Containers panel (§1.5) renders below it — not
a separately computed, potentially-drifting number.

### 1.7 "Farm & Population Summary" panel

Farm totals, ready/alive counts — real, sourced from
`addonOpsHealthFarms()`'s live query, unchanged. Its own render
function was split out of the old, now-removed `renderNocResources()`
into a dedicated `renderFarmSummary()` during PR 1 of the rebuild (the
CPU/mem/disk/uptime half of that old function was the dead panel
replaced by §1.5/§1.6).

**Connected Players and S2S Connections were fixed 2026-08-17 (issue
#139).** This section previously, incorrectly, claimed these two
fields were already "real, sourced from a live query" — they were
not: `normalizeOpsHealth()` never extracted `connectedPlayers`/
`incomingS2SConnections`/`outgoingS2SConnections` from Core's response
at all (a field-name casing mismatch — the addon read lowercase
`incomingS2s`, Core returns capital-S2S `incomingS2SConnections`), so
"Connected Players" silently displayed `totals.online` (a real, but
different and unrelated, number) and "S2S Connections" showed a
permanent dash on every install, indistinguishable from an honest
absence of data. Both are now correctly wired to Core's real, live
`addonOpsHealthFarms()` fields, with an honest dash shown only when
Core's payload genuinely omits them (e.g. an older Core version).

---

## 2. Auto-refresh (added #133, PR 3 of 3)

The Containers panel (§1.5) and Fleet Overview panel (§1.6), plus the
System Services panel (§1.3), auto-refresh every 15 seconds
(`AUTO_REFRESH_INTERVAL_MS`) **while the Overview tab is the active
tab** — via `_autoRefreshOverview()`, which calls exactly four provider
methods (`getContainerHealth`, `getPostgresHealth`, `getRabbitmqHealth`,
`getPrometheusHealth`) and nothing else.

**Every other panel/tab remains manual-refresh-only**, per the
2026-08-16 register's M-3 finding: several existing queries
(`addonOpsActivitySummary`, `addonOpsInventorySummary`'s `LATERAL`
join) are full-table-scan/multi-join against `dune.*` game tables and
were only ever safe because nothing calls them on a timer. The
auto-refresh timer's four sources are Docker (`docker ps`/`docker
stats`, async+scoped since `#240`/`#246`) and Prometheus PromQL reads
against already-aggregated time-series data — never the live game
database — so this timer does not reintroduce that risk.

The timer only starts inside a real Console iframe (`window.parent !==
window`) — never in direct-browser preview mode, and never in this
repo's own jsdom-based test harness (which has no parent window
either, for the same reason). `window.DuneOpsAutoRefresh` exposes
`stop()`/`isRunning()`/`triggerNow()` for tests and for any future
manual-control need.

---

## 3. Data flow (current, verified)

```
refreshAll() / _refreshTab("overview")
  → provider.getOpsHealth() → renderOpsAggregate() → §1.1, §1.7 (partial)
  → provider.getPrometheusHealth() → renderSystemServicesTable() → §1.3
                                    → renderPrometheus() → shared Metrics-tab-style card
  → provider.getContainerHealth() ┐
  → provider.getPostgresHealth()  ├→ renderContainerGrid() → §1.5
  → provider.getRabbitmqHealth()  ┘
  → renderFleetRollup(containerResult, prometheusResult) → §1.6
  → renderFarmSummary(opsHealthSnapshot) → §1.7
```

**Server-side, verified**: `ops.health.*` actions are handled by
`server.js`'s addon-bridge dispatch (`assertInstalledAddonPermission
(config, id, "ops:read")`) — the path used by installed third-party
addons calling `POST /api/addons/bridge` from inside the Console
iframe. `ops.health.postgres`/`ops.health.rabbitmq` (new in this
rebuild) follow the identical pattern as the pre-existing
`ops.health.prometheus`/`ops.health.containers`.

---

## 4. Historical record (pre-rebuild panels, for context only)

The pre-2026-08-17 version of this tab had a "Service Health Map"
panel with a broken promise (issue #77) and a "Server Resources" panel
permanently hardcoded to `"—"` — both fully described in this
document's git history prior to the 2026-08-17 rewrite commit, if that
history is ever needed. Do not resurrect that text here; it describes
a tab that no longer exists.
