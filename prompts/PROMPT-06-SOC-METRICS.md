# PROMPT: SOC Metrics — Security Operations Center Gap Implementation

**Severity:** CRITICAL + HIGH | **Domain:** SOC  
**Repository:** `dune-ops-observability-addon` + `dune-awakening-selfhost-docker` (Core)  
**Timeout estimate:** 8-12 hours

## Context

SOC metrics answer: "is the system under attack?" and "who did what?" The
addon's current SOC tab shows platform health (bridge requests/errors) and
optional Prometheus metrics, but has no security-specific monitoring. Two
metrics are Critical — auth failure monitoring and admin audit trail —
and must be implemented first.

## Task 1: Authentication Failure Monitoring (S-1) — CRITICAL

**What's needed:** Visibility into failed login attempts, brute-force
detection, and per-IP aggregate abuse patterns. This is the #1 SOC
signal for any internet-facing service.

**Core side (dune-awakening-selfhost-docker):**
- The login rate limiter in `server.js` already tracks per-IP failure counts
  but has no external visibility surface.
- Add a new `ops.soc.authFailures` bridge action that exposes rate-limiter
  counters in a privacy-safe aggregate format:
  ```json
  {
    "windowSeconds": 3600,
    "totalFailures": 12,
    "uniqueIPs": 4,
    "topOffenders": [
      { "ipSuffix": "***.123", "failures": 5 },
      { "ipSuffix": "***.45", "failures": 3 }
    ],
    "rateLimitedIPs": 1,
    "rateLimitedTotal": 8
  }
  ```
- IMPORTANT: Never expose raw IP addresses. Use IP suffixes only
  (`***.last-octet`) or hashed prefixes. No PII in the bridge response.
- The rate limiter's internal state (`loginRateLimiter` in `server.js`)
  already has per-IP counters. Expose them through a new function.

**Addon side:**
- Add "Authentication Monitoring" section to the SOC tab
- Show: total failures in window, unique IPs, rate-limited count
- A table of top offenders (masked IP suffix only + failure count)
- Thresholds: green (<5 failures/hour), amber (5-20), red (>20)
- Timestamp of last reset

**Verification:**
- Core: unit test with injected rate-limiter state
- Addon: behavioral test with fixture data
- Manual: trigger multiple failed logins, verify the SOC tab shows them

## Task 2: Admin Audit Trail (S-2) — CRITICAL

**What's needed:** A durable, queryable audit record of every admin action
taken through the console — who did what, when, on which resource.

**Core side:**
- The console already has an `audit()` function (`server.js`) and an
  `auditLog` path (`runtime/generated/web-admin-audit.jsonl`).
- Expand `audit()` to be called on EVERY mutating route in the console
  API, recording:
  ```json
  {
    "time": "2026-08-07T12:34:56Z",
    "user": { "id": "darkdante", "tier": "owner" },
    "action": "players:kick",
    "target": "player_controller_id:12345",
    "result": "ok",
    "sourceIP": "***.123"
  }
  ```
- Currently `audit()` is only called on auth events (login, logout, OAuth
  callback). Extend to all mutating routes.
- The audit log format: JSONL (one JSON object per line), append-only,
  rotated monthly
- Never log: passwords, tokens, full IP addresses, raw request bodies

**Addon side:**
- Add "Admin Audit" section to the SOC tab
- Consume a new bridge action: `ops.soc.auditLog`
- Show: most recent 50 audit entries, filterable by action category
  (auth, players, bases, server, settings)
- Each entry shows: timestamp, user, action, target, result
- Color-code results: green (ok), red (denied/error)

**Verification:**
- Core: unit test that audit() writes to the JSONL file
- Core: unit test that sensitive fields are redacted
- Addon: behavioral test with fixture audit data
- Manual: perform several admin actions, verify they appear in the SOC tab

## Task 3: CSP Violation Reporting (S-5) — HIGH

**What's needed:** When the CSP blocks a script/style/connect violation in
the browser, it should be reported and visible in the SOC tab.

**Core side:**
- Add a new route: `POST /api/integrations/addon/csp-report`
- Accepts the standard CSP violation report format (JSON, from the browser's
  `report-uri` directive)
- Stores violations in-memory (last 100, ring buffer), exposed via a bridge
  action
- Rate-limited (max 10 reports per minute from same addon to prevent DoS)

**Addon side:**
- Update the CSP meta tag in `web/index.html` to include:
  `report-uri /api/integrations/addon/csp-report`
- Add a "CSP Violations" section to the SOC tab
- Show: count of violations in window, most recent violation type, blocked URI
- If zero violations: show "No CSP violations detected" (green)
- If violations exist: show count and most recent blocked attempt

**Verification:**
- Core: post a test violation report, verify it's stored and exposed
- Addon: inject a script that would violate CSP, verify the report is
  generated and visible in the SOC tab

## Task 4: Remaining SOC Metrics

| # | Metric | Priority | Approach |
|---|---|---|---|
| S-3 | Permission drift detection | High | Compare `addon.json` declared permissions vs. actual API route table. Bridge action already exists — add a periodic reconciliation. |
| S-4 | Rate limit telemetry | High | Expose rate-limiter state from Core (IP-level hit counts, aggregate trends). Same pattern as auth failure monitoring (S-1). |
| S-6 | Suspicious player behavior | Medium | The DB has `cheat_type_enum` values (duplicate-item, negative-Solari, forced-respawn, undermesh). Query for these and expose counts by type. |
| S-7 | Data integrity checks | Medium | Expose governance checker results (bridge-action drift, version consistency, manifest checksum) as SOC metrics. |
| S-8 | Secret exposure monitoring | Medium | Runtime check: scan bridge response payloads for patterns matching known secret formats (token patterns, key patterns). Alert if found. |
| S-9 | Session hijacking indicators | Medium | Core R4 dependency. Defer with a placeholder card showing "requires Core R4 (persistent session tracking)." |
| S-10 | Incident runbook linkage | Low | Add a "Runbooks" section linking each SOC metric to a recovery or escalation procedure. |

## Privacy & Security Constraints

- **NEVER expose raw IP addresses** — use masked suffixes (`***.123`) or
  hashed prefixes in all SOC metrics
- **NEVER expose user passwords, tokens, or raw request bodies** — audit
  log entries must redact secrets
- **Rate-limit SOC data sources** — CSP reports and audit logs can be
  high-volume. Implement ring buffers with configurable max sizes.
- **SOC data is aggregate within the console instance** — no data leaves
  the console via these bridge actions
- **SOC permissions:** All SOC-specific bridge actions use the existing
  `ops:read` permission. No new permissions needed.

## State After Completion

For EACH Critical/High metric (S-1 through S-5):
- [ ] Core-side bridge action or expanded existing action
- [ ] Unit test in Core with mock data
- [ ] Privacy review: no PII, no raw IPs, no tokens in bridge responses
- [ ] Addon-side provider method + renderer + behavioral test
- [ ] Bridge action listed in README table
- [ ] SourceResult envelope respected
- [ ] All existing tests pass

S-1 (auth failure monitoring) and S-2 (admin audit trail) are the most
important — implement them first. S-3 through S-10 can be batched as a
second pass.
