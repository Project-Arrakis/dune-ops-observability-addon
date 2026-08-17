# NOC Overview Rebuild — Per-Container Metrics + Rollup — L1 Design

**Date:** 2026-08-17 | **Repo:** dune-ops-observability-addon
**Requirement 20, Layer 1:** Design audit before implementation
**Prompted by:** user request for a "btop-style" rollup + per-container
metrics board, with container tiles gaining extra metrics based on the
container's role (Postgres containers show DB metrics, RabbitMQ
containers show queue metrics, etc.), on top of the 2026-08-16 bloat/UX
audit (`compliance/eight-hats-findings-register-2026-08-16.md`) that
already recommended rebuilding NOC Overview instead of adding a new tab.

**Supersedes:** nothing directly, but **implements** Finding M-2 and
Recommendation items 2 and 4 of `compliance/
eight-hats-findings-register-2026-08-16.md`, and **executes** what
`docs/design/metrics-l1-design-audit-2026-08-08.md`'s Phase 3 (issue
#93, "NOC Infra tab — live host gauges, container ranking, rabbitmq/
postgres/network health") described in principle, but scoped
narrower — inside the existing NOC Overview tab, not a new one, per
the 2026-08-16 register's explicit decision to stop adding tabs ahead
of finishing existing ones.

## Prerequisites (verified complete before this doc was written)

Both real, load-bearing blockers this design depends on are now
resolved:

1. **`dune-awakening-selfhost-docker#240`** (unscoped, blocking
   `docker stats` exec) — fixed and merged
   (`fix/240-container-health-async-scoped`, PR #244, 2026-08-17).
   `addonOpsContainerHealth()` is now async (`execFile`, not blocking
   `execSync`) and scoped via `docker ps --filter
   label=com.docker.compose.project=<name>` before ever calling
   `docker stats`.
2. **`dune-awakening-selfhost-docker#246`** (raw-`docker run`
   containers had no Compose project label at all) — fixed and merged
   (`fix/246-container-run-labels`, PR #301, 2026-08-17). Every
   container this repo manages via `docker run` (`dune-postgres`,
   `dune-rmq-admin`, `dune-rmq-game`, `dune-director`,
   `dune-text-router`, every `dune-server-*` instance) now carries an
   explicit `com.docker.compose.project=${DUNE_COMPOSE_PROJECT_NAME}`
   label, matching what #240's scoped filter expects. Without this
   fix, #240's own fix would have returned an empty container list for
   exactly the containers this design cares about most (Postgres,
   RabbitMQ) — confirmed via #246's own live evidence before either fix
   shipped.

Both are confirmed merged to `dune-awakening-selfhost-docker`'s `main`
with CI green (`gh run list --branch main` — verified at design-doc
write time, not assumed).

**Still open, does NOT block this design, but scopes what this design
can show today:**
- Per-container CPU/mem via **cAdvisor** remains confirmed broken on
  this stack's Docker/OverlayFS configuration (root-cgroup-aggregate
  only, no per-container `name` label — see `duneDb.js`'s own
  documented finding, re-verified, not re-litigated here). This design
  does **not** depend on cAdvisor for per-container CPU/mem — it uses
  `docker stats` via the now-fixed `addonOpsContainerHealth()` bridge
  action instead, which does not have this limitation.
- cAdvisor-sourced host-level aggregates (`avgCpuPercent`,
  `avgMemoryMb` in `addonOpsPrometheusHealth()`) are unaffected and
  continue to work as today — this design keeps using them for the
  rollup strip's host-level numbers.

## Scope

**In scope:**
1. A rollup strip (fleet-level totals) at the top of a rebuilt NOC
   Overview tab.
2. A per-container grid below it, one tile per container, in the
   addon's existing Spice-Melange-derived card visual language
   (colored accent border by health state, not by faction).
3. A new, reusable "meter" CSS component (horizontal bar, `btop`-style)
   for any bounded 0-100% metric (CPU%, memory%, connection%, fd%).
4. Container **family** detection (generic / postgres / rabbitmq) by
   container name pattern, with family-specific extra metrics appended
   to postgres/rabbitmq tiles only.
5. Removal of the duplicate/dead panels this rebuild naturally
   subsumes: the "Server Resources" panel (permanently `"—"`) and the
   "Service Health Map" defect (#77) — both replaced by the rollup
   strip and the container grid respectively.
6. A short (15s), narrowly-scoped auto-refresh timer for this grid
   only — does not touch the existing manual-refresh-only game-data
   queries (M-3's constraint).

**Out of scope (explicitly, not deferred-and-forgotten):**
- Re-enabling or expanding the Grafana tab (H-3 remains open and
  unrelated to this work).
- Player retention / session-history features (#98/M-4 — separate,
  already-scoped work).
- AAA/AUDIT tab work (issues #94/#95 — still blocked on Core R3). **This
  bullet originally, incorrectly, claimed these tabs were "correctly
  hidden/placeholder per the 2026-08-16 register" -- found false during
  the 2026-08-17 eight-hats review (Finding G-1,
  `compliance/eight-hats-findings-register-2026-08-17.md`): the tabs
  are still visible in primary navigation, unchanged since before the
  2026-08-16 register; only their placeholder body content (not their
  nav visibility) is what the register originally meant by "correctly
  a placeholder." Corrected here rather than silently rewritten, per
  this repo's own no-silent-rewrite convention. See issue #137 for the
  still-open fix to actually hide them.
- Game-server-instance tiles (`dune-server-*`) showing anything beyond
  the generic base metrics — no game-specific Prometheus exporter
  exists for the game server process itself (tick rate, simulation
  FPS — this is 2026-08-07 register's N-1, still an open, unrelated
  Critical gap). A `dune-server-*` tile shows the same generic
  CPU/mem/net/disk-IO/status tile as everything else, honestly, not a
  fabricated "game metrics" section with nothing behind it.

## Data Sources (all already deployed and scraped — nothing new to stand up)

| Metric | Source | Bridge action |
|---|---|---|
| Per-container CPU%, mem, mem limit, net I/O, block I/O, status | `docker stats` + `docker ps`, scoped (post-#240/#246 fix) | `ops.health.containers` (existing, now fixed) |
| Host aggregate CPU%, mem used | node-exporter via Prometheus | `ops.health.prometheus` (existing) |
| Postgres: active connections, max connections, cache hit ratio, deadlocks/5m, `pg_up` | `dune-postgres-exporter` (already deployed, `docker-compose.metrics.yml`) via Prometheus | **new**: `ops.health.postgres` (see below) |
| RabbitMQ: queue depth (ready+unacked), memory % of limit, fd %, `rabbitmq_up`, unroutable rate | `rabbitmq_prometheus` plugin (already enabled on both `dune-rmq-admin`/`dune-rmq-game`, confirmed via `runtime/scripts/start-rabbitmq.sh`) via Prometheus | **new**: `ops.health.rabbitmq` (see below) |

**Hard constraint carried forward from the 2026-08-16 register's H-4
finding, non-negotiable:** RabbitMQ/Postgres health data comes
*exclusively* through the already-loopback-scoped Prometheus exporters
above. **Never** `rabbitmqctl eval`, **never** a new SQL query against
`dune.*` tables, **never** the RabbitMQ management API's queue-contents
endpoints (only counts/rates, which is all the Prometheus plugin
exposes anyway). This is not a preference — the game RMQ instance's
ports are exposed on all interfaces (not `127.0.0.1`-scoped, per the
same finding), so a new, broader query surface against it is a real,
avoidable network-exposure increase; the existing Prometheus path adds
zero new exposure.

### New Core bridge actions (small, additive, PromQL-only)

Both new functions are read-only PromQL scalar/vector queries against
the *already-running* Prometheus instance — no new container, no new
exporter, no new port, no new secret. Modeled directly on the existing
`addonOpsPrometheusHealth()`/`promScalar()` pattern in `duneDb.js` (same
file, same helper reused, not duplicated):

```js
// New in duneDb.js, colocated with addonOpsPrometheusHealth()
export async function addonOpsPostgresHealth(promBaseUrl = ...) {
  // Same "not running" short-circuit as addonOpsPrometheusHealth()
  // reuses metricsStackNotRunning() -- Postgres exporter is part of the
  // same opt-in metrics stack, same operator action (`dune metrics start`)
  // brings it up.
  const up = await promScalar(promBaseUrl, `pg_up`);
  if (up === null) return metricsStackNotRunning();
  const activeConnections = await promScalar(promBaseUrl, `sum(pg_stat_activity_count)`);
  const maxConnections = await promScalar(promBaseUrl, `sum(pg_settings_max_connections)`);
  const cacheHitRatio = await promScalar(promBaseUrl, `100 * (pg_stat_database_blks_hit{datname="dune"} / (pg_stat_database_blks_hit{datname="dune"} + pg_stat_database_blks_read{datname="dune"}))`);
  const deadlocks5m = await promScalar(promBaseUrl, `increase(pg_stat_database_deadlocks{datname="dune"}[5m])`);
  return {
    up: up === 1,
    connections: { active: activeConnections, max: maxConnections },
    cacheHitRatioPercent: cacheHitRatio,
    deadlocksLast5m: deadlocks5m
  };
}

export async function addonOpsRabbitmqHealth(promBaseUrl = ...) {
  const up = await promScalar(promBaseUrl, `min(rabbitmq_up)`); // both instances must be up
  if (up === null) return metricsStackNotRunning();
  // Per-instance breakdown (admin vs game) via the `service` label
  // already attached in prometheus.yml's scrape_configs -- NOT a new
  // label, already exists today.
  const instances = await promVector(promBaseUrl, `rabbitmq_up`); // [{labels:{service:"rabbitmq-admin"}, value:1}, ...]
  const queueDepth = await promScalar(promBaseUrl, `sum(rabbitmq_queue_messages_ready) + sum(rabbitmq_queue_messages_unacked)`);
  const memPercent = await promScalar(promBaseUrl, `100 * max(rabbitmq_process_resident_memory_bytes / rabbitmq_resident_memory_limit_bytes)`);
  const fdPercent = await promScalar(promBaseUrl, `100 * max(rabbitmq_process_open_fds / rabbitmq_process_max_fds)`);
  return {
    instances: instances.map(i => ({ name: i.labels.service, up: i.value === 1 })),
    queueDepth, memPercent, fdPercent
  };
}
```

`promVector()` is a new, small sibling to the existing `promScalar()`
helper (returns `body.data.result` array instead of taking only
`result[0]`) — needed because RabbitMQ health is naturally per-instance
(two brokers), unlike every existing `promScalar()` caller which
already reduces to one number. Exact same error handling (`try {...}
catch { return null }`) as the existing helper — no new failure mode.

## UI Design

### Layout (replaces current NOC Overview tab body; other 13 tabs
untouched)

```
┌─ Rollup Strip (existing summary-grid pattern, kept) ──────────────┐
│ [Containers Up/Total] [Fleet CPU%] [Fleet Mem] [Host CPU%] [Host Mem] │
└────────────────────────────────────────────────────────────────────┘

┌─ Container Grid (NEW — replaces "Server Resources" +               │
│  "Service Health Map" panels) ──────────────────────────────────────┐
│                                                                       │
│  ┌─[dune-postgres]──────┐  ┌─[dune-rmq-admin]─────┐  ┌─[dune-rmq-game]──┐
│  │ ● healthy             │  │ ● healthy             │  │ ⚠ degraded        │
│  │ CPU  [███░░░░░] 34%   │  │ CPU  [█░░░░░░░]  8%   │  │ CPU  [██████░] 71%│
│  │ Mem  [████░░░░] 512MB │  │ Mem  [██░░░░░░] 128MB │  │ Mem  [███████] 1.2GB│
│  │ Net  ↓12KB/s ↑4KB/s   │  │ Net  ↓2KB/s ↑1KB/s    │  │ Net  ↓340KB/s ↑88KB/s│
│  │ ── Postgres ──        │  │ ── RabbitMQ ──        │  │ ── RabbitMQ ──    │
│  │ Connections [██░] 18/100│ │ Queue depth: 42      │  │ Queue depth: 1,842│
│  │ Cache hit: 98.2%      │  │ Mem limit  [█░░] 12%  │  │ Mem limit [██████]82%│
│  │ Deadlocks(5m): 0      │  │ FD usage   [░░░]  4%  │  │ FD usage  [███░░] 41%│
│  └───────────────────────┘  └───────────────────────┘  └───────────────────┘
│                                                                       │
│  ┌─[dune-server-survival-1]┐  ┌─[redblink-dune-docker-console]┐ ...  │
│  │ ● healthy                │  │ ● healthy                      │      │
│  │ CPU  [████░░░] 52%       │  │ CPU  [█░░░░░░]  6%              │      │
│  │ Mem  [██████░] 3.8GB     │  │ Mem  [██░░░░░] 210MB            │      │
│  │ Net  ↓1.2MB/s ↑890KB/s   │  │ Net  ↓8KB/s ↑3KB/s              │      │
│  │ (generic tile — no game-process metrics exist yet, N-1)       │      │
│  └───────────────────────────┘  └────────────────────────────────┘      │
└──────────────────────────────────────────────────────────────────────┘
```

### Container → family mapping (name-pattern based, not image-based)

Rationale for name-pattern over image-tag matching: container names in
this repo are a stable, already-documented contract (`dune-postgres`,
`dune-rmq-*`, per every orchestration script) — image tags vary by
Funcom's own versioning (`igw-postgres:${TAG}`, `seabass-server-
rabbitmq:${TAG}`) and change on every game update. Matching on name is
one regex per family, is unaffected by image-tag churn, and reads
directly off data `ops.health.containers` already returns
(`c.name`) with zero additional bridge round-trip.

```js
// New in web/addon.js
const CONTAINER_FAMILY_PATTERNS = [
  { family: "postgres", pattern: /^dune-postgres$/ },
  { family: "rabbitmq", pattern: /^dune-rmq-(admin|game)$/ }
  // everything else (console, orchestrator, metrics stack containers,
  // dune-director, dune-text-router, every dune-server-* instance)
  // falls through to "generic" -- deliberately not special-cased,
  // since no per-role metrics exist for them today (see Out of Scope).
];

function containerFamily(name) {
  const match = CONTAINER_FAMILY_PATTERNS.find(p => p.pattern.test(name));
  return match ? match.family : "generic";
}
```

### Health-state thresholds (color-coding)

Per direct user decision: **reuse the exact numeric thresholds already
defined in `runtime/metrics/rules/*.yml`** — a yellow tile and a real
Alertmanager warning fire at the same point, so the addon's visual
language never contradicts what actually pages an operator.

| Metric | Warn (yellow) | Critical (red) | Source rule |
|---|---|---|---|
| Postgres connections % | >80% | >95% | `DunePostgresHighConnections`/`DunePostgresCriticalConnections` |
| Postgres cache hit ratio | <95% | *(no critical tier defined upstream — yellow only)* | `DunePostgresLowCacheHitRatio` |
| RabbitMQ memory % of limit | >80% | *(no critical tier defined upstream — yellow only)* | `DuneRabbitMQHighMemory` |
| RabbitMQ fd % | >80% | *(no critical tier defined upstream — yellow only)* | `DuneRabbitMQHighFileDescriptors` |
| RabbitMQ queue backlog (ready or unacked) | >1000 | *(no critical tier — yellow only)* | `DuneRabbitMQQueueBacklog`/`DuneRabbitMQUnackedBacklog` |
| Container memory % of its own limit | >90% | *(no critical tier — yellow only)* | `DuneContainerHighMemory` |
| Host CPU % | >85% | *(no critical tier — yellow only)* | `DuneHostHighCpu` |
| Host available memory | *(n/a — absolute threshold, not %)* | <2GiB | `DuneHostLowAvailableMemory` |

Where an alert rule has no critical tier defined (most of them — the
existing rules are deliberately conservative, warning-only), the UI
also has no critical/red tier for that metric — this design does not
invent a threshold the alerting system itself does not have an
opinion on. `pg_up == 0` / `rabbitmq_up == 0` map directly to a tile's
top-level health dot (red/"down"), not a bar.

Every bar pairs its color with a text value (e.g. `34%`, `512MB`) and
the tile's health dot separately carries a text-equivalent state
(`healthy`/`degraded`/`down`), addressing the 2026-08-16 audit's
color-only-signal finding for the freshness badges — this component
does not repeat that mistake.

### New CSS component: `.meter`

```css
/* web/addon.css -- new component, no existing bar/gauge primitive to
   extend (confirmed: zero canvas/chart/progress-bar code exists
   anywhere in this addon before this design). Pure CSS, no JS
   animation library, no canvas -- CSP is script-src 'self' with no
   external script origins, and this stays that way. */
.meter {
  position: relative;
  height: 8px;
  border-radius: var(--radius-sm);
  background: var(--surface-1);
  overflow: hidden;
}
.meter__fill {
  height: 100%;
  border-radius: inherit;
  transition: width var(--transition-base);
  /* width set inline per-instance via style.width, same existing
     CSP-allowed inline-style pattern web/addon.js already uses for
     the spice-field color-coded cards (index.html's own CSP comment
     already documents and justifies this). */
}
.meter__fill--ok   { background: var(--status-ok, #4ade80); }
.meter__fill--warn { background: var(--status-warn, #fbbf24); }
.meter__fill--crit { background: var(--status-crit, #f87171); }
```

Reuses this addon's existing design-token base (`--surface-1`,
`--radius-sm`, `--transition-base` already exist per the earlier bloat
audit's finding that the token system itself is cohesive) rather than
inventing new hardcoded values — the earlier audit's complaint was
about *inconsistent, non-token-driven overrides bolted on later*, not
about the token system itself; this component follows the token
system rather than repeating that mistake.

### Container tile markup pattern (reuses `renderInstanceCard()`'s
structure from Spice Melange, per direct user/register agreement that
this is the addon's best existing visual pattern)

```js
// New in web/addon.js, modeled directly on renderInstanceCard()
function renderContainerTile(container) {
  const family = containerFamily(container.name);
  const card = document.createElement("article");
  card.className = `container-tile container-tile--${healthClass(container)}`;
  // header: name + health dot (same pattern as res-instance-header +
  // combat badge, just health-state vocabulary instead of PvP/PvE)
  // ...base meters: CPU%, Mem (with meter relative to memLimit), Net I/O, Block I/O
  // ...if family !== "generic": append family-specific meters/fields
  //    (postgres: connections meter + cache-hit text + deadlocks text;
  //     rabbitmq: queue-depth text + mem-limit meter + fd meter)
  return card;
}
```

No new DOM-construction pattern — this reuses the same
`document.createElement`/explicit-property pattern used throughout
`addon.js` today (no `innerHTML`, consistent with the existing CSP/
test-enforced convention noted in `index.html`'s own CSP comment).

## Auto-Refresh Scope (addressing M-3's constraint directly)

**Explicitly, only this grid's own bridge actions
(`ops.health.containers`, `ops.health.postgres`, `ops.health.rabbitmq`,
`ops.health.prometheus`) get a 15s auto-refresh timer.** This is safe
because:
- `ops.health.containers` shells out to `docker ps`/`docker stats`
  (post-#240 fix: async, scoped, ~5s timeout) — not a database query.
- `ops.health.postgres`/`ops.health.rabbitmq` are PromQL reads against
  Prometheus's own already-aggregated time-series data, not the live
  `dune` database — they add zero load to the actual game database.
- `ops.health.prometheus` already exists and is unchanged.

**Every other tab's existing queries (`addonOpsActivitySummary`,
`addonOpsInventorySummary`'s expensive `LATERAL` join, etc.) remain
manual-refresh-only, exactly as M-3 requires.** This design adds a
timer to a strictly new, strictly Docker/Prometheus-only code path; it
does not touch or loosen the existing manual-refresh safety property
for any `dune.*`-table-querying route.

## Migration / Rollout

- **Additive on the Core side**: two new exported functions in
  `duneDb.js`, two new bridge action registrations in `routes.js`
  (`ops.health.postgres`, `ops.health.rabbitmq`) alongside the existing
  `ops.health.prometheus`/`ops.health.containers`. No schema change, no
  new env var (reuses `METRICS_PROMETHEUS_URL`/`METRICS_PROMETHEUS_PORT`,
  already used by `addonOpsPrometheusHealth()`).
- **Additive on the addon side**: new `getContainerHealth()`/
  `getPostgresHealth()`/`getRabbitmqHealth()` provider methods
  (`web/data-providers.js`, following the exact existing
  `fetchLiveOrUnavailable()` pattern — `unavailable` when the metrics
  stack isn't running, same as every other Prometheus-fed panel today).
- **Destructive only for dead code**: removes the "Server Resources"
  panel's markup (`index.html:151-178`, permanently `"—"` today) and
  the "Service Health Map"/"Bridge & Data Sources" panels
  (`index.html:114-149`) that #77 already identified as broken —
  replaced by the rollup strip + container grid respectively. No
  currently-working feature is removed; only panels already confirmed
  broken/dead by the prior audit.
- **Update path for existing installs**: an operator not running the
  optional metrics stack sees the exact same "run `dune metrics start`"
  empty-state pattern already used everywhere else in this addon today
  (`noc-metrics-cta`) — no behavior change for that population beyond
  the panel layout itself.
- **Rollback**: revert the addon version; no data migration, no schema
  change on either repo to undo.

## Implementation Sequencing (per direct user decision: 3 PRs, not 1)

1. **PR 1 — `.meter` CSS component + generic container tile.** Wires
   `ops.health.containers` (already fixed, already merged) into a new
   container grid on NOC Overview, generic tiles only (CPU/mem/net/
   block-IO/status), no family-specific extensions yet. Removes the
   dead "Server Resources" panel. This alone already delivers "per-
   container, individually" for every container, using real,
   previously-orphaned backend data.
2. **PR 2 — Postgres/RabbitMQ family extensions.** Adds
   `addonOpsPostgresHealth()`/`addonOpsRabbitmqHealth()` to Core,
   `getPostgresHealth()`/`getRabbitmqHealth()` to the addon, and the
   family-detection + extra-metrics-append logic to the tile renderer.
3. **PR 3 — Rollup strip + cleanup.** Adds the fleet-level rollup strip
   (containers up/total, fleet CPU/mem, host CPU/mem), removes the
   "Service Health Map"/"Bridge & Data Sources" panels (#77's fix,
   folded in here since the rollup strip is its replacement), adds the
   15s auto-refresh timer scoped to this grid only, updates
   `docs/tabs/NOC-OVERVIEW.md` to match the rebuilt tab.

Each PR is independently mergeable and independently reverts cleanly;
PR 2 and 3 both depend on PR 1's tile-rendering scaffold but not on
each other's new data (PR 3's rollup strip only needs data PR 1 and
the pre-existing `ops.health.prometheus` already provide).

## Eight Hats Summary (Layer 1)

- **Architect**: Reuses three already-established patterns (Spice
  Melange's card structure, the existing `fetchLiveOrUnavertable()`/
  `SourceResult` envelope, the existing `promScalar()` helper) instead
  of inventing new ones. Net reduction in panel count on this one tab
  (2 dead panels removed, 1 new grid added, 1 rollup strip replaces
  what 2 panels used to attempt).
- **Security**: No new attack surface — no new container, no new
  network exposure, no new secret. The one real security-relevant
  dependency (unscoped `docker stats`) is fixed and merged *before*
  this design's UI work begins, not after, per the register's own H-1
  ordering requirement.
- **GRC**: This document is the audit trail; each of the 3 sequenced
  PRs will carry its own real test/security-check output per
  Requirement 19(g)'s body structure (even though these are internal,
  not upstream, PRs — same discipline applied consistently).
- **Network**: Zero new ports/binds. RabbitMQ health explicitly stays
  on the existing Prometheus path per H-4, not the broader, exposed
  management API.
- **Cloud Security**: N/A — no cloud provider/IAM component.
- **UI/Design**: Directly implements the register's own "best existing
  visual pattern, reused" recommendation; every bar pairs color with
  text (no color-only signal); thresholds match real alerting, so the
  UI never silently disagrees with what pages an operator.
- **DBA**: Zero new queries against `dune.*` (game) tables. Postgres
  health comes from `postgres_exporter`'s own already-running
  read-only stats collection, not a new query this addon or Core
  issues directly.
- **QA/Test**: Each of the 3 PRs must independently pass this repo's
  full test suite plus new tests for its own new provider method(s)/
  render function(s), following this repo's existing per-function test
  granularity (see `test/adapterClient.test.js`'s sibling-project
  precedent... er, this repo's own `test/*.test.js` convention).

## Open Questions for Implementation (not blocking this design's
approval, but must be resolved during PR 1/2)

1. Exact `container-lifecycle` CI job (Core repo) coverage for the two
   new bridge actions — should mirror the existing
   `containerHealth.test.js` pattern (dependency-injected `run()`,
   no real Docker/Prometheus needed in unit tests).
2. Whether `dune-cadvisor`/`dune-prometheus`/`dune-grafana`/
   `dune-alertmanager`/`dune-node-exporter` (the metrics-stack's own
   containers) should appear in the container grid at all, or be
   filtered out as "meta" (monitoring the monitors). Leaning toward
   **include them** (they're real containers with real resource use,
   filtering them out would be exactly the kind of "hide data the
   operator might want" this whole redesign is trying to avoid) but
   deferring the final call to PR 1's implementation, where the real
   list of returned container names can be inspected directly.
