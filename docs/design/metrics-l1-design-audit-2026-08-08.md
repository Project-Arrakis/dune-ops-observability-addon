# AAA / NOC / SOC Metrics Architecture — L1 Design Audit

**Date:** 2026-08-08 | **Repo:** dune-ops-observability-addon  
**Requirement 20, Layer 1:** Design audit before implementation  
**Status:** Design complete, awaiting Layer 2 implementation audits per phase

## Current State

| Component | Status |
|---|---|
| Prometheus targets | 6/6 UP (node, cadvisor, postgres, rabbitmq-admin, rabbitmq-game, prometheus) |
| Grafana dashboards | 3 auto-provisioned (Game Server Health, Infrastructure Health, Player & Economy) |
| Addon tabs | 11 (all game-operational) |
| Metric gaps | **31** (11 AAA + 10 NOC + 10 SOC) — 0 implemented |
| Critical gaps | **6** (N-1 tick rate, N-2 RED metrics, S-1 auth failures, S-2 audit trail, plus design-phase CRITICALs) |

## Architecture Decision

**All 31 metrics go through Core's bridge** (snapshot pattern). Prometheus/Grafana provide complementary time-series dashboards. No new data paths — the addon stays stateless with zero direct DB access.

```
PATH A (snapshot):  Core Bridge → addon JS        → addon panels
PATH B (gauges):    Prometheus    → Core R3 query  → addon live gauges  
PATH C (time-series):  Prometheus → Grafana        → addon Grafana tab (existing)
```

## Tab Architecture: 11 → 14

```
Game-operational (amber):        Infra/security (cool-blue):
NOC Overview | Players |         ‖ SOC (expanded) | AAA / Auth |
Activity | Combat | Spice |      ‖ NOC Infra | Audit Log |
Economy | Inventory | Location   ‖ Grafana | Diag
```

### Tab Assignments

| Tab | Status | Gaps Covered |
|---|---|---|
| SOC (expanded) | Existing, expands | 13 (AAA auth + SOC security + bridge health) |
| AAA / Auth | **New** | 6 (Steam OAuth, tokens, sessions, auth heatmap, escalation) |
| NOC Infra | **New** | 10 (live gauges, containers, rabbitmq, postgres, network) |
| Audit Log | **New** | 10 (admin trail, config history, scans, backups, tokens) |

## Phase Plan

```
Phase 0: REFRESHALL REFACTOR (addon only, no Core)
  └─ Tab-aware lazy loading: active tab dispatches only its providers
  └─ 60s cache window per source
  Time: ~2h | Dep: none

Phase 1: CORE R3 — metrics.query bridge
  └─ PromQL query through Core bridge (validated, cardinality-capped)
  └─ Internal state exposition (ops.aaa.summary, ops.soc.security, ops.audit.log)
  Time: ~2 weeks | Dep: Core work resumes
  BLOCKS: Phases 2-5

Phase 2: SOC TAB EXPANSION (v0.8.0)
  └─ Auth section: Steam logins, failures, token expiry, sessions
  └─ Security section: rate limits, config loads, scan results
  └─ Service dependency map
  Time: ~1 week | Dep: Phase 1

Phase 3: NOC INFRA TAB (v0.8.1)
  └─ Live CPU/mem/disk gauges, container ranking, rabbitmq/postgres health
  └─ Network throughput, Docker daemon health
  Time: ~1.5 weeks | Dep: Phase 1

Phase 4: AAA / AUTH TAB (v0.8.2)
  └─ Steam OAuth flow timing, token lifecycle, session providers
  └─ Auth failure heatmap, privilege escalation tracking
  Time: ~1 week | Dep: Phase 1

Phase 5: AUDIT LOG TAB (v0.8.3)
  └─ Admin command trail, config change history, addon lifecycle
  └─ Security scan triptych (trivy/semgrep/gitleaks), backup verification
  Time: ~1.5 weeks | Dep: Phase 1

Phase 6: GRAFANA DASHBOARD EXPANSION
  └─ 2 new dashboards: "AAA & Auth Health", "Security & Compliance"
  Time: ~0.5 weeks | Dep: Phase 1
```

**Total: ~8 weeks, 6 phases. Each phase independently deployable.**

## DBA Assessment

### New Core Postgres Tables (additive only)

```sql
CREATE TYPE audit_event_category AS ENUM (...);
CREATE TABLE IF NOT EXISTS audit_log (...);
CREATE TABLE IF NOT EXISTS aaa_sessions (...);
CREATE TABLE IF NOT EXISTS auth_failures (...);
```

- 3 new tables, 1 new enum, 6 new partial indexes
- **No existing tables altered** — backward/forward compatible
- Operators on older Core get graceful "unavailable" states

### Prometheus Retention

```yaml
METRICS_RETENTION_TIME: 30d   # was 7d
METRICS_RETENTION_SIZE: 4GB   # was 2GB
```

## Phase 0 — Immediate Addon-Only Work (No Core Required)

The following can be done TODAY without Core changes:

1. **refactor refreshAll() → tab-aware lazy loading** (~2h)
2. **Add 4 SOC tab placeholder cards** (S-3 permission drift, S-7 integrity, S-9 sessions, S-10 runbooks) (~2h)
3. **Add placeholder tabs** (AAA, NOC Infra, Audit Log) with "Requires Core R3" messages (~1h)

## Risks

| Risk | Severity | Mitigation |
|---|---|---|
| N-1 Tick rate has NO data source | HIGH | Build the card as "unavailable" — honest about the gap |
| G-2 Session duration has no sessions table | HIGH | Approximate from player_state timestamps, document limitation |
| G-8 Combat balance: no weapon data in death log | HIGH | Mark weapon breakdown as unavailable, honest about upstream dependency |
| G-1 Retention query load (30-day window) | MEDIUM | In-memory cache in Console process |
| G-4 Gini coefficient: per-player balance scan | MEDIUM | Cap at 10,000 rows, return null above threshold |
| No time-series retention for velocity/inflation | MEDIUM | Document UI caveat; Phase 2 Prometheus solves this |
| Core work is paused | **BLOCKING** | Phase 0 + addon-only SOC expansion can proceed now |
