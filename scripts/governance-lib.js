#!/usr/bin/env node
// governance-lib.js — Shared helpers for Phase 4 governance checks
// (docs/prompts/PHASE-4-GOVERNANCE-AUTOMATION.md). No new runtime
// dependency: plain Node + `git`/`gh` CLI subprocess calls only.

const { execFileSync } = require('child_process');

function git(args) {
  return execFileSync('git', args, { encoding: 'utf8' }).trim();
}

// Returns true if `commitish` is an ancestor of `main` (i.e. reachable
// from main's current history) -- exit code 0 from `git merge-base
// --is-ancestor` means yes, 1 means no. Any other exit code is a real
// error and should propagate (e.g. the commit/ref doesn't exist at all).
function isAncestorOfMain(commitish, { mainRef = 'origin/main' } = {}) {
  try {
    execFileSync('git', ['merge-base', '--is-ancestor', commitish, mainRef], {
      stdio: 'ignore',
    });
    return true;
  } catch (err) {
    if (typeof err.status === 'number' && err.status === 1) return false;
    throw err;
  }
}

// Lists all git tags matching a version-looking pattern (v1.2.3, with
// optional -rcN/-rc.N suffix), each with its peeled commit SHA.
function listVersionTags() {
  const raw = git(['tag', '-l', 'v*']);
  if (!raw) return [];
  return raw
    .split('\n')
    .filter(Boolean)
    .map((tag) => {
      let commit;
      try {
        commit = git(['rev-parse', `${tag}^{commit}`]);
      } catch {
        return null;
      }
      return { tag, commit };
    })
    .filter(Boolean);
}

// Parses a semver-ish "vMAJOR.MINOR.PATCH" tag into a comparable tuple.
// Returns null for anything that doesn't match (e.g. -rc suffixes are
// intentionally excluded from "latest real release" consideration).
function parseVersionTag(tag) {
  const m = /^v(\d+)\.(\d+)\.(\d+)$/.exec(tag);
  if (!m) return null;
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

function compareVersionTuples(a, b) {
  for (let i = 0; i < 3; i++) {
    if (a[i] !== b[i]) return a[i] - b[i];
  }
  return 0;
}

// The core anti-S-3 mechanism: find the latest tag that is BOTH a
// valid semver release tag AND an ancestor of main. Deliberately does
// NOT just take the highest-numbered or most-recently-dated tag --
// see docs/prompts/PHASE-4-GOVERNANCE-AUTOMATION.md §2 for why that
// naive approach is exactly what produced the fabricated v0.5.0-v1.0.0
// releases (all newer-looking, none reachable from main).
function findLatestRealReleaseTag({ mainRef = 'origin/main' } = {}) {
  const candidates = listVersionTags()
    .map(({ tag, commit }) => ({ tag, commit, version: parseVersionTag(tag) }))
    .filter((c) => c.version !== null)
    .filter((c) => isAncestorOfMain(c.commit, { mainRef }));

  if (candidates.length === 0) return null;

  candidates.sort((a, b) => compareVersionTuples(b.version, a.version));
  return candidates[0];
}

module.exports = {
  git,
  isAncestorOfMain,
  listVersionTags,
  parseVersionTag,
  compareVersionTuples,
  findLatestRealReleaseTag,
};
