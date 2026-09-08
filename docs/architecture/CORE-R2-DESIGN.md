# Core R2 — SOC Foundation Design

**Release**: Core R2
**Status**: Design
**Date**: 2026-07-07
**Depends on**: Core R1 (Metrics Stack MVP)

---

## Abstract

Adds Grafana (dashboard visualization) and Alertmanager (notification pipeline) to the existing R1 Prometheus stack. Populates the `dune-stack.yml` rule group with Console API RED metrics. No new bridge actions or permissions — infrastructure only.

---

## Component Specification

### New Containers

| Container | Image | Port | Network | Access |
|---|---|---|---|---|
| `dune-grafana` | `grafana/grafana:latest` | `127.0.0.1:3000` | `dune-net` | Localhost only |
| `dune-alertmanager` | `prom/alertmanager:latest` | `127.0.0.1:9093` | `dune-net` | Localhost only |

### Prometheus Configuration Changes

New scrape job in `prometheus.yml`:
```yaml
- job_name: dune-console
  scrape_interval: 15s
  static_configs:
    - targets: ["dune-console:8088"]
  metrics_path: /metrics
```

New rule group `dune-stack.yml` (replaces empty placeholder):
```yaml
groups:
  - name: dune-stack
    rules:
      - alert: DuneConsoleHighErrorRate
        expr: rate(http_requests_total{status=~"5.."}[5m]) > 0.05
        for: 5m
        labels: { severity: warning }
        annotations: { summary: "Console API error rate > 5%" }
      - alert: DuneConsoleHighLatency
        expr: histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m])) > 5
        for: 5m
        labels: { severity: warning }
        annotations: { summary: "Console API p95 latency > 5s" }
      - alert: DuneBridgeHighErrorRate
        expr: rate(bridge_actions_total{status="error"}[5m]) > 0.1
        for: 5m
        labels: { severity: warning }
        annotations: { summary: "Bridge action error rate > 10%" }
```

### Console API Exporter

New `/metrics` endpoint on the Console API port (8088 by default). Exposes:

| Metric | Type | Description |
|---|---|---|
| `http_requests_total` | Counter | Requests by method, path, status |
| `http_request_duration_seconds` | Histogram | Request latency (method, path) |
| `bridge_actions_total` | Counter | Bridge actions by action, status |
| `db_query_duration_seconds` | Histogram | Database query latency |
| `active_sessions` | Gauge | Current active admin sessions |
| `addon_installed_count` | Gauge | Number of installed addons |

### Grafana Dashboard Provisioning

Three base dashboards shipped as JSON in `runtime/metrics/dashboards/`:

1. **Host Overview** — CPU load (1/5/15m), memory %, disk %, network bytes/errors
2. **Dune Stack** — Postgres connections/deadlocks/cache hits, RMQ queue depth/unacked/memory, Console API RED
3. **API Health** — Request rate, error rate, p50/p95/p99 latency per endpoint

Provisioned at Grafana container startup via volume mount:
```yaml
volumes:
  - ./runtime/metrics/dashboards:/etc/grafana/provisioning/dashboards:ro
  - ./runtime/metrics/grafana-datasources.yml:/etc/grafana/provisioning/datasources/datasources.yml:ro
```

### Alertmanager Configuration

Alertmanager routes Prometheus alerts to receivers:

```yaml
route:
  group_by: [alertname]
  group_wait: 10s
  group_interval: 10s
  repeat_interval: 12h
  receiver: default-webhook
  routes:
    - match: { severity: critical }
      receiver: critical-email
    - match: { severity: warning }
      receiver: warning-webhook

receivers:
  - name: default-webhook
    webhook_configs:
      - url: "${ALERTMANAGER_WEBHOOK_URL}"
  - name: critical-email
    email_configs:
      - to: "${ALERTMANAGER_EMAIL_TO}"
  - name: warning-webhook
    webhook_configs:
      - url: "${ALERTMANAGER_WEBHOOK_URL}"
```

Receiver configuration via environment variables:
- `ALERTMANAGER_WEBHOOK_URL` — Discord/Slack webhook URL (optional)
- `ALERTMANAGER_EMAIL_TO` — Email address for critical alerts (optional)
- `ALERTMANAGER_SMTP_HOST` / `_PORT` / `_USER` / `_PASS` — SMTP config

### CLI Integration

```
dune metrics grafana [start|stop|restart|status|logs]
dune metrics alertmanager [start|stop|restart|status|logs]
```

Managed through the existing `metrics-stack.sh` script. Grafana and Alertmanager start alongside Prometheus with `dune metrics start`.

---

## Security

| Component | Exposure | Mitigation |
|---|---|---|
| Grafana (:3000) | Localhost only | `127.0.0.1` bind, auto-gen admin password to `runtime/secrets/grafana-admin-password.txt` |
| Alertmanager (:9093) | Localhost only | `127.0.0.1` bind |
| `/metrics` endpoint | Console API port | No auth required (prometheus scrape) — exposes only RED metrics, no PII |
| Grafana datasource | Prometheus on `dune-net` | Internal Docker network |
| Alertmanager webhooks | Outbound only | HTTPS (TLS) enforced |
| Dashboard provisioning | Read-only volume mount | No write access to dashboard files |

### Attack Surface

- **New attack vector**: Grafana authenticated dashboard access. Mitigated by auto-generated strong password.
- **New attack vector**: Alertmanager webhook URL leakage. Mitigated by environment variable injection (never committed to git).
- **No new ports exposed** to external network — all localhost/internal Docker network only.

---

## Implementation Plan

| Phase | Deliverable | Files | Est. Lines |
|---|---|---|---|
| 1 | Docker compose additions | `docker-compose.metrics.yml` | +30 |
| 2 | Prometheus config + `dune-stack.yml` rules | `prometheus.yml`, `rules/dune-stack.yml` | +40 |
| 3 | Console API `/metrics` exporter | `console/api/src/metricsExporter.js` (new) | ~60 |
| 4 | Grafana dashboards (3 JSON) | `runtime/metrics/dashboards/*.json` | ~300 (generated) |
| 5 | Grafana datasource + Alertmanager config | `runtime/metrics/grafana-datasources.yml`, `runtime/metrics/alertmanager.yml` | +30 |
| 6 | CLI integration | `metrics-stack.sh`, `dune` | +40 |
| **Total** | | | **~500 lines** |

---

## Dependencies

- Requires Core R1 Metrics Stack (Prometheus + 4 exporters)
- Enables v0.4.0 NOC Dashboard Phase 2 (live Prometheus data in addon)
- No new bridge actions needed

---

## References

- [ROADMAP.md](../ROADMAP.md) — Core R2 release definition
- [RFC.md](../RFC.md) — RFC-DOO-0001 Section 4.1
- [R1-METRICS-STACK-IMPLEMENTATION-NOTES.md](https://github.com/Project-Arrakis/dune-awakening-selfhost-docker/blob/main/docs/archive/R1-METRICS-STACK-IMPLEMENTATION-NOTES.md) — R1 operational design (Core repo)
- `runtime/metrics/rules/dune-stack.yml` — Empty rule group (populated by this release)
