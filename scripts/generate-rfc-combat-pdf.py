#!/usr/bin/env python3
"""Generate RFC-COMBAT-DEATH-TRACKING.pdf from RFC.md + diagrams."""

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
DOCS = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "docs")
DIAG = os.path.join(DOCS, "diagrams")

NAVY = (26,58,92); WHITE=(255,255,255); LGRAY=(240,244,248); MGRAY=(136,153,170)
BLACK = (26,26,26); GREEN=(46,125,50); RED=(211,47,47); ORANGE=(245,124,0); BLUE=(25,118,210)

FS = "DejaVuSans"; FSB = "DejaVuSans-Bold"; FM = "DejaVuSansMono"

class PDF(FPDF):
    def __init__(self):
        super().__init__('P', 'in', 'Letter')
        self.set_auto_page_break(True, 0.7)
        self.set_margin(0.7)
        self.W = self.w - 1.4
        for n,p in [(FS,""),(FSB,"B"),(FS,"I")]:
            self.add_font(n,p,"/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf" if p!="B" else "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf")
        self.add_font(FM,"","/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf")
    def footer(self):
        self.set_y(-0.55); self.set_font(FS,'',7); self.set_text_color(*MGRAY)
        self.cell(0,0.25,f"Page {self.page_no()}/{{nb}}",align='C')
    def h2(self,t):
        self.ln(0.15); self.set_font(FSB,'B',13); self.set_text_color(*NAVY)
        self.cell(self.W,0.32,t,new_x="LMARGIN",new_y="NEXT")
        self.set_draw_color(*MGRAY); self.line(self.l_margin,self.y,self.w-self.r_margin,self.y); self.ln(0.1)
    def h3(self,t):
        self.set_font(FSB,'B',10); self.set_text_color(*NAVY)
        self.cell(self.W,0.24,t,new_x="LMARGIN",new_y="NEXT"); self.ln(0.05)
    def p(self,t):
        self.set_font(FS,'',9); self.set_text_color(*BLACK)
        self.multi_cell(self.W,0.18,t,new_x="LMARGIN",new_y="NEXT")
    def li(self,items):
        self.set_font(FS,'',9); self.set_text_color(*BLACK)
        for i in items: self.cell(0.22,0.17,"\u2022"); self.multi_cell(self.W-0.22,0.17,i,new_x="LMARGIN",new_y="NEXT")
    def img(self,name,w=5.0,cap=""):
        p=os.path.join(DIAG,f"{name}.png")
        if not os.path.exists(p): return
        self.ln(0.08); x=(self.w-w)/2; self.image(p,x=x,w=w)
        if cap:
            self.ln(0.02); self.set_font(FS,'',7); self.set_text_color(*MGRAY)
            self.cell(self.W,0.15,cap,align='C',new_x="LMARGIN",new_y="NEXT")
        self.ln(0.06)
    def tbl(self,headers,rows,cw=None):
        if cw is None: cw=[self.W/len(headers)]*len(headers)
        self.set_font(FSB,'B',8); self.set_fill_color(*NAVY); self.set_text_color(*WHITE)
        for i,h in enumerate(headers): self.cell(cw[i],0.26,f" {h}",border=1,fill=True)
        self.ln(); self.set_font(FS,'',8)
        for ri,row in enumerate(rows):
            self.set_fill_color(*LGRAY if ri%2 else WHITE); self.set_text_color(*BLACK)
            for i,c in enumerate(row): self.cell(cw[i],0.22,f" {c}",border=1,fill=True)
            self.ln()
        self.ln(0.08)

def build():
    p=PDF(); p.alias_nb_pages()
    L=os.path.join(DIAG,"addon-logo.png")

    # ─ Title ─
    p.add_page()
    if os.path.exists(L): p.image(L,x=(p.w-4.0)/2,y=0.6,w=4.0)
    p.ln(2.8)
    p.set_font(FSB,'B',18); p.set_text_color(*NAVY)
    p.cell(p.W,0.4,"RFC: Combat Death Tracking",align='C',new_x="LMARGIN",new_y="NEXT")
    p.set_font(FSB,'B',12)
    p.cell(p.W,0.3,"Via Local Poller",align='C',new_x="LMARGIN",new_y="NEXT")
    p.ln(0.3)
    p.set_font(FS,'',9); p.set_text_color(*BLACK)
    for l,v in [("RFC ID:","RFC-DOO-0002"),("Status:","Draft"),("Date:",date.today().strftime('%d %B %Y')),
                ("Authors:","DarkDante (@yacketrj)"),("Target:","dune-awakening-selfhost-docker core")]:
        p.set_font(FSB,'B',9); p.set_text_color(*NAVY); p.cell(1.1,0.2,l)
        p.set_font(FS,'',9); p.set_text_color(*BLACK); p.cell(0,0.2,v,new_x="LMARGIN",new_y="NEXT")

    # ─ Page 2: Abstract + Motivation ─
    p.add_page()
    p.h2("Abstract")
    p.p("The dune database does not store cumulative combat death data. The event_log table (31 partitions) and game_events table record building/interaction events but contain zero combat-related rows. Funcom's backend (FLS) aggregates per-server death/kill metrics server-side but exposes no public query API.")
    p.ln(0.05)
    p.p("This RFC proposes a lightweight local poller that snapshots player_state.life_state transitions to populate a player_death_log table, enabling the addon's Combat tab via the ops.combat.deaths bridge action.")

    p.ln(0.15)
    p.h2("Motivation")
    p.h3("Current State")
    p.tbl(["Source","Status","Reason"],[
        ["event_log (31 partitions)","0 rows","Only logs economy transactions (solaris category)"],
        ["game_events","3 rows","Building/totem events only — no combat"],
        ["actor_audit","27 rows","Building actor lifecycle — no deaths"],
        ["player_state.life_state","Current-state","Shows Alive/Dead — no history"],
        ["Funcom FLS","Backend-only","Director pushes data, no query API"]],
        [1.5,1.2,4.3])

    p.ln(0.05)
    p.h3("Analysis")
    p.p("The game engine tracks death causes natively — the playerlifestate enum includes Dead, DeadByCoriolis, and DeadBySandworm. However, none of these are persisted as cumulative counters locally. The data is sent to Funcom's backend where they aggregate it for their public metrics visual. There is no API to retrieve this data back.")

    # ─ Page 3: Architecture ─
    p.add_page()
    p.h2("Proposed Architecture")
    p.img("death-poller-architecture",5.0,"Data flow: player_state → death poller → player_death_log → bridge → addon Combat tab")
    p.ln(0.3)
    p.img("death-poller-state",5.0,"State machine: Alive → Dead transition detection with idempotency")

    p.ln(0.15)
    p.h2("Schema")
    p.set_font(FM,'',8); p.set_text_color(60,60,60)
    p.multi_cell(p.W,0.15,"""CREATE TABLE IF NOT EXISTS dune.player_death_log (
  id bigint GENERATED ALWAYS AS IDENTITY,
  player_controller_id bigint NOT NULL,
  death_time timestamptz NOT NULL DEFAULT now(),
  death_cause text NOT NULL,
  PRIMARY KEY (id)
);""",new_x="LMARGIN",new_y="NEXT")
    p.ln(0.05)
    p.p("The death_cause column stores the raw life_state::text value: Dead, DeadByCoriolis, DeadBySandworm. No PII is stored — only player_controller_id (internal identifier).")

    # ─ Page 4: Component specs ─
    p.add_page()
    p.h2("Component Specifications")
    p.h3("deathPoller.js")
    p.p("New module at console/api/src/deathPoller.js, following the exact pattern of memoryBalancer.js:")
    p.li(["In-process: setInterval with .unref() — no separate process or container"])
    p.li(["State: runtime/generated/death-snapshot.json stores last known life_state per player"])
    p.li(["Lock boolean prevents overlapping polls"])
    p.li(["Error suppression for transient DB errors (ECONNREFUSED, etc.)"])
    p.li(["Interval: 10 seconds (configurable via ADMIN_DEATH_POLL_INTERVAL_MS)"])

    p.ln(0.1)
    p.h3("addonOpsCombatDeaths() in duneDb.js")
    p.p("Queries player_death_log for aggregate counts. Returns:")
    p.li(["totalDeaths, pvpDeaths (0), pveDeaths"])
    p.li(["deathsByCause: [{ cause: 'Sandworm', count: N }, ...]"])
    p.li(["deathsByMap: [] — not tracked"])
    p.li(["topHostileNpcs: [] — NPC kill data is backend-only"])
    p.li(["kdRatio: null — no kill count available"])

    p.ln(0.1)
    p.h3("Bridge Route")
    p.p("ops.combat.deaths follows the exact same pattern as ops.activity.summary: permission check (ops:read), query, audit log, 200 JSON response.")

    # ─ Page 5: Security ─
    p.add_page()
    p.h2("Security Review")
    p.h3("Data Exposure")
    p.tbl(["Field","Classification","Rationale"],[
        ["player_controller_id","Internal only","Used for snapshot diffing only — not in responses"],
        ["death_time","Aggregate only","Bridge returns counts grouped by cause"],
        ["death_cause","Safe aggregate","Enum string — no PII, no coordinates"],
        ["Bridge response","Aggregate counts","Zero individual player data"]],
        [1.5,1.2,4.3])

    p.ln(0.1)
    p.h3("Attack Surface")
    p.tbl(["Concern","Mitigation"],[
        ["SQL injection","Parameterized db.query(text, values) — no string interpolation"],
        ["Table creation","dune user already has ALL PRIVILEGES on dune schema"],
        ["Write access","Poller is sole INSERT source. Bridge is SELECT-only"],
        ["Rate limiting","Bridge inherits bridgeRateLimiter (60/min, 300/min global)"],
        ["Audit","Every bridge call audited to web-admin-audit.jsonl"],
        ["Idempotency","Snapshot-based diffing prevents double-counting on restart"],
        ["Snapshot file","Written with mode 0o600"]],
        [1.8,5.2])

    p.ln(0.1)
    p.set_font(FSB,'B',9); p.set_text_color(*RED)
    p.multi_cell(p.W,0.18,"Non-Negotiable Rules (per release-standard.md): raw player rows, player IDs, account IDs, character names, coordinates, SQL text, tokens, passwords, secrets — none are exposed through this bridge action.",new_x="LMARGIN",new_y="NEXT")

    # ─ Page 6: Limitations + Timeline ─
    p.add_page()
    p.h2("Limitations")
    p.tbl(["Limitation","Impact","Mitigation"],[
        ["No historical backfill","Deaths before deployment not captured","Counts start from deploy time"],
        ["No PvP vs PvE","pvpDeaths always 0","life_state doesn't distinguish cause"],
        ["No NPC kill tracking","topHostileNpcs always empty","NPC kills are Funcom backend-only"],
        ["No map tracking","deathsByMap always empty","death location not in player_state"],
        ["Single process","Poller stops if Console restarts","Snapshot prevents double-counting"]],
        [1.5,2.2,3.3])

    p.ln(0.15)
    p.h2("Deployment Timeline")
    p.img("death-poller-timeline",5.5,"Before → Deploy Poller → After (counts accumulate over time)")
    p.ln(0.1)
    p.h3("Phases")
    p.li(["Phase 1: Deploy poller + bridge action to e2e. Verify combustion tab populates."])
    p.li(["Phase 2: Submit upstream PR with RFC as supporting evidence."])
    p.li(["Phase 3: Open upstream issue requesting Funcom FLS metrics API for historical data."])

    p.ln(0.15)
    p.h2("Open Issues")
    p.li(["Funcom FLS metrics endpoint — request per-server query API"])
    p.li(["PvP classification — explore cheater_tracking, encounters_static tables"])
    p.li(["NPC kill tracking — enhance actor_audit for NPC death events"])
    p.li(["Polling interval tuning — default 10s may miss rapid death cycles"])
    p.li(["Retention policy — player_death_log grows unbounded"])

    p.ln(0.4)
    p.set_font(FS,'I',7); p.set_text_color(*MGRAY)
    p.multi_cell(p.W,0.14,f"This RFC is open for review via PR or issue on yacketrj/dune-awakening-selfhost-docker. Last updated: {date.today().strftime('%d %B %Y')}.",new_x="LMARGIN",new_y="NEXT")
    return p

if __name__=="__main__":
    out=os.path.join(DOCS,"RFC-COMBAT-DEATH-TRACKING.pdf")
    p=build(); p.output(out); print(f"Wrote: {out}")
