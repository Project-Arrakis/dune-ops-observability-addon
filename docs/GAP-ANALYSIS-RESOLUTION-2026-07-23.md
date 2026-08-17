# Security & Architecture Gap Analysis — Resolution Report (Phase 0 through Phase 3)

**Author perspective**: Principal SDET / Principal Security Engineer
**Date**: 2026-07-23 (Phase 0/1 merged via [PR #63](https://github.com/yacketrj/dune-ops-observability-addon/pull/63); Phase 2 merged via [PR #64](https://github.com/yacketrj/dune-ops-observability-addon/pull/64); Phase 3 delivered in this update)
**Scope**: Resolves all four phases from [`docs/SECURITY-ARCHITECTURE-GAP-ANALYSIS.md`](./SECURITY-ARCHITECTURE-GAP-ANALYSIS.md)'s §6 prioritized roadmap except Phase 4 (ongoing governance automation — ambient tooling, not a specific bug/gap) and S-3's actual execution (a public-artifact decision reserved for the maintainer — see §2.3). Every Critical/High/Medium finding in the original analysis now has either a merged fix or an explicit, documented reason it's deferred to the maintainer.

---

## 1. Resolution status by finding

| ID | Severity | Title | Status | Resolution |
|----|----------|-------|--------|------------|
| F-1 | Critical | Unsupported/errored bridge data renders as false zero | **Resolved** | §2.8 |
| F-2 | High | Fabricated PvP/PvE sietch/instance data | **Not present in current `main`** | Re-verified: `web/addon.js` on `main` has no `pvpInstances`/`pveInstances`/hardcoded `type: "pvp"` synthesis. The gap analysis flagged this against *uncommitted working-tree changes* from a prior session that were never committed to this repository. No action needed here; if this pattern is reintroduced, treat it as F-1's fabrication anti-pattern and block it before merge. |
| F-3 | Medium | Preview sample data indistinguishable from live data | **Resolved** | §2.8 |
| F-4 | Medium | "All sources online" claimed regardless of per-source success | **Resolved** | §2.8 |
| S-1 | High | README boundary claims contradict shipped bridge-action usage | **Resolved** | §2.1 |
| S-2 | High | No required-status-checks gate on `main`; solo-team review language | **Resolved** | §2.2 |
| S-3 | High | Fabricated/divergent `v0.5.0`–`v1.0.0` release history | **Documented, not executed** | §2.3 — requires explicit maintainer decision on a public artifact. |
| S-4 | Medium | Upstream Core compatibility claim 16 versions stale | **Resolved (partial)** | §2.4 — corrected to an honest, dated, narrower claim; full compatibility regression testing across the 16 intervening versions was not performed. |
| S-5 | Medium | Design docs and README mutually contradict implementation state | **Resolved** | §2.5 |
| C-1 | High | `npm audit`/dependabot audit an empty manifest | **Resolved** | §2.10 |
| C-2 | High | Manifest validator breaks on cache-busting query strings | **Resolved** | §2.6 |
| C-3 | High | "OWASP test suite" 100% fails, wrong-repo code, not wired into CI | **Resolved** | §2.11 |
| C-4 | Medium | Key regression test is a substring check, not behavioral | **Resolved** | §2.8 — replaced with 11 real behavioral DOM tests (`test/addon-rendering.test.js`), on top of a new discovery that the *original* 14-test suite was never actually executed by CI at all (see §2.9). |
| A-1 | Low | No CSP | **Resolved** | §2.12 |
| A-2 | Low | Static `innerHTML` fails project's own test | **Not present in current `main`** | Re-verified: `web/addon.js` on `main` has zero `innerHTML` occurrences; `test/addon.test.js`'s "does not use innerHTML" assertion currently passes. Same as F-2 — this was an uncommitted working-tree artifact from a prior session, not present in the repository. |

**Summary**: 12 of 16 open findings fully resolved (S-1, S-2, S-4 partial, S-5, C-1, C-2, C-3, C-4, A-1, F-1, F-3, F-4); 2 findings (F-2, A-2) turned out to already be non-issues on `main` — the gap analysis correctly identified them in an uncommitted working tree that was never merged; 1 finding (S-3) documented with two concrete options presented, no action taken (public-artifact decision reserved for the maintainer); Phase 4's automation is the only remaining unstarted item as of this document's original writing (later resolved separately — see issue #78's closure for evidence).

**Correction (2026-08-17, issue #79):** this table previously listed C-1, C-3, and A-1 as "Open — deferred to Phase 3" despite §§2.10-2.12 below (part of this same document, same original writing) already describing all three as resolved — a direct, internal self-contradiction that went uncorrected for over three weeks. Independently re-verified against current `main` before fixing this table: `package.json`'s real `jsdom` dependency (C-1), `tools/cross-repo-security-tests/owasp-security.test.js` (C-3), and `web/index.html`'s CSP meta tag (A-1) are all still genuinely present today, confirming §§2.10-2.12's original claims were and remain accurate — only this summary table was wrong.

Two new defects were found during this work, not in the original gap analysis:
1. `.github/workflows/ci-gate.yml`'s `gate` job used a cross-workflow `needs:` list (referencing job IDs defined in `validate.yml`, `pre-commit.yml`, `sast.yml`, `secret-scan.yml`, `filesystem-scan.yml` — separate workflow files), which is invalid GitHub Actions syntax. This caused the workflow to fail its own startup validation on every single run since it was added (`16aaf4b`, 2026-07-20), including every run on `main` after merge. See §2.7. (Found and fixed in the Phase 0/1 update, PR #63.)
2. `test/addon.test.js`'s 14-test suite existed and passed locally, but **no CI workflow ever actually ran `npm test`** — confirmed by listing every live check name on `main` via the GitHub API and finding no test-execution step among them. This is directly relevant to why C-4's weak substring test went unnoticed for as long as it did: even a stronger test in that file would not have been enforced in CI. See §2.9.

---

## 2. Resolution detail

### 2.1 S-1 — `README.md`

Rewrote the "does not request or use" list to remove the false claim that the addon doesn't use economy/inventory data — it does, under the same `ops:read` scope, and both are genuinely aggregate-only (verified directly against `duneDb.addonOpsEconomySummary()`'s SQL: `count`, `sum`, `avg`, grouped by `currency_id`/`template_id`, no `player_controller_id` or player names in any returned row).

Replaced the stale 4-action `leadership.players.list`/`ops.health.*` list (a carryover from the pre-v0.3.0 `players:read` permission model) with an accurate table of all 9 action families the shipped `web/data-providers.js` actually calls, each annotated with its live/not-implemented status in Core — re-verified directly against `console/api/src/server.js`'s route table (`action === "..."` branches) rather than trusting the previous README's claim.

### 2.2 S-2 — `docs/BRANCH-PROTECTION.md`, `docs/GITHUB-RULESETS.md`, `.github/CODEOWNERS`, live branch protection

Rewrote all three governance documents to stop implying a required-approving-review process this one-person team cannot support: removed "require a pull request before merging" and all review-count language, added an explicit "note on team size" section to `docs/BRANCH-PROTECTION.md` explaining why (mirrors the same reasoning already applied to `acp-landing`, `Arrakis-Control-Panel`, and `dune-awakening-selfhost-docker` in this session). `.github/CODEOWNERS` now has a comment clarifying its purpose (ownership/notification routing) is not paired with a review-requirement rule.

Corrected the documented required-check list in both files from the previous (already-partially-stale) `Pre-commit / pre-commit (pull_request)`, `Secret Scan`, `Filesystem Scan`, `Validate addon`, `SAST` to the actually-correct set: `CI Gate` (covering `ci.yml`'s Shell Lint/Validate JSON/NPM Audit/Security Scanning) plus `validate`, `pre-commit`, `semgrep`, `gitleaks`, `trivy` from the split workflows — verified against live GitHub Actions API output (`gh api repos/.../actions/workflows`) rather than guessed.

**Live branch protection configured** on `main` (verified via `gh api -X PUT repos/yacketrj/dune-ops-observability-addon/branches/main/protection`):
- Required status checks: `CI Gate`, `validate`, `pre-commit`, `semgrep`, `gitleaks`, `trivy` (strict — branch must be up to date).
- No required-approving-review count.
- Force pushes and branch deletion blocked.
- `enforce_admins: false` (matches the pattern applied to the other three repos this session — the maintainer can still bypass in a genuine emergency, consistent with the bypass-policy documented in both governance docs).

### 2.3 S-3 — release history (documented, not executed)

Per the gap analysis's own instruction ("this requires a maintainer decision... document the decision either way") and this session's standing rule against unilaterally touching public-facing governance artifacts, no releases were deleted, edited, or re-tagged. Two options, as originally framed by the gap analysis, are presented here for the maintainer's decision:

1. **Mark `v0.5.0`–`v1.0.0` as draft/pre-release** with a note explaining the divergence (they are not ancestors of `main`), leaving them visible but clearly flagged as not representing the real `main` history.
2. **Delete `v0.5.0`–`v1.0.0`** entirely (git tags and GitHub Releases), then re-tag a clean `v0.5.0` from `main`'s actual current HEAD once Phase 2/3 land — only viable if nothing external (the addon catalog listing, a downstream consumer) references these specific tags today.

No recommendation is asserted as final here beyond what the gap analysis already stated; this is the maintainer's call on a public artifact, not a code-correctness question.

### 2.4 S-4 — Core compatibility claim

Re-verified directly: the fork's `VERSION` file and upstream `Red-Blink/dune-awakening-selfhost-docker`'s `VERSION` file both read `v1.3.61` (confirmed via `gh api repos/Red-Blink/dune-awakening-selfhost-docker/contents/VERSION`), not `v1.3.45` as the README claimed. Re-confirmed that all 9 bridge action families the addon depends on are still present (for the 5 live ones) or still absent (for the 4 not-yet-implemented ones) in `v1.3.61`'s route table — i.e., the specific integration surface this addon relies on has not regressed across the 16-version gap, even though a full behavioral regression test was not performed.

Updated the README's compatibility claim to state precisely what was verified (a targeted route-table check, dated) rather than either leaving the stale `v1.3.45` claim or asserting broader compatibility than was actually tested. The gap analysis's suggested "lightweight compatibility-check script" (§6 Phase 1 item 4) was not built as part of this change — that's a small but real piece of new tooling, appropriately scoped to Phase 4's "ongoing governance hardening" rather than a doc-accuracy fix.

### 2.5 S-5 — `docs/architecture/V0.5-DESIGN.md`, `V0.6-DESIGN.md`

Updated both `Status:` fields to reflect verified reality: `V0.5-DESIGN.md`'s `ops.economy.summary` is marked `Implemented`, since it's confirmed live in Core and called by the addon. `V0.6-DESIGN.md`'s `ops.inventory.summary`/`ops.location.activity` remain marked `Design`, with an explicit note that the addon calls them optimistically today and the bridge provider correctly returns `{status: "unavailable"}` for both — resolving the three-way documentation contradiction the gap analysis identified (README said "not used," design docs said "future work," code said "already calling this live").

### 2.6 C-2 — `scripts/validate.js`, `test/addon.test.js`

Fixed both asset-existence checks to strip query strings (`src.split("?")[0]`) before calling `fs.existsSync()`/`existsSync()`. Verified directly: temporarily added `?v=0.5.1-test` to `web/index.html`'s `addon.js` script tag, confirmed both `node scripts/validate.js` and `node --test test/addon.test.js` (all 14 tests) pass with the query string present, then reverted the test-only change (confirmed zero diff on `web/index.html` afterward).

### 2.7 New finding — `.github/workflows/ci-gate.yml` broken since creation

**Evidence**: `gh run list --workflow=ci-gate.yml` shows `conclusion: failure` on every run since the workflow was added (`16aaf4b`, "chore: add CI Gate workflow required by branch protection"). Root cause: its single job (`gate`) declares `needs: [validate, pre-commit, semgrep, gitleaks, trivy]`, but those five job IDs are defined in five separate workflow files (`validate.yml`, `pre-commit.yml`, `sast.yml`, `secret-scan.yml`, `filesystem-scan.yml`). GitHub Actions `needs:` can only reference jobs within the same workflow file — this is invalid configuration that fails GitHub's own workflow-file validation before any job runs, confirmed via `gh run view <id>` reporting "This run likely failed because of a workflow file issue" on every invocation.

This is precisely why S-2's branch protection was never actually turned on despite the commit message's stated intent ("required by branch protection") — the check this workflow was meant to provide could never pass, so requiring it would have permanently blocked every merge.

**Resolution**: deleted `.github/workflows/ci-gate.yml`. It was fully redundant with `.github/workflows/ci.yml`'s own `ci-gate` job (job id `ci-gate`, display name `CI Gate` — an exact name collision with the broken standalone file), which correctly aggregates its four same-workflow jobs (`shellcheck`, `validate-json`, `npm-audit`, `security`) and has passed on every run. The five jobs the broken file was trying to aggregate (`validate`, `pre-commit`, `semgrep`, `gitleaks`, `trivy`) are now required as individual status checks instead (see §2.2) — this achieves the same enforcement goal without a second, non-functional "CI Gate"-named job competing with the working one.

### 2.8 F-1, F-3, F-4, C-4 — the `SourceResult` envelope refactor (Phase 2)

**F-1 (Critical)**: introduced a uniform `SourceResult` envelope (`{status: "live"|"preview"|"unavailable", data, reason, source}`) returned unconditionally by every provider method in `web/data-providers.js` (`getOpsHealth`, `getActivity`, `getCombat`, `getResources`, `getEconomy`, `getInventory`, `getLocation`, `getSoc`, `getPrometheusHealth` — all nine, including `getOpsHealth`, which the gap analysis specifically flagged as "the odd one out" for having no error-envelope handling at all). Every `renderXxx()` in `web/addon.js` now switches on `result.status` before touching `result.data`, via a shared `renderUnavailablePanel()` helper that clears every metric/table element for that panel and shows a new `.availability-note` element explaining why (`not_implemented` / `bridge_error` / `request_failed`) — a panel can never show a mix of a real numeric field and a stale/fabricated one.

A second false-zero path, not called out explicitly in the original gap analysis, was found and fixed in the same change: `refreshAll()`'s `Promise.allSettled` previously mapped every *rejected* promise (e.g., a bridge request that times out or throws) to a bare `{}` before rendering — that object has no `.status` field, so every `renderXxx()` read it as "all fields absent" and rendered zeros, identical in effect to F-1 but via a different code path than the already-handled `{status: "planned"}` case. Rejections are now converted into a proper `unavailableResult("request_failed", ...)` envelope via a new `settledToSourceResult()` helper, so they take the exact same "unavailable" rendering branch as every other failure mode.

**F-3 (Medium)**: added a persistent visual watermark for preview/sample data — `document.body.dataset.provider` is now set to `"sample"` or `"bridge"` on every refresh, and `web/addon.css` applies a distinct amber border plus a `::before` "PREVIEW — SAMPLE DATA, NOT LIVE" label to every `.card` when `data-provider="sample"`. This is visible on every panel simultaneously, not just in the top status banner, so preview data can no longer be mistaken for live data mid-scroll or in a screenshot.

**F-4 (Medium)**: `refreshAll()` now computes a real per-source live/unavailable count across all 9 sources and reports it in the status banner (e.g., "3 of 9 observability sources online") instead of unconditionally claiming "All observability sources online" whenever the active provider happened to be `bridge`, regardless of how many of the 9 parallel calls actually succeeded.

**C-4 (Medium)**: added `test/addon-rendering.test.js` — 11 behavioral tests using `jsdom` (new devDependency, test-only; the shipped `web/` addon remains a bundler-free, dependency-free plain HTML/CSS/JS UI) that load the real `web/index.html`, `web/dune-addon-bridge.js`, `web/data-providers.js`, and `web/addon.js` into a jsdom window, install a mocked provider returning controlled `SourceResult` envelopes (including a genuinely rejecting promise, to cover the `Promise.allSettled` fix above), trigger a refresh, and assert on the actual rendered DOM text. This directly replaces C-4's substring check (which only proved the string `"unavailable"` existed somewhere in the source file, never that any renderer consumed it correctly) with the kind of test that would have caught F-1 before it shipped.

**Verified**: `npm test` — 25/25 tests pass (14 original + 11 new); `node scripts/validate.js` passes; manually confirmed in the jsdom harness that an unavailable/rejected source renders `"—"` and never the literal string `"0"`, that a genuinely empty-but-real OPS health result still renders `0` (distinct from unavailable, per the empty-state note's own wording), and that the status banner's live/total count matches the mocked source states exactly.

### 2.9 New finding — the original 14-test suite was never run by any CI workflow

**Evidence**: `test/addon.test.js` (14 tests, added per the CHANGELOG's `[Unreleased]` entry "14 addon tests covering manifest validation...") passes when run locally via `npm test` (`node --test test/*.test.js`, defined in `package.json`). But listing every check name that has ever run on `main` via `gh api repos/.../commits/main/check-runs` shows no test-execution step among them — only `CI Gate`, `Dependency Review`, `NPM Audit`, `Secret Scan`, `Security Scanning`, `Semgrep SAST`, `Shell Lint`, `Trivy Filesystem`, `Validate JSON`, `gitleaks`, `pre-commit`, `semgrep`, `trivy`, `validate`. Cross-checked every workflow file under `.github/workflows/` for `npm test` or `npm run test` — no match. `.pre-commit-config.yaml` likewise has no test-running hook.

**Impact**: this is directly relevant to why C-4's weak substring check went unnoticed for as long as it did — even if that test had been written correctly from the start, it would never have been enforced anywhere, and a regression to any of the 14 assertions (including the security-relevant ones: no `innerHTML`, no inline event handlers, bridge origin/source checks, no hardcoded secrets) could have merged without ever failing a required check.

**Resolution**: added a `unit-tests` job to `.github/workflows/ci.yml` (`node scripts/validate.js && npm test`), added to `ci-gate`'s `needs:` list and its required-checks loop, and added to the live branch protection required-status-checks list (alongside the existing `validate`/`pre-commit`/`semgrep`/`gitleaks`/`trivy`/`CI Gate`). Also added a local `unit-tests` pre-commit hook (`npm test`, scoped to `web/`, `test/`, and `package*.json` changes) so this is caught before push, not only in CI.

---

### 2.10 C-1 — resolved as a side effect of Phase 2

`package.json` gained a real dependency (`jsdom`, added for `test/addon-rendering.test.js`'s behavioral tests) as part of Phase 2. `npm audit`/dependabot's npm ecosystem config now track something meaningful instead of an always-passing empty manifest. No separate action was needed once Phase 2 landed.

### 2.11 C-3 — relocated `pipeline/tests/` to `tools/cross-repo-security-tests/`

Moved `owasp-security.test.js`, `blueprints-security.test.js`, and `run-security-tests.sh` out of `pipeline/tests/` (which reads like this repository's own test suite) into `tools/cross-repo-security-tests/` (per the gap analysis's own suggested naming), with a new README stating explicitly that these test `dune-awakening-selfhost-docker`'s Core server code, not this addon, and are never run by any workflow in this repository. Updated the copy-source paths in `run-security-tests.sh` to use `$SCRIPT_DIR` instead of a path relative to repo root (which broke once the files moved), and updated the top-level `README.md`'s tooling table to describe this as a cross-repo tool rather than listing it alongside this repository's own pipeline scripts. Verified the relocated script still correctly copies both test files into a target checkout's `test/` directory (tested against a scaffolded fake target; it correctly reached the "run the copied tests" step before failing on the fake target's lack of real Core source — confirming the copy-path fix works).

### 2.12 A-1 — Content-Security-Policy

Added a `Content-Security-Policy` meta tag to `web/index.html`: `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self'; font-src 'self'; connect-src 'none'; frame-ancestors 'self'; base-uri 'none'; form-action 'none'`. `connect-src 'none'` reflects that this addon never calls `fetch`/XHR itself — all data arrives via `window.postMessage` through `web/dune-addon-bridge.js`, which CSP's `connect-src` does not govern. `style-src` includes `'unsafe-inline'` because `web/addon.js` genuinely sets inline styles on a handful of dynamically-created spice-field cards (verified: 4 inline `style=` attributes in `index.html`, 7 `.style.` assignments in `addon.js`) — this is honest about current usage rather than a placeholder loosening that could mask a future real regression.

Added a new test (`test/addon.test.js`) asserting the CSP meta tag exists, `default-src`/`connect-src` are locked down, and `script-src` never allows a wildcard/external host/`unsafe-eval` — a future PR that weakens the CSP to work around a bug will fail this test rather than silently shipping.

**Verified**: `npm test` — 26/26 pass (25 from Phase 2 + this new CSP test).

---

## 3. What remains (not in scope for this change)

Per the gap analysis's own phased roadmap, all Phase 0–3 items are now resolved (with S-3 documented but requiring maintainer action, per §2.3). What remains:

- ~~**Phase 4 (effort: S, recurring)** — automated drift detection between README's bridge-action list and actual code, version-consistency checks, a release-tagging guard requiring the tagged commit be an ancestor of `main` (would have prevented S-3). Not started — see [`docs/prompts/PHASE-4-GOVERNANCE-AUTOMATION.md`](./prompts/PHASE-4-GOVERNANCE-AUTOMATION.md) for a fully-scoped, verified-against-current-code implementation prompt.~~ **Resolved, closed 2026-08-17 (issue #78)** — `scripts/check-bridge-action-drift.js` and `scripts/check-version-consistency.js` both exist and are wired into `.github/workflows/ci.yml`; the release-tag ancestor guard exists in `.github/workflows/release.yml`.
- **S-3's actual resolution** — requires the maintainer to pick one of the two options in §2.3 above.

---

## 4. Verification summary

### Phase 0/1 (PR #63, merged)

```
$ node scripts/validate.js
Addon manifest is valid: dune-ops-observability v0.4.1

$ node --test test/addon.test.js
# tests 14
# pass 14
# fail 0

$ pre-commit run --files scripts/validate.js test/addon.test.js README.md \
    docs/architecture/V0.5-DESIGN.md docs/architecture/V0.6-DESIGN.md \
    docs/GITHUB-RULESETS.md docs/BRANCH-PROTECTION.md .github/CODEOWNERS
check for merge conflicts: Passed
mixed line ending: Passed
fix end of files: Passed
trim trailing whitespace: Passed
Detect hardcoded secrets: Passed
trivy: Passed
semgrep: Passed
Validate addon manifest: Passed

$ gh api repos/yacketrj/dune-ops-observability-addon/branches/main/protection \
    --jq '{checks: .required_status_checks.contexts, reviews: .required_pull_request_reviews, force_push: .allow_force_pushes.enabled}'
{
  "checks": ["CI Gate", "validate", "pre-commit", "semgrep", "gitleaks", "trivy"],
  "reviews": null,
  "force_push": false
}
```

Manual regression test confirming the C-2 fix (query-string cache-busting):
```
$ sed -i 's/src="addon\.js"/src="addon.js?v=0.5.1-test"/' web/index.html
$ node scripts/validate.js
Addon manifest is valid: dune-ops-observability v0.4.1   # previously: 4 FAIL lines
$ node --test test/addon.test.js   # 14/14 pass with query string present
$ git checkout web/index.html   # reverted test-only change, confirmed zero diff
```

### Phase 2 (this update)

```
$ node --check web/addon.js && node --check web/data-providers.js
(no output — both files parse cleanly)

$ node scripts/validate.js
Addon manifest is valid: dune-ops-observability v0.4.1

$ npm test
# tests 25
# pass 25
# fail 0
(14 original tests + 11 new behavioral tests in test/addon-rendering.test.js)

$ npm audit
found 0 vulnerabilities

$ pre-commit run --files web/addon.js web/data-providers.js web/index.html \
    web/addon.css test/addon-rendering.test.js package.json package-lock.json \
    .github/workflows/ci.yml .pre-commit-config.yaml
check json: Passed
check yaml: Passed
check for merge conflicts: Passed
mixed line ending: Passed
fix end of files: Passed
trim trailing whitespace: Passed
Detect hardcoded secrets: Passed
trivy: Passed
semgrep: Passed
Unit tests (node --test): Passed

$ python3 -c "import yaml; yaml.safe_load(open('.github/workflows/ci.yml'))"
(parses cleanly; ci-gate's needs: list now includes unit-tests)
```
