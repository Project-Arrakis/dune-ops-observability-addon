# Addon Improvement Prompts — Master Index

Generated 2026-08-07 from the eight-hats review + AAA/NOC/SOC gap analysis.

## Execution Order

1. **PROMPT-01-ARCHITECTURE-FIXES.md** (3-4h) — H-1, M-1, M-5, M-7
   - Ops health partial results, preview mode warning, data-driven config,
     pre-commit drift check

2. **PROMPT-02-SECURITY-FIXES.md** (1-2h) — M-2, M-6, L-6
   - Remove hardcoded IP, scope gitleaks allowlist, Diag tab data warning

3. **PROMPT-03-GRC-FIXES.md** (1-2h) — H-2, M-3, M-4, L-9
   - Enable branch protection, compliance scaffolding, release evidence,
     stale paths

4. **PROMPT-04-AAA-METRICS.md** (8-12h) — G-1 through G-11
   - Retention cohorts, session duration, progression funnel, economy
     health, player engagement, combat balance, map heat maps, guild health

5. **PROMPT-05-NOC-METRICS.md** (6-10h) — N-1 through N-10
   - Server tick rate, per-service RED metrics, host resources without
     Prometheus, service health map, DB health

6. **PROMPT-06-SOC-METRICS.md** (8-12h) — S-1 through S-10
   - Auth failure monitoring, admin audit trail, CSP violation reporting,
     permission drift, rate limit telemetry, suspicious behavior

## Total Estimate: 27-42 hours

## Dependency Map

```
Prompt 01 (Architecture) ──┐
Prompt 02 (Security)     ──┼── Independent — can run in parallel
Prompt 03 (GRC)          ──┘

Prompt 04 (AAA Metrics)  ──┐
Prompt 05 (NOC Metrics)  ──┼── Independent — can run in parallel
Prompt 06 (SOC Metrics)  ──┘   (each writes different Core bridge actions
                                and different addon panels)

Prompts 01-03 should complete before 04-06 because 04-06 add new panels
that need the data-driven PANEL_CONFIG refactor from Prompt 01.
```

## Repository Scope Per Prompt

| Prompt | dune-ops-observability-addon | dune-awakening-selfhost-docker |
|---|---|---|
| 01 (Architecture) | ✅ All changes | — |
| 02 (Security) | ✅ All changes | — |
| 03 (GRC) | ✅ All changes | — |
| 04 (AAA) | ✅ Provider + renderer | ✅ Bridge actions + DB queries |
| 05 (NOC) | ✅ Provider + renderer | ✅ Bridge actions + host metrics |
| 06 (SOC) | ✅ Provider + renderer | ✅ Bridge actions + audit log |

## Reference Documents

- Eight-hats findings register: `compliance/eight-hats-findings-register.md`
- AAA/NOC/SOC gap analysis: same file, sections at bottom
- Release standard: `ops-observability/roadmap/release-standard.md`
- Metric classification standard: `ops-observability/roadmap/metric-classification-standard.md`
- Security architecture gap analysis: `docs/SECURITY-ARCHITECTURE-GAP-ANALYSIS.md`
- Database event inventory: `docs/DATABASE-EVENT-INVENTORY.md`
