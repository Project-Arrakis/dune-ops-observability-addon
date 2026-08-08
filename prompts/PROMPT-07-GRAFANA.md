# PROMPT: Grafana Deployment — World-Class NOC/SOC Dashboards

**Severity:** CRITICAL (G10) | **Repo:** dune-awakening-selfhost-docker  
**Dependencies:** None (completely independent of game stack)  
**Core Changes Required:** None (separate service in docker-compose.metrics.yml)  
**Timeout estimate:** 4-6 hours

## Context

The metrics stack already runs Prometheus (6 scrape jobs, 22 alert rules, 7-day retention).
But there is **zero visualization** beyond the addon's live-snapshot tabs. A AAA/NOC/SOC
dashboard needs time-series graphs, multi-panel dashboards, and historical trending.

## Task 1: Add Grafana to docker-compose.metrics.yml

Add a `dune-grafana` service alongside the existing 4 metrics containers:

```yaml
dune-grafana:
  image: ${METRICS_GRAFANA_IMAGE:-grafana/grafana:11.1.0}
  container_name: dune-grafana
  restart: unless-stopped
  networks:
    - dune-net
  ports:
    - "127.0.0.1:${METRICS_GRAFANA_PORT:-3000}:3000"
  environment:
    GF_SECURITY_ADMIN_USER: ${METRICS_GRAFANA_USER:-admin}
    GF_SECURITY_ADMIN_PASSWORD: ${METRICS_GRAFANA_PASSWORD:-admin}
    GF_AUTH_ANONYMOUS_ENABLED: "true"
    GF_AUTH_ANONYMOUS_ORG_ROLE: Viewer
    GF_INSTALL_PLUGINS: ""
  volumes:
    - dune-grafana-data:/var/lib/grafana
    - ./runtime/metrics/grafana/datasources:/etc/grafana/provisioning/datasources:ro
    - ./runtime/metrics/grafana/dashboards:/etc/grafana/provisioning/dashboards:ro
    - ./runtime/metrics/grafana/dashboard-definitions:/var/lib/grafana/dashboards:ro

volumes:
  dune-grafana-data:
```

## Task 2: Create Grafana Datasource Config

Create `runtime/metrics/grafana/datasources/prometheus.yml`:

```yaml
apiVersion: 1
datasources:
  - name: Prometheus
    type: prometheus
    access: proxy
    url: http://dune-prometheus:9090
    isDefault: true
    editable: false
```

## Task 3: Create Grafana Dashboard Provisioning Config

Create `runtime/metrics/grafana/dashboards/default.yml`:

```yaml
apiVersion: 1
providers:
  - name: Default
    folder: Dune
    type: file
    options:
      path: /var/lib/grafana/dashboards
```

## Task 4: Build Dashboard JSONs

Create `runtime/metrics/grafana/dashboard-definitions/` with these dashboards:

### Dashboard 1: "Game Server Health" (NOC wallboard)
- **Row 1 — Player Activity**
  - Stat panel: Total Players (single-value, large font)
  - Stat panel: Online Players
  - Stat panel: Players Dead
  - Stat panel: DAU/MAU ratio (computed)
- **Row 2 — Player Trends**
  - Time series: Player count over 7 days (from node_exporter or custom metric)
  - Time series: Active 1h / 24h / 7d over time
- **Row 3 — Server Resources**
  - Gauge: CPU % (from node_exporter `node_cpu_seconds_total`)
  - Gauge: Memory % (from node_exporter `node_memory_MemAvailable_bytes`)
  - Gauge: Disk % (from node_exporter `node_filesystem_avail_bytes`)
  - Time series: CPU/Memory/Disk over 7 days
- **Row 4 — Service Health**
  - Table: Service status per container (up/down, from `up` metric)
  - Stat panel: Containers Running / Total
- **Row 5 — Alerts**
  - Alert list: Active Prometheus alerts (from `ALERTS` metric)
  - Time series: Alert states over time

### Dashboard 2: "Infrastructure Health" (SOC view)
- **Row 1 — Host Health**
  - Stat panel: Host Uptime (days)
  - Stat panel: Load Average (1m/5m/15m)
  - Stat panel: Available Memory
- **Row 2 — Alerts Overview**
  - Alert list: All 22 alert rules with current state
  - Time series: Firing alerts over time
- **Row 3 — Postgres Health**
  - Gauge: Active Connections / Max Connections %
  - Stat: Cache Hit Ratio %
  - Time series: Deadlocks over 30 days
- **Row 4 — RabbitMQ Health**
  - Stat: Queued Messages
  - Stat: Unacked Messages
  - Time series: Memory usage %

### Dashboard 3: "Player & Economy" (AAA GameOps view)
- **Row 1 — Population**
  - Stat: Total Players / Online / New (7d)
  - Time series: Player count trend over 30 days
- **Row 2 — Economy**
  - Stat: Total Solaris Supply
  - Stat: Active Exchange Orders
  - Time series: Economy velocity over time
- **Row 3 — Combat**
  - Stat: Total Deaths (24h)
  - Time series: Deaths per hour trend

**Note:** Dashboards 1 and 2 are fully functional today using existing Prometheus metrics.
Dashboard 3 (Player & Economy) requires the console-exporter (G2) to expose game metrics
to Prometheus — build the dashboard structure now, it will auto-populate when G2 ships.

## Task 5: Wire Grafana Behind Cloudflare Tunnel

Add to `/etc/cloudflared/config.yml` on the dune-prod VM:

```yaml
  - hostname: grafana.darkdante.org
    service: http://localhost:3000
```

**AND** add Cloudflare Access policy (same pattern as `console.darkdante.org`).

## Task 6: Add to dune metrics CLI

Add `grafana` subcommand to `runtime/scripts/metrics-stack.sh` for status/logs/config,
and update the `dune metrics` help text.

## Verification

- [ ] `docker compose -f docker-compose.metrics.yml up -d` starts Grafana
- [ ] `http://localhost:3000` shows Grafana login (anonymous Viewer)
- [ ] Datasource "Prometheus" auto-provisioned and healthy
- [ ] All 3 dashboards auto-provisioned and populated with data
- [ ] `dune metrics status` includes Grafana container status
- [ ] `https://grafana.darkdante.org` accessible with Cloudflare Access wall
- [ ] Alert list dashboard shows current active alerts from Prometheus

## Reference
- Existing Prometheus: `runtime/metrics/prometheus.yml` (6 scrape jobs, 127.0.0.1:9090)
- Existing metrics CLI: `runtime/scripts/metrics-stack.sh`
- Existing compose: `docker-compose.metrics.yml`
- Cloudflare ingress pattern: see `backup-recovery.md` for `console.darkdante.org`
