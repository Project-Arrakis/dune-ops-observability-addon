#!/usr/bin/env python3
"""Generate the Comprehensive Roadmap PDF and RFC PDF with full imagery per section."""

import os, sys
from datetime import date

PDFGEN_PYTHON = os.path.expanduser("~/.local/venvs/pdfgen/bin/python")
if sys.executable != PDFGEN_PYTHON:
    sys.stderr.write(f"Must run with: {PDFGEN_PYTHON}\n")
    sys.exit(1)

from fpdf import FPDF

# BUG FIX (2026-07-25): this used to point at
# ~/dune-docker-addon/addon-main/docs -- a nested clone of this exact
# repo, living inside a 15GB redundant scratch directory deleted during
# a home-directory cleanup audit. This script IS run from the real
# repo -- use its own docs/ directory directly.
DOCS   = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "docs")
DIAG   = os.path.join(DOCS, "diagrams")

NAVY   = (26, 58, 92)
WHITE  = (255, 255, 255)
LGRAY  = (240, 244, 248)
MGRAY  = (136, 153, 170)
BLACK  = (26, 26, 26)
GREEN  = (46, 125, 50)
RED    = (211, 47, 47)
ORANGE = (245, 124, 0)
BLUE   = (25, 118, 210)
PURPLE = (106, 27, 154)

FS  = "DejaVuSans"
FSB = "DejaVuSans-Bold"
FM  = "DejaVuSansMono"

class PDF(FPDF):
    def __init__(self):
        super().__init__('P', 'in', 'Letter')
        self.set_auto_page_break(True, 0.7)
        self.set_margin(0.7)
        self.W = self.w - 1.4
        for n,p in [(FS,  ""), (FSB, "B"), (FS, "I")]:
            self.add_font(n, p, "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf" if p != "B" else "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf")
        self.add_font(FM, "", "/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf")

    def footer(self):
        self.set_y(-0.55)
        self.set_font(FS, '', 7)
        self.set_text_color(*MGRAY)
        self.cell(0, 0.25, f"Page {self.page_no()}/{{nb}}", align='C')

    def h2(self, t):
        self.ln(0.15)
        self.set_font(FSB, 'B', 13)
        self.set_text_color(*NAVY)
        self.cell(self.W, 0.32, t, new_x="LMARGIN", new_y="NEXT")
        self.set_draw_color(*MGRAY)
        self.line(self.l_margin, self.y, self.w - self.r_margin, self.y)
        self.ln(0.1)

    def h3(self, t):
        self.set_font(FSB, 'B', 10)
        self.set_text_color(*NAVY)
        self.cell(self.W, 0.24, t, new_x="LMARGIN", new_y="NEXT")
        self.ln(0.05)

    def p(self, t):
        self.set_font(FS, '', 9)
        self.set_text_color(*BLACK)
        self.multi_cell(self.W, 0.18, t, new_x="LMARGIN", new_y="NEXT")

    def mono(self, t):
        self.set_font(FM, '', 8)
        self.set_text_color(60,60,60)
        self.multi_cell(self.W, 0.15, t, new_x="LMARGIN", new_y="NEXT")

    def li(self, items):
        self.set_font(FS, '', 9)
        self.set_text_color(*BLACK)
        for i in items:
            self.cell(0.22, 0.17, "\u2022")
            self.multi_cell(self.W - 0.22, 0.17, i, new_x="LMARGIN", new_y="NEXT")

    def img(self, name, w=5.0, cap=""):
        p = os.path.join(DIAG, f"{name}.png")
        if not os.path.exists(p): return
        self.ln(0.08)
        x = (self.w - w) / 2
        self.image(p, x=x, w=w)
        if cap:
            self.ln(0.02)
            self.set_font(FS, '', 7)
            self.set_text_color(*MGRAY)
            self.cell(self.W, 0.15, cap, align='C', new_x="LMARGIN", new_y="NEXT")
        self.ln(0.06)

    def tbl(self, headers, rows, cw=None):
        if cw is None: cw = [self.W/len(headers)]*len(headers)
        self.set_font(FSB, 'B', 8)
        self.set_fill_color(*NAVY)
        self.set_text_color(*WHITE)
        for i,h in enumerate(headers):
            self.cell(cw[i], 0.26, f" {h}", border=1, fill=True)
        self.ln()
        self.set_font(FS, '', 8)
        for ri, row in enumerate(rows):
            self.set_fill_color(*LGRAY if ri%2 else WHITE)
            self.set_text_color(*BLACK)
            for i,c in enumerate(row):
                self.cell(cw[i], 0.22, f" {c}", border=1, fill=True)
            self.ln()
        self.ln(0.08)

    def badge(self, t, clr):
        self.set_font(FSB, 'B', 7)
        self.set_fill_color(*clr)
        self.set_text_color(*WHITE)
        self.cell(0.35, 0.18, f" {t} ", fill=True, new_x="RIGHT", new_y="LAST")
        self.set_text_color(*BLACK)

    def cap(self, needed=1.2):
        if self.y > self.h - needed: self.add_page()


# ═══════ ROADMAP PDF ═══════

def build_roadmap():
    p = PDF(); p.alias_nb_pages()
    L = os.path.join(DIAG, "addon-logo.png")

    # ─ 1: TITLE ─
    p.add_page()
    if os.path.exists(L): p.image(L, x=(p.w-5.2)/2, y=0.8, w=5.2)
    p.ln(3.8)
    p.set_font(FSB, 'B', 22); p.set_text_color(*NAVY)
    p.cell(p.W, 0.45, "Dune Ops Observability", align='C', new_x="LMARGIN", new_y="NEXT")
    p.set_font(FSB, 'B', 14)
    p.cell(p.W, 0.32, "Comprehensive Roadmap", align='C', new_x="LMARGIN", new_y="NEXT")
    p.ln(0.2)
    p.set_font(FS, '', 10); p.set_text_color(*BLACK)
    p.cell(p.W, 0.22, f"Core R1-R5  |  Addon v0.2-v1.0  |  {date.today().strftime('%B %Y')}", align='C', new_x="LMARGIN", new_y="NEXT")
    p.cell(p.W, 0.22, "yacketrj/dune-ops-observability-addon", align='C', new_x="LMARGIN", new_y="NEXT")

    # ─ 2: OVERVIEW + STANDARDS ─
    p.add_page()
    p.h2("Executive Summary")
    p.p("Dune Ops Observability is a community addon providing SOC/OPS monitoring, game telemetry analytics, and formal release governance for Red-Blink's Dune: Awakening self-hosted Docker server. The Core repository provides infrastructure (Prometheus, Grafana, Alertmanager, bridge API). The Addon provides operator-facing panels rendered inside the Console iframe.")
    p.ln(0.05); p.p("This roadmap defines 5 Core releases and 6 Addon releases with explicit cross-track dependencies, 8 tag types, and mapping to industry-standard metrics (RED, USE, Golden Signals, SOC2, DORA).")

    p.img("release-pipeline", 5.8, "Release Pipeline: 5 Core + 4 Addon milestones with cross-track dependencies")

    p.h2("Industry Standards Mapping")
    p.img("standards", 5.8, "Standards mapped to releases: RED/USE → R2, Golden Signals → R3, SOC2 → R4+R5, DORA → R5")

    # ─ 3: CORE RELEASES ─
    p.add_page()
    p.h2("Core Release Train")
    p.tbl(["R", "Name", "Key Deliverables", "Tags"],
        [["R1", "Metrics Stack MVP", "Prometheus + 4 exporters, 16 alerts, CLI, SOC controls", "v1.3.x (upstream)"],
         ["R2", "Console Exporter + SOC Foundation", "Grafana (always-on), Alertmanager (email+webhook), game metrics, RED", "core-metrics-r2"],
         ["R3", "Prometheus Bridge API", "metrics.query bridge, /api/server/metrics, structured logging", "core-metrics-r3"],
         ["R4", "SOC Hardening", "Redis rate limits, proxy-aware IP, per-addon CSP", "core-soc-r4"],
         ["R5", "Ops Maturity", "SLO/SLI framework, retention/backup, audit rotation, DORA", "core-ops-r5"]],
        [0.4, 1.8, 3.8, 1.2])
    p.img("dataflow", 5.2, "Data flow: Game DB → Core Bridge → Addon Panels → Operator Dashboard")

    p.h2("Addon Release Train")
    p.tbl(["Release", "Name", "Merges", "Key Metrics", "Dep", "Tags"],
        [["v0.2.0", "Player Operations", "A3+A4+A5", "Player summary, KPI, capability", "-", "v0.2.0"],
         ["v0.3.0", "OPS Health Foundation", "released", "Bridge freshness, source health, operator status", "-", "v0.3.0"],
         ["v0.4.0", "Game Activity & Combat", "v0.4+v0.5", "Sessions, deaths, PvP/PvE, NPC kills", "R2", "v0.4.0"],
         ["v0.5.0", "Economy & Resources", "v0.6+v0.7", "Gathering, currency, market, inflation", "-", "v0.5.0"],
         ["v0.6.0", "World & Assets", "v0.8+v0.9", "Crafting, territory, heat maps, storage", "-", "v0.6.0"],
         ["v1.0.0", "SOC/OPS Center", "full platform", "Platform health, bridge reliability, Prometheus display", "R3+R4", "v1.0.0"]],
        [0.45, 1.35, 0.75, 2.45, 0.6, 0.8])

    # ─ 4: DEPENDENCY + TIMELINE ─
    p.add_page()
    p.h2("Dependency Graph")
    p.img("dependencies", 5.5, "Solid: Core pipeline + Addon pipeline. Red dashed: Core-to-Addon coupling")
    p.ln(0.5)
    p.h2("Release Timeline")
    p.img("timeline", 5.5, "Green = done. Blue = Core. Purple = Addon")
    p.ln(0.3)
    p.h2("Architecture")
    p.img("architecture", 5.5, "Game Stack, Metrics Stack, Console API, Addon, External")

    # ─ 5: DB DISCOVERY ─
    p.add_page()
    p.h2("Database Discovery Phase")
    p.p("Before any game-facing metric in v0.4-v0.6, a PostgreSQL event inventory must run against dune-postgres. This is a mandatory gate.")
    p.ln(0.05)
    p.h3("Required Output")
    p.li(["Schemas, tables, views, columns with types",
          "Candidate event/audit/activity tables + timestamp coverage + retention",
          "Estimated row counts",
          "Metric-source mapping: name → schema.table → columns → aggregation → cardinality → privacy"])
    p.ln(0.05)
    p.h3("Discovery Findings (from first run)")
    p.li(["Available: player state, farm state, inventory (79 items), resource fields (27 entries), markers (41)"])
    p.li(["Blocked (zero rows): game_events, event_log, exchange_orders, fulfilled_orders"])
    p.li(["Approved safe: player status summary, farm aggregate (total/ready/alive/S2S)"])
    p.ln(0.05)
    p.set_font(FSB, 'B', 10); p.set_text_color(*RED)
    p.multi_cell(p.W, 0.18, "Hard rule: No economy, combat, death, NPC, resource, crafting, inventory, market, or location metric enters a release without confirmed source.", new_x="LMARGIN", new_y="NEXT")

    p.img("discovery", 5.0, "Discovery process: Inventory → Classify → Approve/Block → Implement")

    # ─ 6: TAGGING + CADENCE ─
    p.add_page()
    p.h2("Tagging Convention")
    p.tbl(["Context", "Pattern", "Example", "Repo"],
        [["Core feature merges", "core-{domain}-r{n}", "core-metrics-r2", "Core fork"],
         ["Addon releases", "v{m}.{m}.{p}", "v0.4.0, v1.0.0", "Addon"],
         ["Addon RCs", "v{m}.{m}.{p}-rc{n}", "v0.4.0-rc1", "Addon"],
         ["Addon features", "feature/{area}", "feature/player-activity", "Addon"],
         ["Evidence archive", "evidence/v{m}.{m}.{p}", "evidence/v0.4.0", "Addon"],
         ["Immutable snapshots", "preserve/{desc}", "preserve/pre-db-discovery", "Addon"],
         ["Core feature branches", "feature/{area}", "feature/console-exporter", "Core fork"]],
        [1.6, 2.0, 2.0, 1.0])

    p.ln(0.15)
    p.h2("Release Cadence")
    p.li(["Addon PRs: focused, frequent. Public releases: ≤ every 2 weeks"])
    p.li(["Core releases: batched by capability block (R1→R5)"])
    p.li(["Upstream PRs: after fork validation, narrow scope, evidence-backed"])
    p.li(["Emergency patches: allowed for broken pkg, invalid manifest, security"])
    p.ln(0.05); p.p("Versioning (semver): PATCH=bug/package/manifest/UI fix. MINOR=new panel/feature/workflow. MAJOR=permission expansion/breaking manifest/incompatible bridge.")

    # ─ 7: SOC/OPS MATRIX ─
    p.add_page()
    p.h2("SOC/OPS Priority Matrix")

    p.set_font(FSB, 'B', 11); p.set_text_color(*RED)
    p.cell(p.W, 0.24, "P0 — Critical", new_x="LMARGIN", new_y="NEXT")
    p.tbl(["Area", "Metrics", "Core"], [
        ["Addon & Bridge Health", "bridge available, errors, last read, data age", "-"],
        ["Players", "online/offline, active rate, last seen staleness", "-"],
        ["Console/API", "request errors, latency, timeouts", "R2 (RED)"],
        ["Capacity & Saturation", "CPU, memory, disk, DB size, container health", "R2 (Grafana)"],
        ["Service Lifecycle", "up/down, restart count, degraded", "R2 (Alertmanager)"],
        ["Grafana + Alertmanager", "up/down, dashboard health, alert routing", "R2"],
        ["Metrics Bridge", "metrics.query availability, rejection rate", "R3"]],
        [1.5, 3.5, 1.0])

    p.ln(0.1)
    p.set_font(FSB, 'B', 11); p.set_text_color(*ORANGE)
    p.cell(p.W, 0.24, "P1 — Security-Sensitive", new_x="LMARGIN", new_y="NEXT")
    p.tbl(["Area", "Metrics", "Core"], [
        ["Admin Activity", "commands, privilege changes, config changes", "-"],
        ["Access Failures", "failed auth, denied addon requests, permission failures", "R4 (Redis)"],
        ["Addon Integrity", "manifest drift, checksum drift, permission drift", "-"],
        ["Abuse Signals", "suspicious churn, ban/kick trends", "R4 (proxy IP)"],
        ["Rate Limit Persistence", "bucket state, abuse trends, IP rotation detection", "R4 (Redis)"],
        ["Per-addon CSP", "CSP violations, blocked outbound requests", "R4"]],
        [1.5, 3.5, 1.0])

    p.add_page()
    p.set_font(FSB, 'B', 11); p.set_text_color(*BLUE)
    p.cell(p.W, 0.24, "P2 — Operational Analytics", new_x="LMARGIN", new_y="NEXT")
    p.tbl(["Area", "Metrics", "Core"], [
        ["Faction & Guild", "faction/guild share, top faction/guild", "-"],
        ["Economy", "spice, solari, market, exchange, tax", "DB discovery"],
        ["API RED Metrics", "request rate, error rate, p50/p95/p99", "R2 (exporter)"],
        ["Bridge Analytics", "call rate, error rate, response time", "R3"],
        ["SLO/SLI", "availability %, latency SLO, freshness SLO", "R5"]],
        [1.5, 3.5, 1.0])

    p.ln(0.15)
    p.h2("Metric Classification")
    p.tbl(["Privacy Class", "Definition", "Examples", "Action"],
        [["Safe", "May expose after review", "player counts, farm counts, container status", "Allowed"],
         ["Sensitive", "Needs additional review", "timestamps, log-derived counts, host paths", "Review"],
         ["Unsafe", "Must NOT expose", "player IDs, names, coords, tokens, secrets", "Blocked"],
         ["Unknown", "Classify first", "opaque blobs, unclear enums", "Hold"]],
        [1.0, 1.5, 2.5, 1.0])

    # ─ 8: SECURITY ─
    p.add_page()
    p.h2("Security Boundaries")
    p.img("security", 5.5, "7-layer defense-in-depth: Transport → Rate Limiting → Input Validation → Bridge ACL → Data Protection → CI/CD → Monitoring")
    p.ln(0.3)
    p.h2("Attack Surface (R2-R5)")
    p.tbl(["Component", "Current", "R2-R5", "Mitigation"],
        [["Prometheus", "127.0.0.1:9090", "unchanged", "Localhost-only"],
         ["Grafana (R2)", "n/a", "127.0.0.1:3000", "Auto-gen admin password"],
         ["Alertmanager (R2)", "n/a", "127.0.0.1:9093", "Webhooks over TLS"],
         ["Redis (R4)", "n/a", "dune-net:6379", "Internal net, opt AUTH"],
         ["metrics.query (R3)", "n/a", "POST bridge", "ops:read, PromQL sanitize"]],
        [1.3, 1.2, 1.5, 2.8])

    p.h2("Non-Negotiable Security Rules")
    p.li(["raw player rows, player IDs, account IDs, character names"])
    p.li(["Funcom/FLS identifiers, actor IDs, coordinates, exact positions"])
    p.li(["SQL text, PromQL text, tokens, passwords, secrets"])
    p.li(["raw logs by default, unbounded high-cardinality labels"])

    # ─ 9: GATES + GOVERNANCE ─
    p.add_page()
    p.h2("Release Process: 5 Gates")
    p.img("gates", 4.5, "Scope → Design → Implementation → Verification → Release")
    p.tbl(["Gate", "Name", "Exit Criteria"],
        [["0", "Scope", "Objective, repo, in/out scope, data sources, permissions, rollback plan"],
         ["1", "Design", "API contract, permission model, response schema, failure-mode, E2E plan"],
         ["2", "Implementation", "Unit + targeted tests, permission enforcement, schema guards"],
         ["3", "Verification", "Local CLI E2E, WebUI E2E, privacy regression, evidence snapshots"],
         ["4", "Release", "Decision, limitations, rollback, release notes, 16-file evidence bundle"]],
        [0.4, 1.1, 5.5])

    p.ln(0.15)
    p.h2("Governance & Definition of Done")
    p.img("governance", 5.2, "PR Gates → 5-Gate Release → 16-Evidence Bundle → SBOM → Catalog PR")
    p.ln(0.3)
    p.h3("PR Gates (minimum)")
    p.li(["main was clean and in lockstep with origin/main before branching"])
    p.li(["PR body: Summary, Why, Documentation Impact, Testing, Security, Risks"])
    p.li(["Gitleaks, Semgrep, Trivy output included or justified"])
    p.li(["SBOM impact stated; SOC2-style controls documented"])
    p.ln(0.05)
    p.h3("Release Gates")
    p.li(["Test + Security evidence captured (unit, regression, E2E, Gitleaks, Semgrep, Trivy)"])
    p.li(["16-file evidence bundle, SBOM, SOC2-style controls"])
    p.li(["Release decision: Approved | Approved w/limits | Blocked | Abandoned | Superseded"])
    p.li(["Package built, SHA-256 verified, GitHub Release published, catalog PR submitted"])

    # ─ 10: DECISIONS + INDEX ─
    p.add_page()
    p.h2("Decision Log")
    p.tbl(["Decision", "Date", "Rationale"],
        [["v0.4-0.6 grouped into 3 releases", "2026-07-04", "v0.4=activity+combat, v0.5=economy+resources, v0.6=world+assets"],
         ["Grafana always-on", "2026-07-04", "Operators need persistent access. Localhost by default"],
         ["Alertmanager email+webhook", "2026-07-04", "Email basic, webhook (Discord/Slack) for team ops"],
         ["Redis for rate limits", "2026-07-04", "Small dep, survives restart. Internal net only"],
         ["v1.0 waits for R3+R4", "2026-07-04", "Needs metrics.query (R3) + persistent rate limits (R4)"],
         ["Addon-first architecture", "2026-06-30", "Addon=UI, Core=infrastructure per RFC Addendum"],
         ["DB discovery mandatory", "2026-07-02", "No metric until source confirmed via inventory"],
         ["16-file evidence bundle", "2026-06-30", "Per release-standard. SOC2-style governance"],
         ["Command-auth upstream-compat", "2026-07-04", "Built-in fallback required. Game server uses same token"]],
        [2.8, 0.85, 3.35])

    p.ln(0.15)
    p.h2("Document Index")
    for grp, docs in [
        ("Roadmap & Planning", [("ROADMAP.md","unified overview, dependency graph, tagging"),
                                ("OBSERVABILITY-ROADMAP.md","per-release candidate metrics, DB review"),
                                ("SOC-OPS-ROADMAP.md","P0/P1/P2 taxonomy, Core R2-R5"),
                                ("RFC.md","formal RFC")]),
        ("Governance & Standards", [("release-standard.md","5-gate process, evidence bundle, security rules"),
                                    ("metric-classification-standard.md","privacy classes, cardinality, DB rules"),
                                    ("REPOSITORY-REQUIREMENTS-AND-DELIVERABLES.md","PR/release gates, SBOM, SOC2, DoD")]),
        ("Implementation Evidence (Core)", [("R1-METRICS-STACK-IMPLEMENTATION-NOTES.md","R1 design, security, validation"),
                                            ("PR-EVIDENCE-ADDON-METRICS-SUPPORT.md","metrics stack PR scope, E2E"),
                                            ("E2E-METRICS-TESTING.md","E2E test procedure")]),
    ]:
        p.cap(0.5)
        p.set_font(FSB, 'B', 10); p.set_text_color(*NAVY)
        p.cell(p.W, 0.22, grp, new_x="LMARGIN", new_y="NEXT")
        for name, desc in docs:
            p.set_font(FM, '', 7); p.set_text_color(*BLUE)
            p.cell(0.22, 0.15, ""); p.cell(3.2, 0.15, name)
            p.set_font(FS, '', 8); p.set_text_color(*BLACK)
            p.cell(0, 0.15, f" — {desc}", new_x="LMARGIN", new_y="NEXT")

    p.ln(0.4)
    p.set_font(FS, 'I', 7); p.set_text_color(*MGRAY)
    p.multi_cell(p.W, 0.14, f"Last updated: {date.today().strftime('%d %B %Y')}. Maintained in yacketrj/dune-ops-observability-addon.", new_x="LMARGIN", new_y="NEXT")
    return p


# ═══════ RFC PDF ═══════

def build_rfc():
    p = PDF(); p.alias_nb_pages()
    L = os.path.join(DIAG, "addon-logo.png")

    # ─ Title ─
    p.add_page()
    if os.path.exists(L): p.image(L, x=(p.w-4.5)/2, y=0.6, w=4.5)
    p.ln(3.2)
    p.set_font(FSB, 'B', 18); p.set_text_color(*NAVY)
    p.cell(p.W, 0.4, "RFC: Dune Ops Observability", align='C', new_x="LMARGIN", new_y="NEXT")
    p.set_font(FSB, 'B', 12)
    p.cell(p.W, 0.3, "Comprehensive Roadmap and Release Cadence", align='C', new_x="LMARGIN", new_y="NEXT")
    p.ln(0.3)
    p.set_font(FS, '', 9); p.set_text_color(*BLACK)
    for l,v in [("RFC ID:", "RFC-DOO-0001"), ("Status:", "Draft"),
                ("Date:", date.today().strftime('%d %B %Y')),
                ("Authors:", "DarkDante (@yacketrj)"),
                ("Target:", "dune-ops-observability-addon, dune-awakening-selfhost-docker (R2-R5)")]:
        p.set_font(FSB, 'B', 9); p.set_text_color(*NAVY)
        p.cell(1.1, 0.2, l)
        p.set_font(FS, '', 9); p.set_text_color(*BLACK)
        p.cell(0, 0.2, v, new_x="LMARGIN", new_y="NEXT")

    # ─ Abstract ─
    p.add_page()
    p.h2("Abstract")
    p.p("This RFC defines the comprehensive roadmap for the Dune Ops Observability addon ecosystem: 5 Core infrastructure releases (R1-R5) and 6 public addon releases (v0.2-v1.0) with explicit cross-track dependencies. The addon release plan consolidates 7 originally planned releases into 4: v0.4 (Game Activity & Combat), v0.5 (Economy & Resources), v0.6 (World & Assets), and v1.0 (SOC/OPS Operations Center). Each release maps to industry-standard metrics and uses an 8-type tagging convention.")

    p.ln(0.15)
    p.h2("Motivation")
    p.p("Critical gaps in the current system:")
    p.li(["No visualization — Prometheus data queryable only via raw PromQL; no Grafana"])
    p.li(["No alerting — 16 alert rules have nowhere to route; no Alertmanager"])
    p.li(["No game telemetry — dune-stack.yml is empty; no player/combat/economy metrics"])
    p.li(["No Prometheus bridge — addon cannot display Prometheus metrics"])
    p.li(["Rate limits in-memory — process restart clears all abuse buckets"])
    p.li(["No proxy-aware IP — X-Forwarded-For not supported"])

    p.ln(0.1)
    p.h2("Goals")
    p.li(["Close all gaps within 4 Core releases (R2-R5)"])
    p.li(["Deliver game telemetry across 3 addon releases (v0.4-v0.6)"])
    p.li(["Graduate to SOC/OPS center at v1.0 after Core R3+R4"])
    p.li(["Maintain formal 5-gate governance with SOC2-style evidence"])

    # ─ Current Architecture ─
    p.add_page()
    p.h2("Current Architecture (R1)")
    p.img("architecture", 5.2, "System architecture: Game Stack, Metrics Stack, Console API, Addon")
    p.tbl(["Component", "Container", "Port", "Access"],
        [["Prometheus", "dune-prometheus", "127.0.0.1:9090", "Local only"],
         ["cAdvisor", "dune-cadvisor", "8080", "Internal"],
         ["Node Exporter", "dune-node-exporter", "9100", "Internal"],
         ["Postgres Exporter", "dune-postgres-exporter", "9187", "Internal"],
         ["RabbitMQ", "dune-rmq-admin/game", "15692", "Internal"]],
        [1.4, 2.0, 1.6, 1.0])
    p.ln(0.05)
    p.p("16 alerts across 4 groups. 7 bridge actions. SOC controls: HMAC sessions, CSRF, login/bridge rate limits, JSONL audit, addon provenance tracking.")

    # ─ Proposed Architecture ─
    p.add_page()
    p.h2("Proposed Architecture")
    p.img("release-pipeline", 5.5, "Core R1→R5 pipeline with Addon cross-dependencies")

    for t,l in [("Core R2: Console Exporter + SOC Foundation",
                 ["Grafana (:3000) + Alertmanager (:9093) — both localhost, Grafana always-on",
                  "dune-stack.yml populated (Console API RED metrics)", "Alertmanager: email+webhook"]),
                ("Core R3: Prometheus Bridge API",
                 ["metrics.query bridge action (safe PromQL subset, ops:read)",
                  "/api/server/metrics endpoint (host CPU/mem/disk)", "Structured logging (JSON Lines)"]),
                ("Core R4: SOC Hardening",
                 ["Redis for persistent rate limits (survives restart)",
                  "X-Forwarded-For + ADMIN_TRUSTED_PROXIES", "Per-addon CSP sandbox"]),
                ("Core R5: Ops Maturity",
                 ["SLO/SLI framework (99.5% uptime, p95<5s, freshness<5min)",
                  "Prometheus retention/backup, audit log rotation", "DORA tracking (deploy freq, MTTR, change fail%)"])]:
        p.cap(0.4)
        p.set_font(FSB, 'B', 10); p.set_text_color(*NAVY)
        p.cell(p.W, 0.22, t, new_x="LMARGIN", new_y="NEXT")
        p.li(l); p.ln(0.03)

    # ─ Addon v0.4-v1.0 ─
    p.add_page()
    p.h2("Addon Release Train (v0.4-v1.0)")
    for n,title,old,metrics,dep in [
        ("v0.4.0","Game Activity & Combat","v0.4+v0.5","Sessions, transitions, retention, deaths by location/cause, PvP/PvE, NPC kills, death spikes","Required: R2 (Grafana+Alertmanager)"),
        ("v0.5.0","Economy & Resources","v0.6+v0.7","Ore/spice/fiber gathering, currency flow, market volume, inflation, scarcity indicators","Required: database discovery"),
        ("v0.6.0","World & Assets","v0.8+v0.9","Crafting volumes, storage pressure, territory hot spots, activity heat maps, base activity","Required: database discovery"),
        ("v1.0.0","SOC/OPS Center","v1.0","Platform health, bridge reliability, Prometheus display, addon drift, runbooks","Required: Core R3+R4")]:
        p.cap(0.4)
        p.set_font(FSB, 'B', 10); p.set_text_color(*PURPLE)
        p.cell(p.W, 0.2, f"{n} — {title}  (merges {old})", new_x="LMARGIN", new_y="NEXT")
        p.set_font(FS, '', 9); p.set_text_color(*BLACK)
        p.multi_cell(p.W, 0.18, f"Metrics: {metrics}", new_x="LMARGIN", new_y="NEXT")
        p.set_font(FS, '', 8); p.set_text_color(*RED)
        p.multi_cell(p.W, 0.16, f"{dep}", new_x="LMARGIN", new_y="NEXT"); p.ln(0.03)

    # ─ Dependency + Tagging ─
    p.add_page()
    p.img("dependencies", 5.2, "Solid: sequential pipelines. Red dashed: Core→Addon coupling")
    p.ln(0.3)
    p.h2("Tagging Convention")
    p.tbl(["Context", "Pattern", "Example", "Repo"],
        [["Core feature merges", "core-{domain}-r{n}", "core-metrics-r2", "Core fork"],
         ["Addon releases", "v{major}.{minor}.{patch}", "v0.4.0", "Addon"],
         ["Addon RCs", "v{major}.{minor}.{patch}-rc{n}", "v0.4.0-rc1", "Addon"],
         ["Addon features", "feature/{area}", "feature/player-activity", "Addon"],
         ["Immutable snapshots", "preserve/{desc}", "preserve/pre-db-discovery", "Addon"]],
        [1.7, 2.2, 1.8, 1.0])

    # ─ Security + Open Issues ─
    p.add_page()
    p.h2("Backwards Compatibility")
    p.p("All existing bridge actions, CLI commands, manifest schema, and versioning remain unchanged. R2-R5 are additive only. No breaking changes planned.")

    p.ln(0.15)
    p.h2("Security Considerations")
    p.img("security", 4.5, "7-layer defense-in-depth model")
    p.ln(0.1)
    p.p("Key rules: Grafana+Alertmanager bind localhost. Redis on internal net with optional AUTH. metrics.query sanitizes PromQL (no unbounded cardinality). X-Forwarded-For only parsed behind trusted proxy CIDR. Per-addon CSP computed from declared permissions. All releases follow non-negotiable security rules from release-standard.md.")

    p.ln(0.15)
    p.h2("Open Issues")
    p.li(["PostgreSQL direct access vs bridge-mediated queries for game telemetry"])
    p.li(["Grafana dashboard provisioning (JSON shipped vs user-built)"])
    p.li(["Alertmanager channels beyond email/webhook (SMS/PagerDuty)"])
    p.li(["Persistent audit log queryability through addon"])
    p.li(["Game telemetry retention policy"])
    p.li(["Core upstream PR scope — which R2-R5 components go to Red-Blink"])

    p.ln(0.4)
    p.set_font(FS, 'I', 7); p.set_text_color(*MGRAY)
    p.multi_cell(p.W, 0.14, f"This RFC is open for review via PR or issue on yacketrj/dune-ops-observability-addon. Last updated: {date.today().strftime('%d %B %Y')}.", new_x="LMARGIN", new_y="NEXT")
    return p


if __name__ == "__main__":
    for fn, fn_builder in [
        ("DUNE-OPS-OBSERVABILITY-ROADMAP.pdf", build_roadmap),
        ("RFC-DUNE-OPS-OBSERVABILITY-ROADMAP.pdf", build_rfc),
    ]:
        out = os.path.join(DOCS, fn)
        pdf = fn_builder()
        pdf.output(out)
        print(f"Wrote: {out}")
