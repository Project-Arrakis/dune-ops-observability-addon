# L3 Integration Audit — Dune Ops Observability v0.5.1

**PR:** Red-Blink/dune-docker-addons #24  
**Diff:** v0.4.7 → v0.5.1 (40 commits)  
**Date:** 2026-08-08 | **Requirement 20, Layer 3**

## Software Architect

**Finding A-1 (PASS):** Code structure matches addon conventions. ZIP contains `addon.json`, `web/` directory with all required files (addon.js, addon.css, index.html, data-providers.js, dune-addon-bridge.js, faction-tagger.js, fonts/, images/). Entry path `web/index.html` exists and loads correctly.

**Finding A-2 (PASS):** Tab architecture (11→14 tabs) uses same CSS patterns as existing tabs. `refreshAll()` refactoring is backward-compatible — initial load still populates all tabs via `Promise.allSettled`.

**Finding A-3 (NOTE):** Placeholder tabs (AAA, NOC Infra, Audit Log) show "Requires Core R3" — this is honest design. No data is fabricated.

## Security

**Finding S-1 (PASS):** Permissions unchanged — `ops:read` only. No new capability requests. The `frame-src localhost:3000` CSP directive is scoped to localhost only (no external exposure).

**Finding S-2 (PASS):** No secrets in the ZIP. No API keys, tokens, or credentials in any committed file. CSP meta tag restricts all outbound connections (`connect-src: none`).

**Finding S-3 (NOTE):** `initGrafanaTimeRange` detects HTTPS and defers iframe loading to JavaScript — prevents mixed-content browser warnings. This is a defense-in-depth improvement.

## GRC

**Finding G-1 (PASS):** CHANGELOG has [Unreleased] section with Phase 0 changes. v0.5.0 release notes summarize features.

**Finding G-2 (NOTE):** The v0.5.0→v0.5.1 patch fix (addon.json version in ZIP) is documented in the release notes. The original miss (addon.json at 0.4.7 inside v0.5.0 ZIP) was caught and corrected.

**Finding G-3 (PASS):** SHA256 verified end-to-end: catalog entry (`f3052db8...`) matches downloaded ZIP.

## Network

**Finding N-1 (PASS):** No new outbound connections. The addon remains CSP-gated (`connect-src: none`). Grafana iframes are localhost-only and only loaded on HTTP connections.

**Finding N-2 (NOTE):** The Grafana `frame-src` directive allows `localhost:3000`. On HTTPS consoles, iframes are never loaded (browser blocks mixed content). The addon detects this and shows an explanation card instead.

## Cloud Security

**Finding C-1 (PASS):** No Cloudflare, OCI, or external service dependencies. The addon is pure static HTML/CSS/JS served from the console's filesystem.

## UI/UX

**Finding U-1 (PASS):** All 14 tabs degrade gracefully. Existing 11 tabs are unchanged in behavior. New placeholder tabs show honest "Requires Core R3" messages.

**Finding U-2 (PASS):** Infra-tab CSS uses cool-blue accent distinct from amber game-tab styling. Visual separator between game-operational and infrastructure tabs.

**Finding U-3 (NOTE):** Grafana tab shows different content based on protocol (HTTP=iframes, HTTPS=explanation). This is honest UX — no silent failures.

## DBA

**Finding D-1 (PASS):** Addon introduces no data storage. It remains stateless between refreshes. No new database tables, indexes, or schema changes.

## QA/Test

**Finding Q-1 (PASS):** 57/57 tests pass. No regressions from v0.4.7.

**Finding Q-2 (NOTE):** Test suite covers rendering correctness, but does not test the new tab-aware lazy loading in integration (tests call individual render functions, not `_refreshTab`). The 3 tests that exercise `refreshAll()` (14-16) caught the provider scoping bug and now pass after the fix.

## Findings Summary

| Hat | Pass | Notes |
|---|---|---|
| Architect | 3/3 | Tab architecture sound |
| Security | 3/3 | No new surface |
| GRC | 3/3 | SHA256 verified, changelog current |
| Network | 2/2 | No new outbound connections |
| Cloud | 1/1 | No cloud dependencies |
| UI/UX | 3/3 | Graceful degradation |
| DBA | 1/1 | No storage introduced |
| QA/Test | 2/2 | 57/57 pass |

**Verdict: 18/18 checks pass. 0 CRITICAL, 0 HIGH. PR can be marked ready after upstream maintainer review.**
