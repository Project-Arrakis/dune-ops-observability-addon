#!/usr/bin/env python3
"""Generate responsive HTML roadmap with sidebar nav, SVG diagrams, and full imagery."""

import os, sys
from datetime import date
from pathlib import Path

# BUG FIX (2026-07-25): this used to point at
# ~/dune-docker-addon/addon-main/docs -- a nested clone of this exact
# repo, living inside a 15GB redundant scratch directory deleted during
# a home-directory cleanup audit. This script IS run from the real
# repo -- use its own docs/ directory directly.
DOCS = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "docs")
DIAG = os.path.join(DOCS, "diagrams")

def svg_embed(name):
    """Read SVG file and return as inline HTML with responsive wrapper."""
    p = os.path.join(DIAG, f"{name}.svg")
    if not os.path.exists(p): return ""
    with open(p) as f:
        svg = f.read()
    return f'<div style="max-width:700px;margin:16px auto;"><figure class="diagram">{svg}</figure></div>'

def table(headers, rows):
    h = "".join(f"<th>{c}</th>" for c in headers)
    r = "".join(f"<tr>{''.join(f'<td>{c}</td>' for c in row)}</tr>" for row in rows)
    return f"<table><thead><tr>{h}</tr></thead><tbody>{r}</tbody></table>"

def li(items):
    return "<ul>" + "".join(f"<li>{i}</li>" for i in items) + "</ul>"

def badge(t, cls="done"): return f'<span class="badge badge-{cls}">{t}</span>'
def ref(n, d=""): return f'<span class="ref">{n}</span>{" — "+d if d else ""}'

today = date.today().strftime('%d %B %Y')

content = f"""
<div class="logo-header">
  <img src="diagrams/addon-logo.png" alt="Dune Ops Observability" style="max-width:520px;display:block;margin:0 auto 20px;">
</div>

<h1>Dune Ops Observability — Comprehensive Roadmap</h1>
<p class="subtitle">Core R1-R5 | Addon v0.2-v1.0 | {today}<br><code>yacketrj/dune-ops-observability-addon</code></p>

<h2 id="overview">1. Executive Summary</h2>
<p>Dune Ops Observability is a community addon providing <strong>SOC/OPS monitoring</strong>, <strong>game telemetry analytics</strong>, and <strong>formal release governance</strong> for Red-Blink's Dune: Awakening self-hosted Docker server. The Core repository provides infrastructure (Prometheus, Grafana, Alertmanager, bridge API). The Addon provides operator-facing panels rendered inside the Console iframe.</p>
<p>This roadmap defines <strong>5 Core releases (R1-R5)</strong> and <strong>6 Addon releases (v0.2-v1.0)</strong> with explicit cross-track dependencies, 8 tag types, and mapping to industry-standard metrics (RED, USE, Golden Signals, SOC2, DORA).</p>

{svg_embed("release-pipeline")}
<p class="diagram-caption">Release Pipeline: 5 Core releases + 4 Addon milestones with cross-track dependencies</p>

<h2 id="architecture">2. System Architecture</h2>
{svg_embed("architecture")}
<p class="diagram-caption">Game Stack, Metrics Stack, Console API, Addon iframe, and External services</p>

{svg_embed("dataflow")}
<p class="diagram-caption">Data Flow: Game DB → Core Bridge → Addon Panels → Operator Dashboard</p>

<h2 id="baseline">3. Current Baseline</h2>
<h3>Core (R1 Metrics Stack MVP — deployed)</h3>
{table(["Component", "Detail"], [
  ["Prometheus", "127.0.0.1:9090, 6 scrape targets, 15s interval"],
  ["Exporters", "cAdvisor (:8080), Node (:9100), Postgres (:9187)"],
  ["RabbitMQ", "admin :15692, game :15692 (built-in plugin)"],
  ["Alert rules", "16 rules across 4 groups: host, containers, postgres, rabbitmq"],
  ["Bridge actions", "leadership.players.list, ops.health.*, database.query/execute"],
  ["SOC controls", "HMAC sessions, CSRF, login/bridge rate limits, JSONL audit, addon provenance"],
  ["CI", "api-tests, metrics-unit, security-checks — all green"],
])}
<p>{ref("R1-METRICS-STACK-IMPLEMENTATION-NOTES.md")}</p>

<h3>Addon (v0.3.0 released)</h3>
{table(["Component", "Detail"], [
  ["v0.2.x", "A3 Player Summary, A4 KPI Capability, A5 read-only KPI panels (players:read)"],
  ["v0.3.0", "OPS Health Foundation: bridge freshness, source health, stale-data warnings (ops:read)"],
  ["Data providers", "sample (direct browser preview), bridge (production iframe path)"],
  ["Catalog", "addons/dune-ops-observability.json v0.3.0 in dune-docker-addons"],
])}

<h2 id="industry">4. Industry Standards Mapping</h2>
{svg_embed("standards")}
<p class="diagram-caption">Standards mapped to releases: RED/USE → R2, Golden Signals → R3, SOC2 → R4+R5, DORA → R5, Game Telemetry → Addon v0.4-v0.6</p>

<h2 id="core-releases">5. Core Release Train</h2>
{table(["R", "Name", "Key Deliverables", "Tags"], [
  ["R1", "Metrics Stack MVP", "Prometheus + 4 exporters, 16 alerts, CLI, SOC controls", badge("DONE")+" v1.3.x"],
  ["R2", "Console Exporter + SOC", "Grafana (always-on), Alertmanager (email+webhook), game metrics, RED metrics", "<code>core-metrics-r2</code>"],
  ["R3", "Prometheus Bridge API", "metrics.query bridge, /api/server/metrics, structured logging", "<code>core-metrics-r3</code>"],
  ["R4", "SOC Hardening", "Redis rate limits, proxy-aware IP, per-addon CSP", "<code>core-soc-r4</code>"],
  ["R5", "Ops Maturity", "SLO/SLI framework, retention/backup, audit rotation, DORA tracking", "<code>core-ops-r5</code>"],
], )}

<h2 id="addon-releases">6. Addon Release Train</h2>
<table>
<thead><tr><th>Release</th><th>Name</th><th>Merges</th><th>Key Metrics</th><th>Core Dep</th><th>Tags</th></tr></thead>
<tbody>
<tr><td>{badge("DONE","done")} v0.2.0</td><td>Player Operations</td><td>A3+A4+A5</td><td>Player summary, KPI, capability</td><td>-</td><td><code>v0.2.0</code></td></tr>
<tr><td>{badge("DONE","done")} v0.3.0</td><td>OPS Health Foundation</td><td>(released)</td><td>Bridge freshness, source health, operator status</td><td>-</td><td><code>v0.3.0</code></td></tr>
<tr><td>v0.4.0</td><td>Game Activity &amp; Combat</td><td>v0.4+v0.5</td><td>Sessions, deaths, PvP/PvE, NPC kills</td><td>R2</td><td><code>v0.4.0</code></td></tr>
<tr><td>v0.5.0</td><td>Economy &amp; Resources</td><td>v0.6+v0.7</td><td>Gathering, currency, market, inflation</td><td>-</td><td><code>v0.5.0</code></td></tr>
<tr><td>v0.6.0</td><td>World &amp; Assets</td><td>v0.8+v0.9</td><td>Crafting, territory, heat maps, storage</td><td>-</td><td><code>v0.6.0</code></td></tr>
<tr><td>v1.0.0</td><td>SOC/OPS Center</td><td>(full platform)</td><td>Platform health, bridge reliability, Prometheus display, runbooks</td><td>R3+R4</td><td><code>v1.0.0</code></td></tr>
</tbody></table>

<h2 id="deps">7. Dependency Graph &amp; Timeline</h2>
{svg_embed("dependencies")}
<p class="diagram-caption">Solid: sequential pipelines. Red dashed: Core-to-Addon coupling. v1.0 requires R3+R4.</p>
{svg_embed("timeline")}
<p class="diagram-caption">Release timeline: Green=done. Blue=Core. Purple=Addon.</p>

<h2 id="db-discovery">8. Database Discovery Phase</h2>
{svg_embed("discovery")}
<p class="diagram-caption">Discovery process: Inventory → Classify → Approve/Block → Implement</p>

<p>Before any game-facing metric in v0.4-v0.6, a PostgreSQL event inventory must be run against the <code>dune-postgres</code> container. <strong>This is a mandatory gate.</strong></p>

<p><strong>Required output</strong> (per {ref("DATABASE-EVENT-INVENTORY.md")}):</p>
{li(["Available schemas, tables, views, columns with types",
     "Candidate event/audit/activity tables",
     "Timestamp coverage and retention windows",
     "Estimated row counts",
     "Metric-source mapping: name → schema.table → columns → aggregation → cardinality risk → privacy class"])}

<p><strong>Current findings</strong> (per {ref("METRIC-DISCOVERY-FINDINGS.md")}):</p>
{li(["Available: player state, farm state, inventory (79 items, 34 inventories), resource fields (27 entries), markers (41)"])}
{li(["Blocked (zero rows): game_events, event_log, dune_exchange_orders, fulfilled_orders"])}
{li(["Approved safe: player status summary, farm aggregate (total/ready/alive/S2S)"])}

<p class="hard-rule">Hard rule: No economy, combat, death, NPC, resource, crafting, inventory, market, or location metric enters a release until its source table and columns are confirmed through a documented inventory.</p>

<h2 id="tagging">9. Tagging Convention &amp; Release Cadence</h2>
{table(["Context", "Pattern", "Example", "Repo"], [
  ["Core feature merges", "<code>core-{{domain}}-r{{n}}</code>", "<code>core-metrics-r2</code>", "Core fork"],
  ["Addon releases", "<code>v{{M}}.{{m}}.{{p}}</code>", "<code>v0.4.0, v1.0.0</code>", "Addon"],
  ["Addon RCs", "<code>v{{M}}.{{m}}.{{p}}-rc{{n}}</code>", "<code>v0.4.0-rc1</code>", "Addon"],
  ["Addon features", "<code>feature/{{area}}</code>", "<code>feature/player-activity</code>", "Addon"],
  ["Evidence archive", "<code>evidence/v{{M}}.{{m}}.{{p}}</code>", "<code>evidence/v0.4.0</code>", "Addon"],
  ["Immutable snapshots", "<code>preserve/{{desc}}</code>", "<code>preserve/pre-db-discovery</code>", "Addon"],
  ["Core feature branches", "<code>feature/{{area}}</code>", "<code>feature/console-exporter</code>", "Core fork"],
], )}

<p><strong>Cadence:</strong> Addon PRs: frequent. Public releases: &le; every 2 weeks. Core releases: batched by capability. Upstream PRs: after fork validation, narrow scope.</p>
<p><strong>Versioning (semver):</strong> PATCH=bug/package/UI fix. MINOR=new panel/feature/workflow. MAJOR=permission expansion/breaking manifest.</p>

<h2 id="soc-matrix">10. SOC/OPS Priority Matrix</h2>

<h3>{badge("P0","p0")} Critical</h3>
{table(["Area", "Metrics", "Core Dep"], [
  ["Addon & Bridge Health", "bridge available, errors, last read, data age", "-"],
  ["Player Availability", "online/offline, active rate, last seen staleness", "-"],
  ["Console/API Reliability", "request errors, latency, timeouts", "R2 (RED)"],
  ["Capacity & Saturation", "CPU, memory, disk, DB size, container health", "R2 (Grafana)"],
  ["Service Lifecycle", "up/down, restart count, degraded", "R2 (Alertmanager)"],
  ["Grafana + Alertmanager", "up/down, dashboard health, alert routing", "R2"],
  ["Metrics Bridge", "metrics.query availability, rejection rate", "R3"],
], )}

<h3>{badge("P1","p1")} Security-Sensitive</h3>
<table><thead><tr><th>Area</th><th>Metrics</th><th>Core Dep</th></tr></thead>
<tbody>
<tr><td>Admin Activity</td><td>commands, privilege changes, config changes</td><td>-</td></tr>
<tr><td>Access Failures</td><td>failed auth, denied addon requests, permission failures</td><td>R4 (Redis)</td></tr>
<tr><td>Addon Integrity</td><td>manifest drift, checksum drift, permission drift</td><td>-</td></tr>
<tr><td>Abuse Signals</td><td>suspicious churn, ban/kick trends</td><td>R4 (proxy IP)</td></tr>
<tr><td>Rate Limit Persistence</td><td>bucket state, abuse trends, IP rotation</td><td>R4 (Redis)</td></tr>
<tr><td>Per-addon CSP</td><td>CSP violations, blocked outbound requests</td><td>R4</td></tr>
</tbody></table>

<h3>{badge("P2","p2")} Operational Analytics</h3>
{table(["Area", "Metrics", "Core Dep"], [
  ["Faction & Guild", "faction/guild share, top faction/guild", "-"],
  ["Economy", "spice, solari, market, exchange, tax", "DB discovery"],
  ["API RED Metrics", "request rate, error rate, p50/p95/p99", "R2 (exporter)"],
  ["Bridge Analytics", "call rate, error rate, response time", "R3"],
  ["SLO/SLI", "availability %, latency SLO, freshness SLO", "R5"],
], )}

<h2 id="security">11. Security Boundaries</h2>
{svg_embed("security")}
<p class="diagram-caption">7-layer defense-in-depth: Transport → Rate Limiting → Input Validation → Bridge ACL → Data Protection → CI/CD → Monitoring</p>

<h3>Non-Negotiable Security Rules</h3>
{li([
  "raw player rows, player IDs, account IDs, character names",
  "Funcom/FLS identifiers, actor IDs, coordinates, exact positions",
  "SQL text, PromQL text, tokens, passwords, secrets",
  "raw logs by default, unbounded high-cardinality labels",
])}

<h3>Attack Surface (R2-R5)</h3>
{table(["Component", "Current", "R2-R5", "Mitigation"], [
  ["Prometheus", "127.0.0.1:9090", "unchanged", "Localhost-only"],
  ["Grafana (R2)", "n/a", "127.0.0.1:3000", "Auto-gen admin password"],
  ["Alertmanager (R2)", "n/a", "127.0.0.1:9093", "Webhooks over TLS"],
  ["Redis (R4)", "n/a", "dune-net:6379", "Internal net, opt AUTH"],
  ["metrics.query (R3)", "n/a", "POST bridge", "ops:read, PromQL sanitize"],
], )}

<h2 id="gates">12. Release Gates &amp; Governance</h2>
{svg_embed("gates")}
<p class="diagram-caption">Five-gate release process: Scope → Design → Implementation → Verification → Release</p>

{svg_embed("governance")}
<p class="diagram-caption">Governance flow: PR Gates → 5-Gate Release → Evidence Bundle → SBOM → Catalog PR</p>

<h3>PR Gates (16 checkpoints)</h3>
{li(["main was clean and in lockstep with origin/main before branching",
     "PR body includes: Summary, Why, Documentation Impact, Testing, Security, Risks",
     "Gitleaks, Semgrep, Trivy output included or justified",
     "SBOM impact stated; SOC2-style controls documented"])}

<h3>Release Gates</h3>
{li(["Test + Security evidence captured (unit, regression, E2E, Gitleaks, Semgrep, Trivy)",
     "16-file evidence bundle + SBOM + SOC2-style controls",
     "Release decision: Approved / Approved with limitations / Blocked / Abandoned / Superseded",
     "Package built, SHA-256 verified, GitHub Release published, catalog PR submitted"])}

<h2 id="decisions">13. Decision Log</h2>
{table(["Decision", "Date", "Rationale"], [
  ["v0.4-0.6 grouped into 3 releases", "2026-07-04", "v0.4=activity+combat, v0.5=economy+resources, v0.6=world+assets"],
  ["Grafana always-on", "2026-07-04", "Operators need persistent access. Localhost by default"],
  ["Alertmanager email+webhook", "2026-07-04", "Email basic, webhook (Discord/Slack) for team ops"],
  ["Redis for rate limits", "2026-07-04", "Small dep, survives restart. Internal net only"],
  ["v1.0 waits for R3+R4", "2026-07-04", "Needs metrics.query bridge (R3) and persistent rate limits (R4)"],
  ["Addon-first architecture", "2026-06-30", "Addon=UI, Core=infrastructure per RFC Addendum"],
  ["DB discovery mandatory", "2026-07-02", "No metric until source confirmed via inventory"],
  ["16-file evidence bundle", "2026-06-30", "Per release-standard. SOC2-style governance"],
  ["Command-auth upstream-compat", "2026-07-04", "Built-in fallback required. Game server uses same token"],
], )}

<h2 id="references">14. Document Index</h2>

<h3>Roadmap & Planning</h3>
{li([
  ref("ROADMAP.md","unified overview, dependency graph, tagging convention"),
  ref("OBSERVABILITY-ROADMAP.md","per-release candidate metrics, DB review requirements"),
  ref("SOC-OPS-ROADMAP.md","P0/P1/P2 metric taxonomy, Core R2-R5 releases"),
  ref("RFC.md","formal RFC for the comprehensive roadmap"),
])}

<h3>Governance & Standards</h3>
{li([
  ref("release-standard.md","5-gate release process, evidence bundle, non-negotiable security rules"),
  ref("metric-classification-standard.md","metric record schema, privacy classes, cardinality rules"),
  ref("REPOSITORY-REQUIREMENTS-AND-DELIVERABLES.md","PR gates, release gates, SBOM, SOC2 evidence, DoD"),
])}

<h3>Implementation Evidence (Core repo)</h3>
{li([
  ref("R1-METRICS-STACK-IMPLEMENTATION-NOTES.md","R1 operational design, security posture, validation"),
  ref("PR-EVIDENCE-ADDON-METRICS-SUPPORT.md","metrics stack PR scope, validation trail, E2E results"),
  ref("E2E-METRICS-TESTING.md","E2E testing procedure for the metrics stack"),
])}

<h3>Diagrams</h3>
{li([
  ref("architecture.png","full system architecture (Core + Addon + External)"),
  ref("dataflow.png","data flow from DB → Bridge → Addon → Operator"),
  ref("dependencies.png","Core R1-R5 and Addon v0.2-v1.0 dependency graph"),
  ref("timeline.png","release timeline with tags and cross-dependencies"),
  ref("release-pipeline.png","release pipeline with Core/Addon cross-dependencies"),
  ref("standards.png","industry standards mapped to releases"),
  ref("discovery.png","database discovery process flow"),
  ref("security.png","7-layer defense-in-depth security model"),
  ref("gates.png","5-gate release process flowchart"),
  ref("governance.png","governance flow: PR → Gates → Evidence → Release"),
])}

<p class="last-updated">Last updated: {today}. This document is maintained in sync with the operational roadmap in <code>yacketrj/dune-ops-observability-addon</code>.</p>
"""

# ─── NAV ───
nav_items = [
    ("overview", "1. Executive Summary"),
    ("architecture", "2. System Architecture"),
    ("baseline", "3. Current Baseline"),
    ("industry", "4. Industry Standards"),
    ("core-releases", "5. Core Release Train"),
    ("addon-releases", "6. Addon Release Train"),
    ("deps", "7. Dependency Graph"),
    ("db-discovery", "8. Database Discovery"),
    ("tagging", "9. Tagging & Cadence"),
    ("soc-matrix", "10. SOC/OPS Matrix"),
    ("security", "11. Security Boundaries"),
    ("gates", "12. Release Gates"),
    ("decisions", "13. Decision Log"),
    ("references", "14. References"),
]
nav_html = "\n  ".join(f'<a href="#{i}">{t}</a>' for i, t in nav_items)

# ─── HTML TEMPLATE ───
html = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Dune Ops Observability — Comprehensive Roadmap</title>
<style>
  :root {{
    --navy: #1a3a5c;
    --white: #fff;
    --lgray: #f0f4f8;
    --mgray: #899;
    --black: #1a1a1a;
    --green: #2e7d32;
    --red: #d32f2f;
    --orange: #f57c00;
    --blue: #1976d2;
    --purple: #6a1b9a;
    --lb: #e3f2fd;
    --side: 240px;
  }}
  * {{ box-sizing:border-box; }}
  body {{ font-family:'DejaVu Sans','Segoe UI',Arial,sans-serif; font-size:14px; color:var(--black); margin:0; padding:0; line-height:1.55; }}
  #sidebar {{ position:fixed; top:0; left:0; width:var(--side); height:100vh; background:var(--navy); color:var(--white); padding:24px 16px; overflow-y:auto; z-index:100; }}
  #sidebar .logo-s {{
    font-size:17px; font-weight:700; margin-bottom:14px; display:flex; align-items:center; gap:8px;
  }}
  #sidebar .logo-s img {{ height:32px; }}
  #sidebar h3 {{ font-size:11px; text-transform:uppercase; letter-spacing:1px; color:#90a4ae; margin:16px 0 8px; }}
  #sidebar a {{ display:block; color:#b0bec5; text-decoration:none; font-size:12px; padding:4px 8px; border-radius:4px; margin:2px 0; }}
  #sidebar a:hover {{ background:rgba(255,255,255,.1); color:var(--white); }}
  #main {{ margin-left:var(--side); max-width:960px; padding:32px 44px; }}
  h1 {{ color:var(--navy); font-size:26px; border-bottom:2px solid var(--navy); padding-bottom:8px; margin-top:0; }}
  h2 {{ color:var(--navy); font-size:18px; border-bottom:1px solid var(--mgray); padding-bottom:5px; margin-top:36px; }}
  h3 {{ color:var(--navy); font-size:15px; margin-top:22px; }}
  .subtitle {{ font-size:14px; color:#666; margin-bottom:24px; }}
  table {{ width:100%; border-collapse:collapse; margin:12px 0; font-size:13px; }}
  th {{ background:var(--navy); color:var(--white); padding:8px 10px; text-align:left; font-weight:600; }}
  td {{ padding:6px 10px; border-bottom:1px solid var(--mgray); }}
  tr:nth-child(even) td {{ background:var(--lgray); }}
  code, pre {{ font-family:'DejaVu Sans Mono','Courier New',monospace; font-size:12px; }}
  pre {{ background:#f5f5f5; padding:12px; border-left:3px solid var(--mgray); overflow-x:auto; }}
  .badge {{ display:inline-block; padding:2px 8px; border-radius:3px; font-size:11px; font-weight:600; color:var(--white); }}
  .badge-done {{ background:var(--green); }}
  .badge-p0 {{ background:var(--red); }}
  .badge-p1 {{ background:var(--orange); }}
  .badge-p2 {{ background:var(--blue); }}
  .diagram {{ max-width:100%; margin:8px 0; }}
  .diagram svg {{ max-width:100%; height:auto; }}
  .diagram-caption {{ font-size:12px; color:#666; text-align:center; margin-top:4px; font-style:italic; }}
  .ref {{ color:var(--navy); font-family:monospace; font-size:12px; }}
  .hard-rule {{ color:var(--red); font-weight:600; padding:10px 14px; background:#ffebee; border-left:4px solid var(--red); border-radius:4px; }}
  .logo-header {{ text-align:center; margin-bottom:20px; }}
  .last-updated {{ color:var(--mgray); font-style:italic; margin-top:40px; font-size:12px; }}
  @media print {{
    #sidebar {{ display:none; }}
    #main {{ margin-left:0; max-width:100%; }}
    h1,h2,h3 {{ page-break-after:avoid; }}
    table {{ page-break-inside:avoid; }}
    .diagram {{ page-break-inside:avoid; }}
  }}
  @media (max-width:768px) {{
    #sidebar {{ display:none; }}
    #main {{ margin-left:0; padding:16px; }}
  }}
</style>
</head>
<body>
<div id="sidebar">
  <div class="logo-s">
    <img src="diagrams/addon-logo.png" alt="" style="height:28px;">
    DOORS
  </div>
  <h3>Sections</h3>
  {nav_html}
</div>
<div id="main">
{content}
</div>
</body>
</html>"""

out = os.path.join(DOCS, "DUNE-OPS-OBSERVABILITY-ROADMAP.html")
with open(out, "w") as f:
    f.write(html)
print(f"Wrote: {out}")
