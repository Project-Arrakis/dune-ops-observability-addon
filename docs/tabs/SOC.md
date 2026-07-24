# Tab Architecture — SOC (SOC Operations Center + Metrics Health / Prometheus)

**Data-tab attribute**: `soc`
**HTML**: `web/index.html:569-642` (two panels: "SOC Operations Center" and "Metrics Health")
**Render entry points**: `refreshAll()` → `renderSoc(result)` (`web/addon.js:815`), `renderPrometheus(result)` (`web/addon.js:832`)
**Bridge actions**: `ops.soc.summary` and `ops.health.prometheus` — **neither implemented**; both `opsSocProvider`/`opsPrometheusProvider` return `opsPlaceholder(...)`.

This tab has two genuinely different sub-problems with two different real (partial) answers.

---

## 1. Current implementation (verified) — correctly renders unavailable; no fabrication risk

Both `renderSoc()` (`addon.js:815-830`) and `renderPrometheus()` (`addon.js:832-863`) correctly follow the `SourceResult` contract. No rendering changes needed regardless of what §2-4 conclude.

## 2. What the addon currently assumes exists

```js
const sampleSoc = {
  platformHealth, bridgeRequests, bridgeErrors, bridgeSuccessRate,
  dataFreshness, timestamp, health, activity, economy, combat, resources, inventory, location
  // (the last several fields are just re-embedding other tabs' sample data — see §5's note on this)
};
const samplePrometheusHealth = {
  healthy, targets: {active, inactive, pending, total},
  services: { "dune-prometheus": "up", "dune-node": "up", ... },
  summary: { avgCpuPercent, avgMemoryMb, totalRestarts }
};
```

## 3. `ops.soc.summary` — real, but requires a different implementation shape than every other action

**No aggregate query exists for `bridgeRequests`/`bridgeErrors`/`bridgeSuccessRate`.** But a real, complete, per-request audit trail exists: every addon-bridge call is logged via `audit(config, req, "addons.bridge", {id, action, permission, ok: true|false, ...})` (`server.js:606` et al.) to an append-only JSONL file at `config.auditLog` (`runtime/generated/web-admin-audit.jsonl`, `config.js:36`).

**This is a genuinely different implementation shape from every other `addonOps*` function** — it requires reading and parsing a log file (filtering by `action === "addons.bridge"` and a rolling time window, e.g. the last hour), not writing a SQL query against `db`. Concretely:

```js
export async function addonOpsSocSummary(auditLogPath, windowMs = 60 * 60 * 1000) {
  let lines;
  try {
    lines = (await readFile(auditLogPath, "utf8")).split("\n").filter(Boolean);
  } catch {
    return { platformHealth: "Unknown", bridgeRequests: null, bridgeErrors: null, bridgeSuccessRate: null };
  }
  const cutoff = Date.now() - windowMs;
  let requests = 0, errors = 0;
  for (const line of lines) {
    let row;
    try { row = JSON.parse(line); } catch { continue; }
    if (row.action !== "addons.bridge") continue;
    if (new Date(row.timestamp).getTime() < cutoff) continue;
    requests++;
    if (row.detail?.ok === false) errors++;
  }
  return {
    platformHealth: requests === 0 ? "Unknown" : errors / requests > 0.1 ? "Degraded" : "Healthy",
    bridgeRequests: requests,
    bridgeErrors: errors,
    bridgeSuccessRate: requests > 0 ? Math.round(((requests - errors) / requests) * 100) : null
  };
}
```

**This sketch is illustrative and unverified against a real, populated audit log** — line-by-line parsing of a potentially large file on every request is a real performance consideration for a busy server (an hour of high bridge traffic could mean thousands of lines to scan per SOC-tab refresh); a production version should likely track a small in-memory rolling counter updated at `audit()`-call time instead of re-parsing the file from scratch each time, or bound how far back it reads (e.g., only the last N KB of the file via a reverse read). This needs real design work, not just a query, before shipping.

## 4. `ops.health.prometheus` — real, deployable, currently-unused, and conditional

**A complete Prometheus + cAdvisor + node-exporter + postgres-exporter stack already exists** (`docker-compose.metrics.yml`, verified in full in `docs/DESIGN-REVIEW-2026-07-23.md` §3.9) but is deliberately opt-in (`dune metrics start`), bound to `127.0.0.1:9090`. `runtime/scripts/metrics-stack.sh` already makes and parses exactly the HTTP calls needed:

- `GET http://127.0.0.1:9090/-/healthy` — Prometheus's own health check.
- `GET http://127.0.0.1:9090/api/v1/targets` — returns `{data: {activeTargets: [{labels, health, ...}]}}`, directly mappable to the sample fixture's `targets: {active, inactive, pending, total}` and `services: {name: "up"/"down"}` (group `activeTargets` by `labels.job`, map `health` field).
- `GET http://127.0.0.1:9090/api/v1/query?query=...` — real PromQL, e.g. `avg(rate(container_cpu_usage_seconds_total{name=~"dune-.*"}[5m])) * 100` for `avgCpuPercent`, using the exact metric names already defined in `runtime/metrics/rules/containers.yml` (`container_memory_working_set_bytes`, `container_spec_memory_limit_bytes`, `container_last_seen`, etc.).

**Critical precondition that must be checked and honestly reported**: this data only exists if the operator has run `dune metrics start`. A correct implementation must first check whether Prometheus is actually reachable (e.g., attempt `/-/healthy` with a short timeout) and return a new, distinct `unavailable` reason (e.g., `"metrics_stack_not_running"`) if it isn't — **never assume the stack is running and silently fail into a generic error**, and never treat "stack not running" the same as "not implemented," since they're different, both-real, both-honest states an operator would want to distinguish (one means "this feature doesn't exist yet," the other means "turn on a thing you already have").

```js
export async function addonOpsPrometheusHealth(promBaseUrl = "http://127.0.0.1:9090") {
  let healthy;
  try {
    const res = await fetch(`${promBaseUrl}/-/healthy`, { signal: AbortSignal.timeout(2000) });
    healthy = res.ok;
  } catch {
    return { status: "unavailable", reason: "metrics_stack_not_running" };
  }
  const targetsRes = await fetch(`${promBaseUrl}/api/v1/targets`, { signal: AbortSignal.timeout(3000) });
  const targetsBody = await targetsRes.json();
  const activeTargets = targetsBody?.data?.activeTargets || [];
  const active = activeTargets.filter(t => t.health === "up").length;
  const total = activeTargets.length;
  // ... query avgCpuPercent/avgMemoryMb/totalRestarts via /api/v1/query, per the PromQL sketch above
  return { status: "live", data: { healthy, targets: { active, inactive: total - active, pending: 0, total }, services: {}, summary: {} } };
}
```

**This sketch is illustrative and unverified against a real running metrics stack** — needs real testing against an actual `dune metrics start`'d environment before shipping, including confirming the exact PromQL for `avgCpuPercent`/`avgMemoryMb`/`totalRestarts` produces sane numbers (the rules files define *alerting* thresholds, not necessarily the exact aggregate queries this summary needs — those would need to be written fresh, informed by the same metric names).

---

## 5. Other observations

- `sampleSoc`'s fixture re-embeds `health`, `activity`, `economy`, `combat`, `resources`, `inventory`, `location` sub-objects (data-providers.js:250-260) that `renderSoc()` never reads (confirmed: `renderSoc` only reads `platformHealth`/`bridgeRequests`/`bridgeErrors`/`bridgeSuccessRate`). This is dead fixture data in preview mode — harmless, but worth pruning for clarity whenever this file is next touched.
- (Historical, resolved) Neither `ops.soc.summary` nor `ops.health.prometheus` used to appear as a row in the Players tab's "KPI Capability" panel — both were added once that panel was made dynamic (Tier 2.1). The panel itself has since been removed entirely (see `docs/tabs/PLAYERS.md` §1.2) as low-value cross-tab meta information that didn't belong on the Players tab; this observation no longer applies to anything currently in the addon.

---

## 6. Recommended design

1. **`ops.soc.summary`**: implement the audit-log aggregation (§3), but design the counting mechanism properly (in-memory rolling counter or bounded-read approach) rather than shipping the naive full-file-parse sketch as final.
2. **`ops.health.prometheus`**: implement the Prometheus HTTP-query approach (§4), with mandatory, correctly-distinguished handling of the "stack not running" precondition — this is not optional or an edge case, it's the default state for any install that hasn't explicitly opted in.
3. Both are real, buildable, higher-effort than Inventory/Location (neither is a straightforward SQL `addonOps*` function) — see `docs/prompts/SOC.md` for the full implementation prompt, scoped to reflect this added complexity honestly.
