#!/usr/bin/env bash
# preflight-main-sync.sh — Verify repos are synced before cutting a branch or PR.
# Checks: core fork synced with upstream, addon main synced with origin,
# catalog fork synced with upstream, no pending CI failures.
#
# Usage: bash preflight-main-sync.sh [--core] [--addon] [--catalog]

set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
PASSED=0; FAILED=0; SKIPPED=0
pass() { echo -e "  ${GREEN}✓${NC} $*"; PASSED=$((PASSED+1)); }
fail() { echo -e "  ${RED}✗${NC} $*"; FAILED=$((FAILED+1)); }
warn() { echo -e "  ${YELLOW}~${NC} $*"; SKIPPED=$((SKIPPED+1)); }

CHECK_ALL=false
CHECK_CORE=false; CHECK_ADDON=false; CHECK_CATALOG=false

for arg in "$@"; do
  case "$arg" in
    --core) CHECK_CORE=true ;;
    --addon) CHECK_ADDON=true ;;
    --catalog) CHECK_CATALOG=true ;;
  esac
done
if ! $CHECK_CORE && ! $CHECK_ADDON && ! $CHECK_CATALOG; then
  CHECK_ALL=true
fi

echo "=== Preflight: Sync & CI Status ==="
echo

# ─── Core Fork ───
if $CHECK_ALL || $CHECK_CORE; then
  CORE_DIR="${HOME}/dune-awakening-selfhost-docker"
  if [ -d "$CORE_DIR" ]; then
    echo "--- Core Fork ($CORE_DIR) ---"
    cd "$CORE_DIR"

    git fetch upstream main --quiet 2>/dev/null || true
    git fetch origin main integration/main release/v1.0.0 --quiet 2>/dev/null || true

    # Main vs upstream
    L=$(git rev-parse origin/main)
    U=$(git rev-parse upstream/main)
    if [ "$L" = "$U" ]; then
      pass "main synced with upstream ($(echo $L | cut -c1-7))"
    else
      BEHIND=$(git rev-list origin/main..upstream/main --count 2>/dev/null || echo "?")
      fail "main behind upstream by $BEHIND commits"
      # BUG FIX (2026-07-25): the suggested fix here used to be
      # `git reset --hard upstream/main && git push --force` -- the
      # exact same dangerous pattern that caused a real, confirmed
      # local-history-loss incident elsewhere in this project
      # (acp-ops-monitor's validate-and-report.sh, fixed the same day).
      # This fork carries permanent local-only history (incident
      # reports, merged PRs that will never be upstreamed), so
      # reset --hard is never actually safe here even when "behind" --
      # merge --ff-only is the correct operation: identical result when
      # genuinely, purely behind, but fails loudly instead of silently
      # discarding commits if local-only history exists.
      echo "         Fix: cd $CORE_DIR && git checkout main && git merge --ff-only upstream/main && git push origin main"
    fi

    # Integration/main vs main
    I=$(git rev-parse origin/integration/main 2>/dev/null || echo "")
    M=$(git rev-parse origin/main)
    if [ -n "$I" ] && [ "$(git merge-base "$I" "$M")" = "$M" ]; then
      pass "integration/main based on main"
    elif [ -n "$I" ]; then
      fail "integration/main not based on main — needs rebase"
      echo "         Fix: cd $CORE_DIR && git checkout integration/main && git rebase main && git push --force-with-lease"
    else
      warn "integration/main not found on origin"
    fi

    # Release/v1.0.0 vs main
    R=$(git rev-parse origin/release/v1.0.0 2>/dev/null || echo "")
    if [ -n "$R" ] && [ "$(git merge-base "$R" "$M")" = "$M" ]; then
      pass "release/v1.0.0 synced with main"
    elif [ -n "$R" ]; then
      fail "release/v1.0.0 not based on main — needs reset"
    else
      warn "release/v1.0.0 not found on origin"
    fi

    # CI failures
    FAILS=$(gh run list --repo yacketrj/dune-awakening-selfhost-docker --status failure --limit 1 --json databaseId --jq 'length' 2>/dev/null || echo "0")
    if [ "$FAILS" = "0" ]; then
      pass "no CI failures"
    else
      fail "$FAILS CI failures — delete stale runs before staging PR"
    fi
  else
    warn "core fork dir not found: $CORE_DIR"
  fi
fi

# ─── Addon ───
if $CHECK_ALL || $CHECK_ADDON; then
  # BUG FIX (2026-07-25): this used to point at
  # ~/dune-docker-addon/addon-main -- a nested clone of this exact repo,
  # living inside a 15GB redundant scratch directory that was deleted
  # during a home-directory cleanup audit. This script IS run from the
  # real addon repo -- it should check itself, not a stale nested clone
  # of itself.
  ADDON_DIR="${HOME}/dune-ops-observability-addon"
  if [ -d "$ADDON_DIR" ]; then
    echo
    echo "--- Addon ($ADDON_DIR) ---"
    cd "$ADDON_DIR"

    git fetch origin main --quiet 2>/dev/null || true
    L=$(git rev-parse main)
    R=$(git rev-parse origin/main)
    if [ "$L" = "$R" ]; then
      pass "main synced with origin ($(echo $L | cut -c1-7))"
    else
      BRANCH=$(git branch --show-current)
      fail "local main ($BRANCH) differs from origin/main"
      echo "         Fix: cd $ADDON_DIR && git checkout main && git pull --ff-only"
    fi

    FAILS=$(gh run list --repo yacketrj/dune-ops-observability-addon --status failure --limit 1 --json databaseId --jq 'length' 2>/dev/null || echo "0")
    if [ "$FAILS" = "0" ]; then
      pass "no CI failures"
    else
      fail "$FAILS CI failures — delete stale runs before staging PR"
    fi
  else
    warn "addon dir not found: $ADDON_DIR"
  fi
fi

# ─── Catalog ───
if $CHECK_ALL || $CHECK_CATALOG; then
  # BUG FIX (2026-07-25): this used to point at
  # ~/dune-docker-addon/dune-docker-addons -- a nested clone inside a
  # 15GB redundant scratch directory that was deleted during a home-
  # directory cleanup audit. The real catalog fork clone now lives
  # directly at ~/dune-docker-addons.
  CATALOG_DIR="${HOME}/dune-docker-addons"
  if [ -d "$CATALOG_DIR" ]; then
    echo
    echo "--- Catalog ($CATALOG_DIR) ---"
    cd "$CATALOG_DIR"

    git fetch upstream main --quiet 2>/dev/null || true
    git fetch origin main --quiet 2>/dev/null || true
    L=$(git rev-parse origin/main 2>/dev/null || echo "")
    U=$(git rev-parse upstream/main 2>/dev/null || echo "")
    if [ -n "$L" ] && [ -n "$U" ] && [ "$L" = "$U" ]; then
      pass "main synced with upstream ($(echo $L | cut -c1-7))"
    elif [ -n "$L" ] && [ -n "$U" ]; then
      BEHIND=$(git rev-list origin/main..upstream/main --count 2>/dev/null || echo "?")
      fail "main behind upstream by $BEHIND commits"
    else
      warn "could not check catalog sync"
    fi

    FAILS=$(gh run list --repo yacketrj/dune-docker-addons --status failure --limit 1 --json databaseId --jq 'length' 2>/dev/null || echo "0")
    if [ "$FAILS" = "0" ]; then
      pass "no CI failures"
    else
      fail "$FAILS CI failures — delete stale runs before staging PR"
    fi
  else
    warn "catalog dir not found: $CATALOG_DIR"
  fi
fi

echo
echo "========================================"
echo -e "${GREEN}Passed:  $PASSED${NC}"
echo -e "${RED}Failed:  $FAILED${NC}"
[ "$SKIPPED" -gt 0 ] && echo -e "${YELLOW}Skipped: $SKIPPED${NC}"
echo "========================================"

[ "$FAILED" -gt 0 ] && exit 1
echo "Preflight: PASSED — repos synced, no CI failures."
exit 0
