# dune-ops-observability-addon — Eight-Hats Findings Register

**Date:** 2026-08-17 | **Version at review:** `main` @ `03c3cac` (post-#133,
all 3 NOC Overview rebuild PRs merged)
**Review scope:** Full addon UX/architecture review, prompted directly by
user request: "lets engage the proper hats to review the current add-on
and provide improvements." All eight hats were dispatched as independent
worker agents (per this project's own Requirement 20 discipline — never
reasoned through solo), each given the full addon plus relevant Core
bridge code and instructed to verify every claim against real file
contents/command output rather than trust any prior summary.
**Status key:** ✅ Resolved | 📝 Documented | 🔧 Needs Fix | 🐛 Issue Filed | ⏳ Deferred

This is a **third, separate, dated register** — it does not replace or
duplicate `compliance/eight-hats-findings-register.md` (2026-08-07,
v0.4.7) or `compliance/eight-hats-findings-register-2026-08-16.md`
(containerHealth incident + scope review). Several findings below are
independent re-confirmations that specific items from the 2026-08-16
register are still open despite that register's own tracking issue
(#128) showing closed — see Finding G-1, the headline result of this
review.

---

## Executive summary

**Three of the eight independently-dispatched hats (Architect, GRC, UI
Design/Architect) converged on the same root finding without
coordinating with each other**: issue #128, closed 2026-08-16 as
resolving the prior register's scope-reduction recommendation, did not
actually ship 2 of its 4 concrete code-level asks. AAA/NOC
Infra/Audit tabs are still in primary navigation with no ETA; the Diag
tab is still shipped to every operator; the CSS card-class
consolidation never happened. Worse, the *newer* L1 design doc for the
#133 rebuild (`docs/design/noc-overview-rebuild-l1-design-2026-08-17.md`,
written the same day this review started) contains a sentence
asserting these tabs are "correctly hidden... per the 2026-08-16
register" — a false claim that shipped through 3 real, merged PRs
(#134/#135/#136) with nobody catching it before now.

**Every hat that touched the recent NOC Overview rebuild's own new
code (the container grid, Postgres/RabbitMQ metrics, fleet rollup,
auto-refresh timer) confirmed it independently — the rebuild itself is
solid.** Security and Network both independently verified the new
bridge actions add zero attack surface; DBA independently confirmed
the auto-refresh timer's own safety claim by tracing all 4 scoped
functions' real signatures; QA confirmed 74/74 tests pass with real,
comprehensive coverage of every new function. The problems found in
this review are concentrated in **process** (tracking drift,
under-tested legacy render functions, an unimplemented prior
recommendation) — not in the newest code.

---

## CRITICAL Findings (1)

### G-1: Issue #128 marked closed/Done; 3 of its 4 concrete recommendations were never shipped, and a newer design doc now falsely asserts they were
**Status:** 🔧 Needs Fix (this register + a follow-up issue) | **Hats:** Architect, GRC, UI Design/Architect (independently convergent)

`web/index.html:52-56` still renders `<button class="tab infra-tab" data-tab="aaa">`, `data-tab="noc-infra"`, `data-tab="audit"` (all with `title="Requires Core R3..."` and no ETA anywhere in the UI) and `<button class="tab" data-tab="diag">` — all four unchanged, still in primary `#tab-nav`, exactly as the 2026-08-16 register originally found them. `git show --stat 944e682` (the commit that closed #128) touches only `CHANGELOG.md`, `compliance/README.md`, a findings-register doc, and a design-doc supersession note — **zero HTML/CSS/JS changes**. `web/addon.css:391-447` still declares `.metric-card`/`.kpi-card`/`.health-card` as three separate classes (M-1's consolidation ask), unimplemented.

**New, independently-discovered aggravating factor** (UI Design/GRC): `docs/design/noc-overview-rebuild-l1-design-2026-08-17.md:91-92` states *"AAA/AUDIT tab work (issues #94/#95 — still blocked on Core R3, **still correctly hidden/placeholder per the 2026-08-16 register**)"* — directly contradicted by the actual markup. This design doc governed 3 real, merged PRs (#134/#135/#136); none of their reviews caught this false claim.

**Impact**: this is the exact "closed issue for something still live" failure mode this project's own README names explicitly (re: issue #66) — now recurring inside the project's own most recent audit trail, one week later, with a design doc confidently repeating the false claim rather than catching it.

**Recommendation**: File a new, scoped issue for the 3 unshipped items (hide AAA/NOC-Infra/Audit from primary nav, move Diag out of primary nav, consolidate the CSS card classes) rather than reopening #128 verbatim (since #128's item 2, the NOC Overview rebuild itself, genuinely did ship). Correct the false sentence in the L1 design doc in the same session this is found, per Requirement 14. Change the Project Arrakis board status for #128 to reflect partial completion, or split it.

---

## HIGH Findings (5)

### H-1: 4 of 18 render functions have zero real test coverage
**Status:** 🔧 Needs Fix | **Hat:** QA/Test

`renderLocation`, `renderSoc`, `renderSystemServicesTable`, `renderFarmSummary` — confirmed via direct grep of `test/addon-rendering.test.js` for each function's own DOM selectors (`#loc-*`, `#soc-*`, `#noc-system-service-body`, `#noc-farms-*`): zero matches for all four. This is precisely the class of gap that already produced a real, shipped defect once before (the false-zero rendering bug that `addon-rendering.test.js` itself exists to prevent) — "74/74 tests pass" is true, but says nothing about whether these four functions currently work correctly.

### H-2: Issue #114 is stale — 2 of its 4 named functions no longer exist in the codebase
**Status:** 🔧 Needs Fix (update, don't close) | **Hat:** QA/Test

Issue #114 asks for test coverage of `renderLocation`, `renderSoc`, `renderNocService`, `renderNocResources`. The latter two were removed/replaced during the #133 rebuild (confirmed via `grep -rn` returning zero hits, and `git log -S` showing they haven't existed since before the rebuild's first commit) — testing them is now impossible because they don't exist. The issue makes no mention of their real successors (`renderFarmSummary`, `renderSystemServicesTable`, `renderKpis` — see H-1), which inherited the same untested gap. Recommend updating #114 in place: drop the two ghost functions, add the three real current gaps.

### H-3: `RMQ_GAME_HTTP_PORT` (default 31983) bound on all interfaces, completely undocumented
**Status:** 🔧 Needs Fix (Core repo) | **Hats:** Security Architect, Network Engineer (independently convergent)

`runtime/scripts/start-rabbitmq.sh:123` — `-p "${RMQ_GAME_HTTP_PORT}:15672/tcp"`, no `127.0.0.1:` prefix, unlike the admin instance one line up. This is RabbitMQ's own management HTTP API (queue enumeration/purge/message-content access), gated only by an internal auth-delegation service not designed as an internet-facing authorization boundary. Unlike its sibling `RMQ_GAME_PORT` (documented in `README.md`'s port-forwarding table, at least a deliberate, reviewed exposure), `31983` appears **nowhere** in any operator-facing doc — grepped `README.md`, `.env.example`, `docs/**/*.md`, zero hits. Looks like an accidental byproduct of copy-pasting the `-p` pattern rather than a reviewed decision. New finding, no existing issue found on either repo.

### H-4: Grafana's `admin`/`admin` default password has no generation mechanism, unlike every other secret in this repo
**Status:** 🔧 Needs Fix (Core repo) | **Hats:** Security Architect, Cloud Security Engineer (independently convergent); previously flagged as H-2 in the 2026-08-16 register

`docker-compose.metrics.yml:109-111` — `GF_SECURITY_ADMIN_PASSWORD: ${METRICS_GRAFANA_PASSWORD:-admin}`, `GF_AUTH_ANONYMOUS_ENABLED: "true"`. No `ensure_grafana_password()`-style generator exists anywhere in `runtime/scripts/*.sh`, despite this exact pattern (`openssl rand -hex` on first run, `chmod 600`) already being the established convention for the RMQ secret, the alert-relay token, the FLS API key, etc. **New GRC finding on top of this**: issue #103 in this addon repo was closed claiming this was "fixed" when only a UI warning was added to `index.html` — the 2026-08-16 register itself recommended reopening #103 a day before this review, and that recommendation was never acted on either. Currently dormant only because `grafana.darkdante.org` has no live Cloudflare Tunnel ingress yet (confirmed via the meta-repo README) — but that wiring is already tracked, planned work (`r740-dune-deployment-kit#91`), so shipping it before this fix lands would convert a dormant gap into a live, trivially-exploitable default-credential exposure with zero additional attacker effort.

### H-5: No cross-repo bridge-action contract test exists — the exact defect class that caused the prior real incident is still uncaught by any test
**Status:** 🔧 Needs Fix, net-new to the 2026-08-16 register, still unfixed | **Hat:** GRC (re-confirming register's own H-6)

No test in either repo asserts that distinct `ops.*` bridge actions return distinct, non-overlapping payload shapes — the exact class of bug (an action-fallthrough dispatcher bug in Core) that caused the `containerHealth` incident (8 hotfix commits, addon non-functional for 6+ days). Confirmed via grep of `console/api/test/bridgeActions.test.js`/`bridgeIntegration.test.js`: zero matches for any fallthrough/hijack-style assertion. No GitHub issue tracks this on either repo.

---

## MEDIUM Findings (9)

### M-1: 5-6-way manually-synced tab/provider registry, getting worse each PR (issue #83, still open)
**Status:** 🐛 Issue filed (#83), still open, condition worsening | **Hat:** Architect

`_tabProviders`, `_providerMethod`'s map, `SOURCE_NAMES`, the `Promise.allSettled([...])` array in `refreshAll()`, the destructuring assignment immediately after, and now a 6th, narrower list for the auto-refresh scope — six separate, manually-maintained registries of "which source/tab/provider-method exists." Adding a new source today requires editing at minimum 5 of these; missing one produces a silent behavior gap, not a build error. This is the same bug class that already cost 3 hotfix commits during the #117/#118 incident. Confirmed the underlying issue (#83, filed 2026-08-07 against a 4-way version) has gotten *worse*, not better, across three feature PRs (#134/#135/#136) that each touched this exact code without consolidating it.

### M-2: New `.container-tile` CSS class duplicates `.res-instance-card` byte-for-byte instead of extending it
**Status:** 🔧 Needs Fix, new instance of unresolved M-1 (2026-08-16 register) | **Hat:** Architect

`web/addon.css:819-826` and `:1079-1090` have identical `border`/`border-radius`/`padding`/`background`/`box-shadow`/`transition` declarations, confirmed via direct text diff. The PR that introduced `.container-tile` (#134) — whose own design doc cites "reuses three already-established patterns" as an architectural win — added a 4th near-identical card class instead of generalizing a shared base class.

### M-3: Dead "S2S Connections" metric will show "—" forever on every install, indistinguishable from an honest empty state
**Status:** 🔧 Needs Fix or removal | **Hat:** UI Design/Architect

`web/addon.js` reads `totals.incomingS2s`/`totals.outgoingS2s` (lowercase), but `normalizeOpsHealth()` never populates any such field — Core's real field names are `incomingS2SConnections`/`outgoingS2SConnections` (capital S2S). Even the addon's own preview/sample fixture has no such field. `docs/tabs/NOC-OVERVIEW.md` falsely documents this as "real, sourced from a live query." Will render "—" forever on every install, with zero way for an operator to distinguish this wiring bug from a genuine, honest absence of data. New finding, not previously tracked.

### M-4: Freshness badges render "fresh" on permanently-inert placeholder tabs — a direct, visible contradiction on the same screen
**Status:** 🔧 Needs Fix | **Hat:** UI Design/Architect

`updateFreshnessBadges()` selects `.section-heading h2, h3` with no scoping — confirmed via jsdom parse, 25 headings match, including AAA/NOC Infra/Audit (all three Core-R3-gated placeholders) and Location (permanently out of scope by design). After any successful refresh, all 25 get the same green "fresh · Ns ago" badge, including panels whose own body simultaneously says "Planned — requires Core R3" a few lines below. New finding, currently live and untested.

### M-5: Faction/spice keyword-tagger bleeds cross-tab, coloring unrelated Economy/Inventory rows purple
**Status:** 🔧 Needs Fix, new mechanism (related to but distinct from open issue #86) | **Hat:** UI Design/Architect

`web/faction-tagger.js` scans the entire document for `/spice|melange/i` against textContent and tags matches purple — the Economy tab's own sample data includes a currency literally named "Spice Tokens," and Inventory/Economy both use item IDs like `spice_ore_001`. Any operator with an in-game economy item/currency containing "spice" gets that row rendered in Spice-Melange purple on an unrelated tab. No test exists for this mechanism.

### M-6: Host-memory unit-formatting fix applied to Overview only, not the identical metric on SOC tab
**Status:** 🔧 Needs Fix (small) | **Hat:** UI Design/Architect

`renderFleetRollup()` (Overview) uses the new `formatBytesHuman()` helper for `avgMemoryMb`, explicitly citing "a real, previously-reported bloat finding" in its own comment. `renderPrometheus()` (SOC tab, same underlying field) still renders the raw `${summary.avgMemoryMb} MB` (e.g. "16384 MB"). The exact defect class the CHANGELOG claims fixed is still live one tab over, for the same number.

### M-7: `dune.player_state`'s index-backing is still genuinely unverifiable from source
**Status:** 📝 Documented, design constraint, unresolved verification gap carried forward from 2026-08-16 register | **Hat:** DBA

Confirmed (new information vs. the 2026-08-16 register, which could only speculate): `dune.player_state` IS a view over `encrypted_player_state`, filtered on `character_state = 'Active'`, per Core's own code comment. Whether that filter is index-backed on the base table remains completely unverifiable from source — this can only be resolved by running `EXPLAIN (ANALYZE, BUFFERS)` against a real, populated deployment. Everything that queries this view today is manual-refresh-only with a 15s global statement timeout as a backstop, so the practical risk is contained, but not eliminated.

### M-8: `addonOpsInventorySummary`'s LATERAL join remains the single most expensive query in the addon's surface, still correctly manual-only
**Status:** 📝 Documented, re-confirmed unchanged since 2026-08-16 register (M-3) | **Hat:** DBA

Two correlated `LEFT JOIN LATERAL` subqueries, one per placeable/vehicle row, on top of an already-wide outer join, with no time-bound `WHERE` clause. Confirmed still excluded from the new `_autoRefreshOverview()`'s scoped method list. No change needed today; flagged so this containment is not accidentally lost in a future PR that touches the auto-refresh scope.

### M-9: `docs/design/noc-overview-rebuild-l1-design-2026-08-17.md` has no post-implementation status header
**Status:** 🔧 Needs Fix (small) | **Hat:** GRC

Unlike its sibling `metrics-l1-design-audit-2026-08-08.md` (which correctly carries a bold `**Status:** **SUPERSEDED**` header), this doc has no `Status:` field despite all 3 of its sequenced PRs being merged. A future reader has to cross-reference PR history to know this is completed work, not a live plan.

---

## LOW Findings (4)

### L-1: `renderKpis`, `containerFamily()`, `formatBytesHuman()` have no direct unit test coverage
**Status:** 🔧 Needs Fix (small) | **Hat:** QA/Test

`renderKpis` has zero test coverage and wasn't part of any prior tracked issue. `containerFamily()`/`formatBytesHuman()` are pure, edge-case-prone helpers (regex family matching; byte-unit boundary scaling) exercised only incidentally through higher-level fixtures, never directly — e.g. no test of `formatBytesHuman()` at exactly a 1000-unit boundary, or `containerFamily()` against a name that partially matches the regex.

### L-2: Inline hardcoded hex color on Combat tab, outside the CSP comment's documented scope
**Status:** 🔧 Needs Fix (trivial) | **Hat:** UI Design/Architect

`web/index.html`'s Combat tab eyebrow uses `style="color:#c4b5fd"` — the CSP's `unsafe-inline` justification comment explicitly scopes inline-style usage to "the spice-field color-coded cards," which this isn't.

### L-3: Alertmanager's Discord-relay webhook hardcodes this account's own domain with no `.env` override
**Status:** 📝 Documented, affects every fork operator | **Hat:** Network Engineer

`runtime/metrics/alertmanager/alertmanager.yml` hardcodes `https://acp-setup.darkdante.org/api/alerts/relay` — every operator who enables the metrics stack inherits an Alertmanager that, on any real alert, makes an outbound call to this specific account's domain, not their own. No secret leaks (token mismatch just 401s), but this is architecturally a `.env`-configurable value, not a literal every fork operator should inherit verbatim.

### L-4: Severity-label taxonomy inconsistently applied; real `severity:*` labels almost never used despite existing
**Status:** 📝 Documented | **Hat:** GRC

12 historical issues encode severity as a bracketed title prefix (`[CRITICAL]`, `[HIGH]`) with no corresponding `severity:*` label. The real labels exist in the repo's label set but are applied to only 2 issues in the entire history. A future automated triage pass filtering on labels would miss real historical CRITICAL/HIGH work.

---

## Positive control confirmations (no action needed — verified sound under direct, independent scrutiny)

- **`SourceResult` envelope discipline** is genuinely uniform across all ~18 render functions and 12 provider methods — no exception found (Architect).
- **Scoped auto-refresh boundary is a real, tested guardrail**, not just a comment — `triggerNow()` has a dedicated test asserting it never calls a manual-refresh-only method (Architect, QA, DBA all independently confirmed).
- **`addonOpsContainerHealth()`'s project-scoping fix (#240/#246) is genuinely correct** — fail-closed on empty project name, `execFile` (no shell injection path), positional argv, no addon-controlled input reaches the filter string (Security Architect).
- **`dune-addon-bridge.js`'s postMessage handling is correctly origin+source+shape-validated** — a malicious sibling frame/tab cannot forge a response; the only residual risk (a compromised Console host) is an accepted, explicitly documented trust boundary, not a gap (Security Architect).
- **New `ops.health.postgres`/`ops.health.rabbitmq` actions add zero new attack surface or network exposure** — pure loopback-scoped PromQL, deliberately avoiding the exposed RabbitMQ management API per the design doc's own H-4 constraint; independently verified by both Security Architect and Network Engineer.
- **The auto-refresh timer's own DBA-safety claim is structurally true, not just asserted** — 2 of its 4 scoped functions (`addonOpsPostgresHealth`/`addonOpsRabbitmqHealth`) don't even accept a database parameter; the other 2 are Prometheus-HTTP/Docker-CLI only (DBA).
- **No hardcoded secrets anywhere in the addon's own code**; the addon has no cloud SDK, API, or credential surface of its own (Security Architect, Cloud Security Engineer).
- **CSP is internally consistent with actual JS behavior** — `connect-src 'none'` is accurate (zero `fetch`/`XHR` anywhere in the addon), no `eval`/`innerHTML`/`document.write` anywhere (Security Architect, Network Engineer).
- **The Grafana mixed-content HTTPS limitation is a genuine, unavoidable browser constraint, already correctly diagnosed and handled** with a protocol-detection fallback UI — not a defect (Network Engineer, independently re-confirming a prior finding).
- **74/74 tests pass, no test isolation defects, no timer-hang risk** — verified via real `npm test` runs at both default and `--test-concurrency=1` (QA/Test).

## Biggest single risk (cross-hat consensus)

**G-1** is the consensus answer across three independently-dispatched hats: a governance/tracking-integrity failure where the project's own issue tracker and a design doc both assert a fix shipped that demonstrably did not, verified by directly reading the current markup. This matters more than any individual UX or code defect below it, because it is the failure mode that would cause a future session — human or LLM — to build on a false premise, exactly the scenario this project's own documentation-currency discipline (Requirement 14) and its "verify, don't trust status fields" principle (cited by name against issue #66 in the main README) exist to prevent.
