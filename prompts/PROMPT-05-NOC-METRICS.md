# PROMPT: NOC Metrics — Network Operations Center Gap Implementation

**Severity:** CRITICAL + HIGH | **Domain:** NOC  
**Repository:** `dune-ops-observability-addon` + `dune-awakening-selfhost-docker` (Core)  
**Timeout estimate:** 6-10 hours

## Context

NOC metrics answer: "is the service healthy right now?" The addon currently
depends on an optional Prometheus stack (`dune metrics start`) for host-level
telemetry and has no visibility into the game server's actual performance.
Two metrics are Critical — server tick rate and per-service RED metrics —
and must be implemented first.

## Task 1: Server Tick Rate / Simulation FPS (N-1) — CRITICAL

**What's needed:** A direct game-server performance indicator. If the game
simulation is lagging, nothing in this addon surfaces it. This is the single
most important NOC metric for any game server.

**Core side (dune-awakening-selfhost-docker):**
- Investigate: the Director container (`dune-director`) emits server state
  logs that may include simulation performance data. Check the Director's
  log output or the `dune status` output for tick rate / simulation speed
  information.
- If available via Docker logs: write `addonOpsServerPerformance(db)` that
  parses recent Director/game-server container logs for tick rate data.
  The autoscaler already scans Director logs — use the same log-reading
  pattern from `runtime/scripts/autoscaler.sh`.
- If available via the database: check `dune.farm_state` or similar tables
  for performance metrics.
- If unavailable: document as a known gap. Add a "Server Performance" card
  that shows "—" with a note: "Server tick rate monitoring requires Core
  R3 (game-server performance telemetry)."
- Return shape: `{ tickRate, simSpeed, status: "ok"|"degraded"|"unavailable" }`

**Addon side:**
- Add a prominent "Server Performance" card to the NOC Overview tab, above
  Server Resources
- Show: tick rate (Hz), simulation speed (1.0x = normal, <0.8x = warning,
  <0.5x = critical), status indicator
- Color-code: green (>0.9x), amber (0.7-0.9x), red (<0.7x)

**Verification:**
- Core: `node --test` confirms the new bridge action
- Addon: behavioral test with fixture data for ok/degraded/unavailable states
- Manual: `dune status` or Director logs show tick rate data

## Task 2: Per-Service RED Metrics (N-2) — CRITICAL

**What's needed:** Request Rate, Error Rate, Duration (latency) for each
service endpoint — Console API, game server API, database. Currently the
SOC tab shows aggregate bridge request/error counts only.

**Core side:**
- The SOC tab already tracks bridge request/error counts. Expand this to
  per-service granularity.
- The `ops.soc.summary` bridge action returns `{ bridgeRequests, bridgeErrors }`
  (aggregate). Expand to return per-service breakdowns:
  ```json
  {
    "services": [
      { "name": "console-api", "requests": 1523, "errors": 3, "latencyP50": 12, "latencyP99": 145 },
      { "name": "game-server", "requests": 8901, "errors": 0, "latencyP50": 8, "latencyP99": 67 },
      { "name": "database", "requests": 4523, "errors": 0, "latencyP50": 3, "latencyP99": 28 }
    ],
    "windowSeconds": 3600
  }
  ```
- Track in-memory counters (the rate limiter already does this pattern).
  Reset counters on interval (hourly). Compute error rate = errors/requests.

**Addon side:**
- Add a "Service RED Metrics" table to the NOC Overview tab
- Rows: service name, request rate (/min), error rate (%), p50 latency (ms),
  p99 latency (ms)
- Color-code error rates: green (<1%), amber (1-5%), red (>5%)
- Show the collection window ("Last 60 minutes")

## Task 3: Real-Time Host Resources Without Prometheus (N-3) — HIGH

**What's needed:** The NOC Overview's Server Resources section (CPU/Memory/
Disk/Uptime) shows "—" unless the optional Prometheus stack is running.
For operators who haven't run `dune metrics start`, this entire section is
blank. Provide a basic, always-available fallback.

**Core side:**
- Use `os` module in Node.js to read basic host metrics directly:
  - CPU: `os.loadavg()` for 1/5/15-minute load averages
  - Memory: `os.totalmem()` / `os.freemem()` for usage %
  - Disk: `df` equivalent via `child_process.execSync('df -h /')` or
    `fs.statvfs()` for usage %
  - Uptime: `os.uptime()` for system uptime
- Wrap in a new bridge action: `ops.health.host` returning basic metrics
  without requiring Prometheus
- Document that these are basic host-level metrics, not per-container
  breakdowns. Prometheus provides the detailed breakdown.

**Addon side:**
- Update the Server Resources section in NOC Overview to use `ops.health.host`
  as the primary data source
- When Prometheus is available, ALSO show the Prometheus data (more detailed)
- When neither is available, show the explicit "Metrics stack not running"
  message (current behavior)

## Task 4: Remaining NOC Metrics

| # | Metric | Priority | Approach |
|---|---|---|---|
| N-4 | Service dependency health map | High | Add a `dune services` bridge action. Already exists in Core — map it to a bridge action with `ops:read` permission. Show per-service up/down status in a dependency map card on NOC Overview. |
| N-5 | Database health (slow queries, vacuum) | High | Core already runs Postgres. Add `addonOpsDatabaseHealth()` that queries `pg_stat_user_tables`, `pg_stat_activity`. Show: connection count, slow query count (>1s), last vacuum, table bloat. |
| N-6 | SLO/SLI dashboard | Medium | Core R5 dependency. Document as deferred. |
| N-7 | Alertmanager integration | Medium | Core R2 dependency. If Prometheus is running, query Alertmanager API for active alerts. |
| N-8 | Container health | Medium | Use `docker ps` output via Core's existing Docker API access. Show per-container status, restart count (from `docker inspect`), uptime. |
| N-9 | Network I/O | Low | `os.networkInterfaces()` or `/proc/net/dev` for basic byte counters. |
| N-10 | Log error rate | Low | Parse recent Director/game-server logs for ERROR/WARN lines per minute. Use same log-reading pattern as autoscaler. |

## State After Completion

For EACH Critical/High metric (N-1 through N-5):
- [ ] Core-side bridge action or expanded existing action
- [ ] Unit test in Core with mock data
- [ ] Addon-side provider method + renderer + behavioral test
- [ ] Bridge action listed in README table
- [ ] SourceResult envelope respected (live/unavailable/preview)
- [ ] All existing tests pass

N-1 (tick rate) is the most important — implement it first even if it
surfaces as "not yet available" (honest design). The fact that the metric
IS tracked and shows "unavailable" is better than not asking for it at all.
