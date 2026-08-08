# PROMPT: Console Exporter — Game Metrics → Prometheus

**Severity:** CRITICAL (G2, G3) | **Repo:** dune-awakening-selfhost-docker  
**Status:** ⏳ DEFERRED — Core work paused per operator directive  
**Dependencies:** None  
**Core Changes Required:** Yes (new endpoint + new Prometheus scrape job)  
**Timeout estimate:** 4-6 hours

## Context

The metrics stack has 6 scrape jobs for infrastructure (host, containers, Postgres,
RabbitMQ) but **zero game-specific metrics**. Every game stat (player counts, combat
deaths, spice fields, economy) is available through the existing `addonOps*()` bridge
functions but is never exported to Prometheus. This means:

- Grafana dashboards cannot show player count trends
- No alerting on game-level thresholds (population zero, spice depleted)
- No historical trending for game economy or combat stats
- The `dune-stack` alert rules group is empty because there's nothing to alert on

## Task 1: Create Console Exporter HTTP Endpoint

Add a new route in `server.js` that exposes game metrics in Prometheus format:

```javascript
if (path === "/metrics" && req.method === "GET") {
  // Only expose on localhost — this is internal infrastructure
  const remoteIp = (req.socket.remoteAddress || "").replace(/^::ffff:/, "");
  if (remoteIp !== "127.0.0.1" && remoteIp !== "::1") {
    return json(res, 403, { error: "Metrics endpoint is internal only" });
  }

  const metrics = await collectGameMetrics(db, config);
  res.writeHead(200, { "Content-Type": "text/plain; version=0.0.4" });
  res.end(metrics);
}
```

## Task 2: Implement collectGameMetrics()

Create `console/api/src/metrics.js` that produces Prometheus-format metrics:

```javascript
// Each addonOps*() function returns structured data. Map each field
// to a Prometheus gauge with labels where applicable.

export async function collectGameMetrics(db, config) {
  const lines = [];

  // Helpers
  const gauge = (name, value, help, labels = {}) => {
    lines.push(`# HELP ${name} ${help}`);
    lines.push(`# TYPE ${name} gauge`);
    const labelStr = Object.entries(labels).map(([k,v]) => `${k}="${v}"`).join(',');
    lines.push(labelStr ? `${name}{${labelStr}} ${value}` : `${name} ${value}`);
  };

  // --- Player Metrics ---
  const activity = await addonOpsActivitySummary(db);
  gauge("dune_players_total", activity.totalPlayers, "Total registered players");
  gauge("dune_players_online", activity.onlinePlayers, "Currently online players");
  gauge("dune_players_active_1h", activity.activeLast1h ?? 0, "Active in last hour");
  gauge("dune_players_active_24h", activity.activeLast24h ?? 0, "Active in last 24 hours");
  gauge("dune_players_active_7d", activity.activeLast7d ?? 0, "Active in last 7 days");
  gauge("dune_players_new", activity.newPlayers ?? 0, "New players (never played before)");
  gauge("dune_players_returning", activity.returningPlayers ?? 0, "Returning players");

  // --- Combat Metrics ---
  const combat = await addonOpsCombatDeaths(db);
  gauge("dune_combat_deaths_total", combat.totalDeaths, "Total player deaths");

  // --- Resource / Spice Metrics ---
  const resources = await addonOpsResourcesSummary(db, config);
  for (const [mapName, section] of Object.entries(resources)) {
    gauge("dune_spice_active_fields", section.summary.totalActiveFields,
      "Active spice fields", { map: mapName });
    gauge("dune_spice_remaining", section.summary.totalRemainingSpice,
      "Remaining spice", { map: mapName });
    gauge("dune_instances_pvp", section.summary.pvpInstances,
      "PvP instances", { map: mapName });
    gauge("dune_instances_pve", section.summary.pveInstances,
      "PvE instances", { map: mapName });
  }

  // --- Economy Metrics ---
  const economy = await addonOpsEconomySummary(db);
  gauge("dune_economy_holders", economy.totalCurrencyHolders, "Currency holders");
  gauge("dune_economy_supply", economy.totalSupply, "Total currency supply");
  gauge("dune_economy_active_orders", economy.activeOrders, "Active exchange orders");
  gauge("dune_economy_fulfilled_orders", economy.fulfilledOrders, "Fulfilled orders");

  // --- SOC Metrics ---
  const soc = await addonOpsSocSummary(db);
  gauge("dune_bridge_requests_total", soc.bridgeRequests, "Total bridge requests");
  gauge("dune_bridge_errors_total", soc.bridgeErrors, "Total bridge errors");

  return lines.join('\n') + '\n';
}
```

## Task 3: Add Prometheus Scrape Job

Add to `runtime/metrics/prometheus.yml`:

```yaml
  - job_name: dune-stack
    scrape_interval: 30s
    static_configs:
      - targets:
          - host.docker.internal:8088
        labels:
          service: dune-console
```

Note: `host.docker.internal` works on Docker Desktop (Windows/Mac). On Linux,
use `172.17.0.1` (the default Docker bridge gateway IP) or `dune-orchestrator`
if reachable on the `dune-net` network.

## Task 4: Fill the Empty dune-stack Rules Group

Update `runtime/metrics/rules/dune-stack.yml`:

```yaml
groups:
  - name: dune-stack
    rules:
      - alert: DuneZeroPlayers
        expr: dune_players_online == 0
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "Zero players online for 10 minutes"
          description: "The game server has had zero players for an extended period. Check if the server is accessible."

      - alert: DuneSpiceFieldsDepleted
        expr: dune_spice_active_fields{map="HaggaBasin"} == 0 and dune_spice_active_fields{map="DeepDesert"} == 0
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "All spice fields depleted"
          description: "All spice fields on both Deep Desert and Hagga Basin are depleted."

      - alert: DuneHighBridgeErrorRate
        expr: rate(dune_bridge_errors_total[5m]) > 1
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Elevated bridge error rate"
          description: "The console addon bridge is experiencing elevated errors."

      - alert: DuneEconomyStagnant
        expr: dune_economy_active_orders == 0
        for: 1h
        labels:
          severity: info
        annotations:
          summary: "No active exchange orders"
          description: "The economy has zero active exchange orders for an extended period."
```

## Verification

- [ ] `curl http://localhost:8088/metrics` returns Prometheus-format metrics
- [ ] All gauge values are non-negative integers or null-safe defaults
- [ ] `dune metrics validate` includes the new `dune-stack` scrape target
- [ ] Prometheus `/api/v1/targets` shows `dune-stack` as UP
- [ ] Prometheus `/api/v1/rules` shows the 4 new alert rules loaded
- [ ] Grafana Dashboard 3 (Player & Economy) auto-populates with game data
- [ ] Game metrics appear in Prometheus query: `dune_players_online`

## Reference
- Existing bridge actions: `addonOpsHealthPlayers`, `addonOpsHealthSummary`, etc. in `duneDb.js`
- Existing Prometheus scrape config: `runtime/metrics/prometheus.yml`
- Existing alert rules template: `runtime/metrics/rules/host.yml`
- Prometheus text format: https://prometheus.io/docs/instrumenting/exposition_formats/
