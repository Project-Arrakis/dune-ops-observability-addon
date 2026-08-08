# Metrics & Monitoring Prompts — Master Index

Generated 2026-08-07 from the eight-hats review + AAA/NOC/SOC gap analysis.
Updated 2026-08-07 with Grafana, Alertmanager, Bot Alerts, Console Exporter.

## Core Work: ⏳ PAUSED per operator directive (2026-08-07)

Prompts requiring Core changes (04, 05, 06, 11) are deferred until Core work resumes.
Prompts 07-10 can execute now — they are addon/bot/infrastructure only.

## Execution Priority (What You Can Ship Today)

| Priority | Prompt | Domain | Estimate | Core Changes |
|---|---|---|---|---|
| **1** | 07-GRAFANA | NOC/SOC Dashboards | 4-6h | None |
| **2** | 08-ALERTMANAGER | Alert Routing → Discord | 2-3h | None |
| **3** | 10-BOT-ALERTS | Bot Health Checks + /dune ops alerts | 3-4h | None |
| **4** | 09-ADDON-NOC-SOC | Addon UI Improvements | 3-5h | None |
| **5** | 01-ARCHITECTURE-FIXES | Addon partial results + config | 3-4h | None |
| **6** | 02-SECURITY-FIXES | Deploy script + gitleaks | 1-2h | None |
| **7** | 03-GRC-FIXES | Branch protection + docs | 1-2h | None |

## Deferred (Requires Core Changes)

| Prompt | Domain | Estimate |
|---|---|---|
| 11-CONSOLE-EXPORTER | Game Metrics → Prometheus | 4-6h |
| 04-AAA-METRICS | Player retention, progression, economy health | 8-12h |
| 05-NOC-METRICS | Tick rate, RED metrics, host resources | 6-10h |
| 06-SOC-METRICS | Auth failures, audit trail, CSP reports | 8-12h |

## What Each Prompt Delivers

### 07 — Grafana (4-6h, no Core changes)
3 auto-provisioned dashboards: Game Server Health (NOC), Infrastructure (SOC),
Player & Economy (AAA GameOps). Separate service in docker-compose.metrics.yml.
Behind Cloudflare Tunnel + Access at grafana.darkdante.org.

### 08 — Alertmanager (2-3h, no Core changes)
Routes all 22 existing Prometheus alerts to Discord via the ACP bot's relay
endpoint. Alertmanager → bot Express server → Discord webhook. Resolved alerts
send follow-up messages.

### 10 — Bot Alerts (3-4h, no Core changes)
5 new health checks (population zero, spice depleted, DB health, bridge errors,
population spike). `/dune ops alerts` slash command. Daily digest message.

### 09 — Addon NOC/SOC (3-5h, no Core changes)
Service health table in NOC Overview. Actionable "run dune metrics start" prompt.
Freshness badges on every panel. Section copy for all tabs. Known-gap tooltips.

### 11 — Console Exporter (4-6h, ⏳ deferred)
Exposes game metrics (players, combat, spice, economy, bridge) as Prometheus
gauge metrics at `/metrics`. New Prometheus scrape job. Fills empty dune-stack
alert rules group with 4 game-level alerts.

### 01-03 — Architecture/Security/GRC (5-8h total, addon-only)
Fixes from the eight-hats review: ops health partial results, preview mode
warning, data-driven PANEL_CONFIG, hardcoded IP removal, gitleaks scoping,
branch protection, compliance docs.

## Total Available Now: 16-24 hours (no Core changes)
## Total With Core: 33-55 hours

## Dependency Map (Simplified)

```
07 (Grafana) ──┐
08 (Alerts)  ──┼── Independent, ship in any order
10 (Bot)     ──┤
09 (Addon)   ──┤
01-03        ──┘

11 (Exporter) ── Needs 07 (Grafana dashboards reference game metrics)
04-06          ── Need 11 (exporter exposes data they visualize)
```
