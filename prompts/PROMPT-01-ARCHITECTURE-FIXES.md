# PROMPT: Addon Architecture Fixes — H-1, M-1, M-5, M-7

**Severity:** HIGH + MEDIUM | **Domain:** Architecture  
**Repository:** `dune-ops-observability-addon`  
**Timeout estimate:** 3-4 hours

## Context

The dune-ops-observability-addon (v0.4.7) is a static HTML/CSS/JS addon
loaded as a same-origin iframe inside the Dune Docker Console. It communicates
with Core exclusively via postMessage bridge. An 8-hat architectural review
found 4 issues you need to fix.

## Task 1: Fix ops health composite failure zone (H-1)

**File:** `web/data-providers.js:399-401`

The `getOpsHealth()` function calls 3 sub-resources (`ops.health.summary.v2`,
`.players`, `.farms`) via `Promise.all`. If *any* sub-call fails, the
entire `SourceResult` returns as `{status:"unavailable"}`. This single
composite failure takes down the NOC Overview, Players tab, and KPIs.

**What to do:** Return partial results. When some sub-calls succeed and
others fail, return a SourceResult with `status:"live"` but with an
additional `partial: true` flag and a `failedSources: ["ops.health.players"]`
array. The render functions in `web/addon.js` must handle this gracefully:
show available data for live sub-sources, show "Unavailable" for failed
sub-sources.

**Files to modify:**
- `web/data-providers.js` — `getOpsHealth()` function
- `web/addon.js` — `renderOpsHealth()` and any renderers consuming ops
  health composite data

**Verification:**
- Unit test: mock 2 of 3 sub-calls succeeding, 1 failing, assert the
  SourceResult has `status:"live"` and `partial:true`
- Behavioral test in jsdom: verify the DOM renders live data for the
  2 successful sub-sources and "Not available" for the failed one
- All 57 existing tests must still pass

## Task 2: Fix bridge silent-fallback to sample mode (M-1)

**File:** `web/data-providers.js:280-282`, `web/addon.js:1184-1188`

When the addon is loaded outside a console iframe (or the iframe hosting
changes), `isConsoleIframe()` returns false and the addon silently switches
to sample/preview data. The operator sees an amber "PREVIEW" watermark on
cards but may not notice it amidst live-looking data.

**What to do:** Add an explicit, prominent status bar warning when running
in sample/preview mode. The status bar at the top of the addon already
shows per-source live/unavailable counts. Add a distinct visual indicator
(orange background, bold text: "PREVIEW MODE — Not connected to live
server. Data shown is sample/fixture data, not actual server metrics.")
when the current provider is the sample provider.

**Files to modify:**
- `web/index.html` — status bar markup (add a `#preview-warning` element)
- `web/addon.js` — show/hide the warning based on provider type after
  `resolveProvider()` call
- `web/addon.css` — distinct styling for the preview warning

**Verification:**
- Behavioral test: load in sample mode (standalone, not iframe), assert
  the preview warning element is visible
- Behavioral test: confirm the warning is NOT present when loaded in
  console iframe mode with bridge provider

## Task 3: Refactor refreshAll() to data-driven config (M-5)

**File:** `web/addon.js:1083,1108-1118,1146`

Currently adding a new tab requires touching 4 separate locations:
the provider-call array, the variable destructuring, the result array,
and the SOURCE_NAMES array. These can drift out of sync.

**What to do:** Extract a single `PANEL_CONFIG` array at the top of
addon.js that drives all 4 locations. Each entry: `{ id, label,
getData, panelId }`. The `refreshAll()` function iterates this
array dynamically. Adding a new panel becomes a one-line addition
to PANEL_CONFIG.

**Example structure:**
```js
const PANEL_CONFIG = [
  { key: "ops", label: "Source Health & Freshness", getData: () => providers.getOpsHealth(), panelId: "ops" },
  { key: "activity", label: "Player Activity", getData: () => providers.getActivity(), panelId: "activity" },
  // ... etc
];
```

**Verification:**
- All 57 existing tests must still pass
- Governance test: assert that PANEL_CONFIG array length matches the
  number of tab panels in index.html

## Task 4: Add bridge-action drift check to pre-commit hooks (M-7)

**File:** `.pre-commit-config.yaml`

The `scripts/check-bridge-action-drift.js` tool catches drift between
the bridge actions in `web/data-providers.js` and the README documentation
table. Currently it only runs in CI — not in pre-commit hooks.

**What to do:** Add `check-bridge-action-drift.js` to the `.pre-commit-config.yaml`
file as a local repo hook. Test it by making a deliberate drift (add an
action to data-providers.js without updating the README) and confirming
the hook blocks the commit.

**Files to modify:**
- `.pre-commit-config.yaml` — add hook entry

**Verification:**
- Deliberately introduce a bridge-action drift, attempt to commit,
  confirm the pre-commit hook blocks it
- Remove the drift, confirm commit succeeds

## State After Completion

- [ ] Ops health composite returns partial results with `partial:true` flag
- [ ] Preview/sample mode shows prominent warning in status bar
- [ ] `refreshAll()` uses data-driven PANEL_CONFIG array
- [ ] Bridge-action drift checked in pre-commit hooks
- [ ] All 57 tests pass
- [ ] No regressions in the CI pipeline
