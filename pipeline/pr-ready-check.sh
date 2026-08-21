#!/usr/bin/env bash
# pr-ready-check.sh — Run ALL validations before pushing to a PR branch.
# MUST pass before any push to upstream PR branches.
# Fails closed: any non-zero exit blocks the push.
set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null)" || { echo "Not in a git repo."; exit 1; }
cd "$REPO_ROOT"

FAILS=0
pass() { echo -e "  \033[0;32m✓ $*\033[0m"; }
fail() { echo -e "  \033[0;31m✗ $*\033[0m"; FAILS=$((FAILS + 1)); }

echo "============================================="
echo "  PR READINESS CHECK — $(git branch --show-current 2>/dev/null || echo 'unknown')"
echo "============================================="

# 0. Upstream sync — base must be current
echo "0. Upstream base freshness"
UPSTREAM_HEAD=$(git rev-parse upstream/main 2>/dev/null || echo "")
UPSTREAM_FETCH=$(git ls-remote upstream main 2>/dev/null | awk '{print $1}' || echo "")
if [ -z "$UPSTREAM_HEAD" ] || [ -z "$UPSTREAM_FETCH" ]; then
  pass "no upstream remote configured (skipped)"
elif [ "$UPSTREAM_HEAD" = "$UPSTREAM_FETCH" ]; then
  pass "base is current with upstream/main"
else
  fail "base is STALE — run: git fetch upstream main && git rebase upstream/main"
  echo "    local:  $UPSTREAM_HEAD"
  echo "    remote: $UPSTREAM_FETCH"
fi

# 1. Merge conflict check
echo "1. Merge conflict check"
if git diff --check upstream/main...HEAD 2>/dev/null > /dev/null; then
  pass "no merge conflicts or whitespace issues"
else
  fail "merge conflict or whitespace detected"
  git diff --check upstream/main...HEAD 2>&1 | head -10
fi

# 2. No --no-verify commits (check for unstaged/uncommitted)
echo "2. Working tree clean"
if git diff --quiet && git diff --cached --quiet; then
  pass "working tree clean"
else
  fail "uncommitted changes — stash or commit first"
  git status --short | head -10
fi

# 3. Run pre-commit on changed files
echo "3. Pre-commit hooks"
PRECOMMIT_RESULT=0
mapfile -t CHANGED_FILES < <(git diff --name-only upstream/main...HEAD --diff-filter=ACM 2>/dev/null)
pre-commit run --files "${CHANGED_FILES[@]}" > /dev/null 2>&1 || PRECOMMIT_RESULT=$?
if [ "$PRECOMMIT_RESULT" -eq 0 ]; then
  pass "all pre-commit hooks pass"
else
  fail "pre-commit hooks failed — run: pre-commit run"
  pre-commit run --all-files 2>&1 | grep "Fail\|ERROR" | head -5
fi

# 4. API tests
echo "4. API tests"
if [ -f console/api/package.json ]; then
  cd console/api
  npm ci --silent 2>/dev/null || true
  RESULT=$(node --test test/*.test.js 2>&1 | tail -3 || true)
  cd "$REPO_ROOT"
  if echo "$RESULT" | grep -q "# fail 0"; then
    pass "all API tests pass"
  else
    fail "API test failures — run: cd console/api && node --test test/*.test.js"
    echo "$RESULT" | grep "not ok" | head -5
  fi
else
  pass "no API tests"
fi

# 5. Web build
echo "5. Web build"
if [ -f console/web/package.json ]; then
  cd console/web
  npm ci --silent 2>/dev/null || true
  if npx tsc -b > /dev/null 2>&1; then
    if npm run build > /dev/null 2>&1; then
      pass "web build + typecheck clean"
    else
      fail "web build failed"
    fi
  else
    fail "TypeScript typecheck failed"
    npx tsc -b 2>&1 | head -5
  fi
  cd "$REPO_ROOT"
else
  pass "no web UI"
fi

# 6. Security scans
echo "6. Security (ggshield)"
if command -v ggshield >/dev/null 2>&1; then
  GG_OUT=$(ggshield secret scan pre-push 2>&1) || true
  if echo "$GG_OUT" | grep -qE 'No secrets|no secrets|nothing to scan'; then
    pass "ggshield clean"
  else
    fail "ggshield found issues"
  fi
else
  fail "ggshield not installed"
fi

# 7. Secret keyword grep
echo "7. Secret keyword review"
git diff --name-only upstream/main...HEAD --diff-filter=ACM 2>/dev/null | while read -r f; do
  [ -n "$f" ] && [ -f "$f" ] || continue
  grep -HnE '(password|passwd|secret|token|apikey|api_key|private[_-]?key|BEGIN RSA)\s*[=:]\s*["\x27][A-Za-z0-9]' "$f" 2>/dev/null | grep -v 'process\.env\|config\.\|env\[\|readFile\|"use strict"\|friendlyApiError\|runtime/secrets\|REQUIRED\|placeholder\|\$' || true
done > /tmp/pr-secret-review.txt
if [ ! -s /tmp/pr-secret-review.txt ]; then
  pass "no hardcoded secrets"
else
  fail "hardcoded secrets detected"
  head -5 /tmp/pr-secret-review.txt
fi
rm -f /tmp/pr-secret-review.txt

echo ""
if [ "$FAILS" -eq 0 ]; then
  echo -e "\033[0;32m✓ ALL CHECKS PASSED — READY FOR PR\033[0m"
  exit 0
else
  echo -e "\033[0;31m✗ $FAILS CHECK(S) FAILED — FIX BEFORE PUSHING\033[0m"
  exit 1
fi
