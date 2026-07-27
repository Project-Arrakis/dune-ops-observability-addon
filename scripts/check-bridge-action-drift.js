#!/usr/bin/env node
// check-bridge-action-drift.js — Phase 4 item 1
// (docs/prompts/PHASE-4-GOVERNANCE-AUTOMATION.md §1).
//
// Fails if README.md's "Current bridge-backed actions" table's list of
// action strings ever diverges from the actual, complete set of
// bridge-action strings web/data-providers.js calls.
//
// Must account for BOTH calling patterns introduced by the Phase 2
// SourceResult refactor:
//   - direct bridgeRequest("...") calls (3 actions, inside getOpsHealth())
//   - fetchLiveOrUnavailable("...") wrapper calls (8 actions, one per
//     other getXxx() provider method)
// A naive grep for only `bridgeRequest("` would silently miss all 8
// wrapper-called actions -- exactly the failure mode this check exists
// to prevent (see the prompt's §0 for the full explanation).

const fs = require('fs');
const path = require('path');

const DEFAULT_REPO_ROOT = path.resolve(__dirname, '..');

function extractCodeActions(repoRoot = DEFAULT_REPO_ROOT) {
  const src = fs.readFileSync(
    path.join(repoRoot, 'web/data-providers.js'),
    'utf8'
  );
  const actions = new Set();
  const patterns = [
    /bridgeRequest\("([^"]+)"\)/g,
    /fetchLiveOrUnavailable\("([^"]+)"\)/g,
  ];
  for (const re of patterns) {
    let m;
    while ((m = re.exec(src)) !== null) {
      actions.add(m[1]);
    }
  }
  return actions;
}

function extractReadmeActions(repoRoot = DEFAULT_REPO_ROOT) {
  const readme = fs.readFileSync(path.join(repoRoot, 'README.md'), 'utf8');
  const lines = readme.split('\n');
  const actions = new Set();

  // Only look inside the "Current bridge-backed actions" table -- scope
  // to the section, don't scan the whole file for anything backtick-quoted
  // starting with "ops." (that would also match prose elsewhere).
  const startIdx = lines.findIndex((l) =>
    l.includes('Current bridge-backed actions')
  );
  if (startIdx === -1) {
    throw new Error(
      'README.md has no "Current bridge-backed actions" section -- has it been renamed/removed?'
    );
  }

  for (let i = startIdx; i < lines.length; i++) {
    const line = lines[i];
    if (!line.startsWith('| `ops')) {
      // Table ended (first non-matching line after we've seen at least
      // one row) -- stop scanning once we've passed the table.
      if (actions.size > 0) break;
      continue;
    }

    // Each row's first cell may contain a single action, OR the
    // grouped-shorthand format used for the four ops.health.* actions:
    // "`ops.health.summary` / `.v2` / `.players` / `.farms`" --
    // every backtick-quoted segment after the first is a SUFFIX applied
    // to the base action's last dot-segment, not a full action string.
    const cell = line.split('|')[1] || '';
    const segments = [...cell.matchAll(/`([^`]+)`/g)].map((m) => m[1]);
    if (segments.length === 0) continue;

    const base = segments[0];
    actions.add(base);

    if (segments.length > 1) {
      // Shorthand convention: every segment after the first is a
      // sibling of the base's *namespace prefix* (everything up to
      // and including its second dot-segment, e.g. "ops.health" for
      // base "ops.health.summary.v2"), not a sibling of the base's
      // own last segment. This matches how these rows are actually
      // written (e.g. "ops.health.summary.v2 / .players / .farms"
      // means ops.health.players and ops.health.farms, siblings of
      // ops.health -- not ops.health.summary.players).
      const baseParts = base.split('.');
      if (baseParts.length < 2) {
        throw new Error(
          `README.md's bridge-action table has a shorthand row whose base action "${base}" has fewer than 2 dot-segments -- cannot determine the shared namespace prefix for its suffix segments.`
        );
      }
      const namespacePrefix = baseParts.slice(0, 2).join('.');
      for (const suffix of segments.slice(1)) {
        if (!suffix.startsWith('.')) {
          throw new Error(
            `README.md's bridge-action table has an unexpected shorthand segment "${suffix}" in row: ${line.trim()}\n` +
              'Expected every segment after the first to start with "." (e.g. ".v2", ".players").'
          );
        }
        actions.add(`${namespacePrefix}${suffix}`);
      }
    }
  }

  return actions;
}

function setDiff(a, b) {
  return [...a].filter((x) => !b.has(x));
}

function main() {
  const codeActions = extractCodeActions();
  const readmeActions = extractReadmeActions();

  const missingFromReadme = setDiff(codeActions, readmeActions);
  const missingFromCode = setDiff(readmeActions, codeActions);

  if (missingFromReadme.length === 0 && missingFromCode.length === 0) {
    console.log(
      `Bridge-action drift check passed: ${codeActions.size} actions in web/data-providers.js, all documented in README.md.`
    );
    return 0;
  }

  console.error('FAIL: README.md and web/data-providers.js have drifted.');
  if (missingFromReadme.length > 0) {
    console.error(
      `\nActions called in code but NOT documented in README.md's bridge-action table:\n  - ${missingFromReadme.join('\n  - ')}`
    );
  }
  if (missingFromCode.length > 0) {
    console.error(
      `\nActions documented in README.md but NOT called anywhere in web/data-providers.js:\n  - ${missingFromCode.join('\n  - ')}`
    );
  }
  return 1;
}

if (require.main === module) {
  process.exit(main());
}

module.exports = { extractCodeActions, extractReadmeActions };
