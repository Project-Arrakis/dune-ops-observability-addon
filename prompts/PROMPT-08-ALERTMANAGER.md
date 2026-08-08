# PROMPT: Alertmanager — Route 22 Alerts to Discord

**Severity:** CRITICAL (G1) | **Repo:** dune-awakening-selfhost-docker  
**Dependencies:** None  
**Core Changes Required:** None (separate service in docker-compose.metrics.yml)  
**Timeout estimate:** 2-3 hours

## Context

22 Prometheus alert rules fire **silently** with zero notification. No Alertmanager exists.
Every alert (CPU >85%, memory >90%, Postgres down, container missing, RMQ queue backlog)
has no delivery mechanism. The ACP bot has a Discord alert channel (`DUNE_ALERT_CHANNEL_ID`)
that is already used for readiness/services alerts — wire Prometheus alerts into the same path.

## Task 1: Add Alertmanager to docker-compose.metrics.yml

```yaml
dune-alertmanager:
  image: ${METRICS_ALERTMANAGER_IMAGE:-quay.io/prometheus/alertmanager:v0.28.0}
  container_name: dune-alertmanager
  restart: unless-stopped
  networks:
    - dune-net
  ports:
    - "127.0.0.1:${METRICS_ALERTMANAGER_PORT:-9093}:9093"
  command:
    - "--config.file=/etc/alertmanager/alertmanager.yml"
    - "--storage.path=/alertmanager"
    - "--web.listen-address=:9093"
  volumes:
    - ./runtime/metrics/alertmanager/alertmanager.yml:/etc/alertmanager/alertmanager.yml:ro
    - dune-alertmanager-data:/alertmanager

volumes:
  dune-alertmanager-data:
```

## Task 2: Update Prometheus to Point at Alertmanager

In `runtime/metrics/prometheus.yml`, add to the global section:

```yaml
alerting:
  alertmanagers:
    - static_configs:
        - targets:
            - dune-alertmanager:9093
```

## Task 3: Create Alertmanager Config

Create `runtime/metrics/alertmanager/alertmanager.yml`:

```yaml
global:
  resolve_timeout: 5m

route:
  group_by: ['alertname', 'severity']
  group_wait: 30s
  group_interval: 5m
  repeat_interval: 4h
  receiver: 'discord-webhook'
  routes:
    - match:
        severity: critical
      receiver: 'discord-webhook'
      repeat_interval: 1h
    - match:
        severity: warning
      receiver: 'discord-webhook'
      repeat_interval: 8h

receivers:
  - name: 'discord-webhook'
    webhook_configs:
      - url: '${DUNE_ALERT_WEBHOOK_URL}'
        send_resolved: true
        http_config:
          follow_redirects: true
```

## Task 4: Create Discord Message Template

Alertmanager sends raw JSON to Discord's webhook. Create a template that formats
alerts into Discord-friendly embeds. Either:

**Option A:** Create `runtime/metrics/alertmanager/template.tmpl` with Discord-embed
formatting and reference it in the alertmanager config.

**Option B (simpler):** Create a lightweight HTTP relay (10-line Express/Python server)
that receives Alertmanager webhook payloads and reformats them into Discord webhook
format. Run it as a separate service in the metrics compose.

**Option C (simplest, recommended):** Use Alertmanager's Discord integration directly.
Alertmanager v0.28+ has a Discord webhook receiver if the `discord` receiver type
is used. The config changes to:

```yaml
receivers:
  - name: 'discord-webhook'
    discord_configs:
      - webhook_url: '${DUNE_ALERT_WEBHOOK_URL}'
        title: '{{ .GroupLabels.alertname }}'
        message: '{{ range .Alerts }}{{ .Annotations.summary }}{{ end }}'
```

## Task 5: Add to dune metrics CLI + Validation

- Update `runtime/scripts/metrics-stack.sh` to include Alertmanager in `status` and `validate`
- The validate command should check: `curl -s http://localhost:9093/-/healthy`
- Add `METRICS_ALERTMANAGER_IMAGE` and `METRICS_ALERTMANAGER_PORT` to the env var list
- Add `alertmanager` subcommand help text to `dune metrics`

## Task 6: Update Alert Rules with Summary Annotations

The existing 22 alert rules in `runtime/metrics/rules/*.yml` have `summary` annotations
but they're inconsistent. Update every alert to have:

```yaml
annotations:
  summary: "{{ $labels.instance }} - {{ $labels.alertname }}: {{ humanize $value }}"
  description: "Human-readable description of what's happening and what to check"
```

And add a `severity` label to every rule (critical/warning) so the Alertmanager routing
works correctly (the existing rules use `severity: warning` and `severity: critical`
in their labels, which is correct).

## Verification

- [ ] `docker compose -f docker-compose.metrics.yml up -d` starts Alertmanager
- [ ] `curl -s http://localhost:9093/-/healthy` returns Healthy
- [ ] `curl -s http://localhost:9093/api/v2/alerts` shows current alerts
- [ ] Prometheus `/api/v1/alertmanagers` lists `dune-alertmanager:9093` as active
- [ ] Manually trigger a test alert: stop a container, verify Discord message arrives
- [ ] Resolved alert sends a follow-up Discord message (send_resolved: true)
- [ ] `dune metrics validate` includes Alertmanager health check

## Reference
- Existing Prometheus config: `runtime/metrics/prometheus.yml`
- Existing alert rules: `runtime/metrics/rules/*.yml` (22 rules across 4 groups)
- Existing ACP bot alert channel: `DUNE_ALERT_CHANNEL_ID` env var
- Existing metrics CLI: `runtime/scripts/metrics-stack.sh`
