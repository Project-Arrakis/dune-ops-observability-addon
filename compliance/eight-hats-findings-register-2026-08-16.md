# dune-ops-observability-addon — Eight-Hats Findings Register

**Date:** 2026-08-16 | **Version at review:** `main` @ `22ad998` (unreleased, post-0.5.1)
**Review scope:** Addon scope/UX review, prompted by a user request to rethink
the addon's tab count and evaluate a "world-class metrics board" proposal
(per-container health + RabbitMQ + Postgres metrics + a combined rollup,
individually and combined), plus better player metrics (count/online/
retention) and possible in-game exchange data.
**Trigger:** the most recent commit on `main` at review time was
`22ad998` ("revert: remove containerHealth feature — broken tabs"), the
end of an 8-commit hotfix chain (see issue #120). The review consequently
expanded from a pure scope/UX question into a full incident review of
that episode, since building new UI on top of an already-broken addon
would compound the problem, not solve it.
**Status key:** ✅ Resolved | 📝 Documented | 🔧 Needs Fix | 🐛 Issue Filed | ⏳ Deferred

This is a **second, separate, dated register** — it does not replace or
duplicate `compliance/eight-hats-findings-register.md` (2026-08-07,
v0.4.7), which remains an accurate historical record of that earlier
review's own findings (several of which, e.g. H-2/branch protection, are
independently re-confirmed as still-open by this review too).

---

## Executive summary

The addon is currently **non-functional on `main`** (SRI hash drift,
issue #119/#125-dup) following an incompletely reverted feature
(`containerHealth`, issue #120), and CI has been red for 6 days
following an unrelated pre-existing bug (issue #122). All three are
already filed. This register's job is to add the *scope/UX* findings
that were not yet captured anywhere, and to formally supersede the
2026-08-08 L1 design doc's expansion plan with a narrower recommendation.

**Direct answer to "is the addon too broad, or is it a UX problem":
both, and they share a root cause.** The addon already has a working
rollup pattern (NOC Overview) and a working per-instance drill-down
pattern (Spice Melange's card layout) — the scope problem is that these
patterns were never finished or reused, and three placeholder tabs
(AAA/NOC Infra/Audit) were shipped into primary navigation ahead of the
Core work (R3) they depend on, which doesn't exist yet.

---

## CRITICAL / Blocking Findings (3) — all pre-existing, independently re-confirmed, already filed

### C-1: Addon is completely non-functional on `main` (SRI hash drift)
**Status:** 🐛 Issue Filed (#119, duplicate #125 closed same session) | **Hat:** QA/Test, GRC
Independently re-verified via direct SHA-384 recomputation of
`web/addon.js`/`web/data-providers.js` against `web/index.html`'s
declared `integrity=` attributes — both mismatch. A browser's SRI check
silently blocks both scripts; no tab responds. Confirmed live on `main`
at time of this review.

### C-2: `containerHealth` revert (`22ad998`) is incomplete
**Status:** 🐛 Issue Filed (#120) | **Hat:** Architect, QA/Test, GRC
`web/addon.js`/`web/data-providers.js` still reference
`containerHealth`/`getContainerHealth`/`ops.health.containers` in the
tab-click lazy-load path, while `web/index.html`'s NOC Infra tab body
still renders a live container table contradicting its own nav button's
"Requires Core R3" placeholder title. Causes the one real `npm test`
failure (56/57, not the CHANGELOG's claimed 57/57 — see C-3).

**Root cause, newly established by this review (not previously
documented anywhere in this repo):** the actual defect that caused
"broken tabs" was a **one-line syntax/logic error in a different repo**
(`dune-awakening-selfhost-docker`'s `server.js`, missing `if (` before
the `ops.health.containers` route guard, commit `7ea2011f`) — not a
defect in this addon's own code. Because the guard's condition
degraded to a discarded comparison expression followed by an
unconditional block, **any bridge action not matched by an earlier
`if` in the chain silently fell through and returned container-health
data instead of its own** — an action-hijack bug, not a data-shape
mismatch. Six of the eight hotfix commits in this repo
(`d4e9572` through `4023320`) were chasing symptoms of that Core-side
bug from inside this repo, where it could never be fixed. Core fixed
its own bug independently, one minute before this repo's last hotfix
commit and 36 minutes before the revert — meaning **the feature was
reverted after the actual root cause had already been fixed
upstream**, unnoticed, because nothing in either repo's process
includes checking the other repo's commit log during a live incident.

**New recommendation (not in issue #120):** before deciding "finish the
revert" vs. "finish implementing it," re-test `containerHealth` against
current Core `main` (which has the fix) — it may already work. If it
does, Option B (finish implementing) is now far cheaper than issue
#120 assumed when written, since the actual blocking defect is already
gone. See also C-4 below: do not re-enable this feature's live
`docker stats` call until the separate, still-unmerged scoping/blocking
fix (`dune-awakening-selfhost-docker` branch
`fix/240-container-health-async-scoped`) lands in Core first (Security
Architect finding).

### C-3: CHANGELOG's "57/57 tests pass" claim is currently false
**Status:** 🔧 Needs Fix (this register + accompanying commit) | **Hat:** GRC, QA/Test
`CHANGELOG.md:35` (`[0.5.1]` entry, `### Changed`) states "All 57 tests
pass. No regressions." Independently re-run: 56/57 (the C-2 failure).
The claim was true when written (before the containerHealth branch
merged the same day) but has not been corrected since, and the
`[0.5.1]` entry's dating makes it read as describing `main`'s current
state. Separately, the `[0.5.1]` entry has **no entry at all** for the
`containerHealth` build/hotfix/revert episode — a reader of the
CHANGELOG alone would not know it happened. Fixed in the same commit
that adds this register (see repo history immediately following this
file's own commit).

---

## HIGH Findings (6) — new to this review, plus 1 pre-existing re-confirmed

### H-1: Unscoped, blocking `docker stats` exec in `addonOpsContainerHealth` (Core repo)
**Status:** 🔧 Needs Fix, unmerged fix exists | **Hat:** Security Architect
`dune-awakening-selfhost-docker`'s `duneDb.js` (`addonOpsContainerHealth`)
shells out to `docker stats --no-stream` with no `--filter`, returning
stats for **every container on the host**, not just this project's own
— to any addon holding `ops:read`. Also blocking (`execSync`), stalling
the Console API event loop for the call's duration. A fix (async,
project-scoped) already exists, tested, on Core branch
`fix/240-container-health-async-scoped`, but is **not merged to
`main`**. Must merge before any container-health UI is re-enabled or
expanded — building a bigger, more prominent UI on top of a
known-broken backend function would ship a more visible surface for an
already-identified defect.

### H-2: Grafana ships a static, unrotated `admin`/`admin` default credential
**Status:** 🔧 Needs Fix | **Hat:** Cloud Security Engineer
`docker-compose.metrics.yml` (Core): `GF_SECURITY_ADMIN_PASSWORD:
${METRICS_GRAFANA_PASSWORD:-admin}` — no generation logic exists
anywhere, unlike every other secret in this project (RMQ, Funcom token,
command-auth-token all use `openssl rand -hex` generation).
Additionally, issue #103 in that repo (closed as "Fixed") only added a
text warning to the addon's UI copy — the underlying
`GF_AUTH_ANONYMOUS_ENABLED: true` default was never actually changed.
Per this project's own stated principle (README, re: issue #66): "a
closed issue for something still live is exactly the failure mode this
requirement exists to catch." Recommend reopening #103 or filing a new
issue distinguishing "documented" from "fixed."

### H-3: Grafana iframe embedding is structurally broken on this project's own live production console
**Status:** 🔧 Needs Fix or explicit scope decision | **Hat:** Network Engineer, Cloud Security Engineer
`web/index.html`'s CSP (`frame-src 'self' http://localhost:3000`) and
hardcoded `http://localhost:3000` iframe URLs mean the Grafana tab is
**mixed-content-blocked on any HTTPS console** — including this
account's own real, documented production deployment
(`console.darkdante.org`, Cloudflare Tunnel + HTTPS, per the
Arrakis-Project meta-repo README's Live Systems section). This is not
hypothetical: it is the account's own primary console exposure pattern
today. The addon's own fallback copy already discloses the mixed-content
block but proposes a reverse-proxy fix that does not work as stated
without also rewriting the CSP and hardcoded iframe URLs. **Do not build
new Grafana-iframe-dependent UI until this is fixed** (Console-side
proxy recommended over a new public Cloudflare Tunnel ingress rule, per
the Cloud Security hat's blast-radius analysis) or explicitly scoped
out as "does not work over HTTPS, by design, until proxied."

### H-4: RabbitMQ health features must not reuse the fragile `rabbitmqctl eval` pattern or the game RMQ instance's broad port exposure
**Status:** 📝 Documented, design constraint for future work | **Hat:** Security Architect, Network Engineer
`RMQ_GAME_PORT`/`RMQ_GAME_HTTP_PORT` are bound on all interfaces (no
`127.0.0.1:` prefix), unlike the admin RMQ instance — a real,
already-tracked exposure in Core's own security docs. RabbitMQ's
management HTTP API can expose queue *contents*, not just counts, if
queried carelessly; the existing Prometheus RMQ metrics (already
scraped, already loopback-scoped) expose counts/rates only. **Any new
RMQ-health bridge action must use the Prometheus/RabbitMQ-Prometheus-
plugin path exclusively** — never `rabbitmqctl eval` or the management
API's queue-contents endpoints.

### H-5: `enforce_admins: false` — branch protection does not protect `main` from its own owner
**Status:** 🐛 Issue Filed (#85, pre-existing since 2026-08-08, independently re-confirmed live today) | **Hat:** GRC, QA/Test
Confirmed via direct `gh api` call: `enforce_admins.enabled: false`.
This is exactly how 8 unreviewed commits landed directly on `main`
during the `containerHealth` incident (verified: linear commit chain,
zero merge commits, `18052ac..22ad998`). This finding was already
filed 8 days before this review (issue #85, from the 2026-08-07
register's H-2) — re-confirmed here because it is the single highest-
leverage fix for preventing a repeat of the exact incident this
register otherwise documents.

### H-6: No cross-repo bridge-action contract test exists
**Status:** 🔧 Needs Fix, net-new finding | **Hat:** QA/Test
No test in either this repo or `dune-awakening-selfhost-docker` would
catch a bug like C-2's root cause (an action-fallthrough logic error in
Core's route dispatcher). `check-bridge-action-drift.js` only verifies
that this repo's own README and code agree with each other — it has no
visibility into whether Core's server actually implements a route
correctly. Confirmed via direct code reading that `node --check` does
not reliably catch this exact class of bug either (the broken line is
syntactically valid once parsed as a discarded expression statement
followed by a block). **Recommended minimum fix:** a Core-side test
that dispatches every documented `ops.*` action and asserts no two
actions return each other's payload shape — this alone would have
caught the actual incident.

---

## MEDIUM Findings (5) — UX/scope, net-new to this review

### M-1: 13-14 flat tabs, no grouping, ~1/3 are inert placeholders
**Status:** 🔧 Needs Fix, informs recommendation below | **Hat:** UI Design/Architect
3 tabs (AAA, NOC Infra, Audit) show `title="Requires Core R3"` — visible
but permanently non-functional pending a Core release with no ETA
visible anywhere in the UI. 1 tab (Location) is a deliberate, honestly-
labeled permanent placeholder (correct pattern — see `docs/tabs/
LOCATION.md`). 1 tab (Diag) is an explicit dev-debugging tool
("Do not share screenshots") shipped in primary nav for every install.
Over a third of the nav costs the operator a click-and-disappointment
cycle every session. Nine visually distinct card/table patterns exist
for what is fundamentally two shapes of data (a number, a table row);
three of those (`metric-card`/`kpi-card`/`health-card`) are CSS-
identical and should be one class.

### M-2: NOC Overview already attempts the "combined rollup" the user asked for — unfinished, partially broken
**Status:** 🐛 Issue Filed (#77, Service Health Map defect specifically) | **Hat:** UI Design/Architect, Architect
NOC Overview already has 5 rollup panels (OPS health totals, addon read
health, Service Health Map, Server Resources, Deployment Health). One
(Service Health Map, issue #77) promises 7 named services and renders 5
unrelated addon-diagnostic rows instead. Another (Server Resources) is
permanently hardcoded to "—". The Players tab duplicates 4 of the same
numbers already shown on Overview (documented in `docs/tabs/
PLAYERS.md` §1.1). **This page is the addon's existing rollup pattern
— it needs to be finished and de-duplicated, not replaced with a new
tab or a Grafana embed.**

### M-3: Existing `addonOps*` queries are full-table-scan/multi-join, safe today only because there is no auto-refresh timer
**Status:** 📝 Documented, design constraint for future work | **Hat:** DBA
`addonOpsHealthPlayers`/`addonOpsActivitySummary` run unindexed full
scans against `dune.player_state` (itself a view over an
encrypted-backing table, not a plain indexed table — verification gap:
whether the underlying view's filter is index-backed is unknown from
this codebase, Funcom-owned schema). `addonOpsInventorySummary`'s
`listStorage()` includes a per-row correlated `LATERAL` join — the
single most expensive query in the addon's surface. **Confirmed: these
queries only run on manual "Refresh" click today, not a background
timer.** The real live-database risk in any "make it feel live"
metrics-board redesign is adding an automatic refresh interval to
these *existing* queries, not the new container/RMQ/PG work, which
(per Finding M-4) touches Docker/RabbitMQ/Postgres-catalog-views only,
never `dune.*` game tables.

### M-4: "Player retention" requires new persisted history — does not exist today, but is a small, well-precedented addition
**Status:** 🔧 Needs design, not urgent | **Hat:** DBA, UI Design/Architect
No persisted-history mechanism exists anywhere in this addon's data
model — every metric is a live snapshot. The addon's only existing
trend precedent is `playerDeltaLabel()`'s in-session-only delta
("+3 players since last refresh"), which resets on page reload. A real
retention feature needs a new, additive-only table
(`console.player_count_snapshots`, proposed schema below) populated by
an hourly background tick reusing the *existing*
`addonOpsActivitySummary` aggregate — not a new live query. This is
architecturally new (the addon's first persisted-history mechanism)
but small and follows this project's own established patterns
(`console` schema per `duneDb.js`'s existing convention;
`deathPoller.js`'s existing background-tick pattern).

```sql
CREATE TABLE IF NOT EXISTS console.player_count_snapshots (
  id               bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  captured_at      timestamptz NOT NULL DEFAULT now(),
  total_players    int NOT NULL,
  online_players   int NOT NULL,
  new_players_24h  int,
  returning_7d     int,
  inactive_30d     int
);
CREATE INDEX IF NOT EXISTS idx_player_count_snapshots_captured_at
  ON console.player_count_snapshots (captured_at);
```
Rollback: `DROP TABLE IF EXISTS console.player_count_snapshots;` — no
other table references it. Already-tracked as issue #98 (G-1/G-2,
"Player retention cohorts and session duration") — this finding adds
the concrete schema and sourcing strategy that issue did not yet have.

### M-5: `docs/design/metrics-l1-design-audit-2026-08-08.md`'s 11→14 tab expansion plan is superseded
**Status:** 🔧 Fixed in this session (see commit adding a supersession notice to that file) | **Hat:** UI Design/Architect, GRC
That L1 design (Requirement 20, Layer 1) planned expanding to 14 tabs
over 6 phases (~8 weeks), adding AAA/NOC-Infra/Audit permanently to
primary navigation ahead of the Core R3 work (Phase 1) those tabs
depend on. Phase 1 never started; Phase 0 (the lazy-loading refactor +
the 3 placeholder tabs) shipped anyway the same day, and the later,
unplanned `containerHealth` episode (this register's C-2) was a
separate, ad hoc attempt to deliver Phase 3's NOC Infra content ahead
of Phase 1 — confirming in practice that shipping placeholder tabs
before their dependency exists creates exactly the kind of scope
pressure this register's M-1 finding describes. Per direct maintainer
decision (2026-08-16): this plan is superseded by M-1's recommendation
(hide the 3 placeholder tabs until Core R3 is real; finish NOC Overview
instead of building 3 new tabs). The design doc itself is retained,
marked superseded, not deleted.

---

## Recommendation (supersedes `docs/design/metrics-l1-design-audit-2026-08-08.md`)

1. **Fix C-1/C-2/C-3 first.** Nothing below should start until `main` is
   genuinely green and the addon loads for every operator again.
2. **Do not build a new "metrics board" tab or expand Grafana usage.**
   Re-enable `containerHealth` (once H-1's Core-side fix is merged)
   inside a **rebuilt NOC Overview**, using the addon's own best
   existing visual pattern (Spice Melange's per-instance colored cards)
   for "one rollup number + individual drill-down cards" — this
   directly satisfies the original "one graph, individually and
   combined" request without Grafana, without new iframe/mixed-content
   risk, and without new bridge-action sprawl.
3. **Hide AAA, Audit, and NOC Infra from primary navigation** until
   Core R3 actually exists — presentation-only change, zero data risk,
   cuts perceived scope from 14 tabs to ~9 without removing a feature.
4. **RMQ/PG health**: add via the already-existing, already-loopback-
   scoped Prometheus exporters only (H-4's constraint) — never via
   `rabbitmqctl eval` or a new SQL query against `dune.*` tables.
5. **Retention**: implement M-4's schema as its own small, scoped
   feature (issue #98) — not bundled into the container-health
   re-enablement.
6. **Process fix, independent of all of the above**: set
   `enforce_admins: true` (issue #85) and add the minimum cross-repo
   contract test (H-6) before any of items 2-5 begin, so a repeat of
   this exact incident class is structurally harder, not just
   documented as a lesson learned.
