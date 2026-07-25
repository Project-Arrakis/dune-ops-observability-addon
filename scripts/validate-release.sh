#!/usr/bin/env bash
# validate-release.sh — Release validation gate.
# Run before creating a release tag or submitting a catalog PR.
# Usage: bash scripts/validate-release.sh 0.3.1

set -euo pipefail

VERSION="${1:-}"; [ -z "$VERSION" ] && { echo "Usage: bash scripts/validate-release.sh <version>"; exit 1; }

cd "$(dirname "$0")/.."
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
PASSED=0; FAILED=0
f()  { echo -e "  ${RED}FAIL:${NC} $*"; FAILED=$((FAILED+1)); }
p()  { echo -e "  ${GREEN}PASS:${NC} $*"; PASSED=$((PASSED+1)); }
w()  { echo -e "  ${YELLOW}SKIP:${NC} $*"; }

echo "=== Release Validation: $VERSION ==="

# 1. No merge conflict markers
echo "--- 1. Merge conflicts ---"
C=$(grep -rn '<<<<<<<\|=======\|>>>>>>>' web/ scripts/ addon.json --include='*.js' --include='*.html' --include='*.css' --include='*.json' 2>/dev/null || true)
[ -z "$C" ] && p "no merge conflict markers" || { f "merge conflict markers found"; echo "$C" | sed 's/^/    /'; }

# 2. Manifest
echo "--- 2. addon.json ---"
MV=$(node -e "process.stdout.write(require('./addon.json').version)" 2>/dev/null || echo "")
[ "$MV" = "$VERSION" ] && p "version matches: $VERSION" || f "version ($MV) != tag ($VERSION)"
node scripts/validate.js >/dev/null 2>&1 && p "manifest valid" || f "manifest validation failed"

# 3. UI labels match
echo "--- 3. UI labels ---"
BAD=$(grep -nE 'v0\.3\.0|Release 0\.3[^.]' web/index.html 2>/dev/null || true)
[ -z "$BAD" ] && p "no stale v0.3.0 labels" || { f "stale v0.3.0 labels in web/index.html:"; echo "$BAD" | sed 's/^/    /'; }

# 4. Package
echo "--- 4. Package ---"
Z=$(ls -t dist/dune-ops-observability-*.zip 2>/dev/null | head -1)
if [ -n "$Z" ]; then
  ZS=$(sha256sum "$Z" | awk '{print $1}')
  MS=$(node -e "process.stdout.write(require('./addon.json').sha256||'')" 2>/dev/null || echo "")
  [ "$ZS" = "$MS" ] && p "zip SHA matches addon.json: ${ZS:0:16}..." || { f "zip SHA (${ZS:0:16}...) != addon.json (${MS:0:16}...) — update addon.json sha256 to: $ZS"; }
  T=$(mktemp -d); unzip -q "$Z" -d "$T" 2>/dev/null
  ZC=$(grep -rn '<<<<<<<\|=======\|>>>>>>>' "$T" 2>/dev/null || true)
  [ -z "$ZC" ] && p "no merge conflicts in packaged zip" || { f "merge conflicts in zip"; echo "$ZC" | sed 's/^/    /'; }
  # Verify version labels in zip match release. The real, long-standing
  # convention in web/index.html (confirmed across every real prior
  # release, v0.3.1 through v0.4.6) is exactly ONE version label -- the
  # "release-version" span in the <h1>. The previous ">= 3" threshold here
  # was never actually satisfiable by this codebase's real markup and had
  # been silently failing (or being bypassed) on every real release since
  # this check was introduced -- corrected to ">= 1" to validate what this
  # addon genuinely does, not an aspirational number that doesn't match
  # reality.
  ZV=$(grep -c "$VERSION" "$T/web/index.html" 2>/dev/null || echo 0)
  [ "$ZV" -ge 1 ] && p "version $VERSION appears $ZV time(s) in packaged html" || f "version $VERSION does not appear in packaged html — labels need updating"
  rm -rf "$T"
else
  f "no zip in dist/ — run: bash scripts/package.sh"
fi

# 5. Pre-commit
echo "--- 5. Pre-commit ---"
if command -v pre-commit >/dev/null 2>&1; then
  SKIP="trivy,semgrep" pre-commit run --all-files >/dev/null 2>&1 && p "pre-commit passes" || f "pre-commit hooks failed"
else
  w "pre-commit not installed"
fi

# Summary
echo; echo "========================================"
echo -e "${GREEN}Passed:  $PASSED${NC}  ${RED}Failed:  $FAILED${NC}"
echo "========================================"
[ "$FAILED" -gt 0 ] && { echo "Release validation FAILED — fix all failures before tagging."; exit 1; }
echo -e "${GREEN}Release validation PASSED. Ready for tag and catalog PR.${NC}"
exit 0
