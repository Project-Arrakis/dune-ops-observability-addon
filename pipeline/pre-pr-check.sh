#!/usr/bin/env bash
# pre-pr-check.sh — Run ALL validations before pushing an upstream PR.
# Usage: pre-pr-check.sh
# Fails closed — any non-zero exit blocks the PR push.

set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null)" || { echo "Not in a git repo."; exit 1; }
PIPELINE_DIR="$(dirname "$(readlink -f "$0")")"
cd "$REPO_ROOT"

FAILS=0
pass() { echo -e "  \033[0;32m✓ $*\033[0m"; }
fail() { echo -e "  \033[0;31m✗ $*\033[0m"; FAILS=$((FAILS + 1)); }

echo "============================================="
echo "  PRE-PR CHECK — $(git branch --show-current 2>/dev/null || echo 'unknown')"
echo "============================================="

# 1. Trailing whitespace
echo "1. Trailing whitespace"
if git diff --check upstream/main...HEAD 2>/dev/null > /dev/null; then
    pass "no trailing whitespace"
else
    fail "trailing whitespace detected"
    git diff --check upstream/main...HEAD 2>&1 | head -10
fi

# 2. Generated artifacts
echo "2. Generated artifacts"
if bash "$PIPELINE_DIR/artifact-guard.sh" 2>&1; then
    pass "no generated files"
else
    fail "generated files in diff"
fi

# 3. Backend tests
echo "3. Backend tests"
if [ -f console/api/package.json ]; then
    RESULT=$(cd console/api && npm test 2>&1 | tail -1 || true)
    if echo "$RESULT" | grep -q "# fail 0"; then
        pass "all tests passing"
    else
        fail "test failures — run: cd console/api && npm test"
        cd console/api && npm test 2>&1 | grep "not ok" | head -5
    fi
else
    pass "no backend tests"
fi

# 4. Web build
echo "4. Web build"
if [ -f console/web/package.json ]; then
    if (cd console/web && npm run build 2>&1) > /dev/null; then
        pass "web build clean"
    else
        fail "web build failed — run: cd console/web && npm run build"
        cd console/web && npm run build 2>&1 | grep -i "error" | head -5
    fi
else
    pass "no web UI"
fi

# 5. ShellCheck
echo "5. ShellCheck"
if command -v shellcheck >/dev/null 2>&1; then
    SH_FILES=$(git diff --name-only upstream/main...HEAD --diff-filter=ACM 2>/dev/null | grep '\.sh$' || true)
    if [ -n "$SH_FILES" ]; then
        echo "$SH_FILES" | while read -r file; do
            if shellcheck "$file" 2>&1; then
                pass "shellcheck $file"
            else
                fail "shellcheck $file"
            fi
        done
    else
        pass "no shell script changes"
    fi
else
    fail "shellcheck not installed"
fi

# 6. Gitleaks
echo "6. Gitleaks"
if command -v gitleaks >/dev/null 2>&1; then
    PR_FILES_DIR=".security-reports/pr-files"
    rm -rf "$PR_FILES_DIR"
    mkdir -p "$PR_FILES_DIR"
    git diff --name-only upstream/main...HEAD --diff-filter=ACM 2>/dev/null | while read -r f; do
        [ -n "$f" ] || continue
        [ -f "$f" ] || continue
        mkdir -p "$PR_FILES_DIR/$(dirname "$f")"
        cp "$f" "$PR_FILES_DIR/$f"
    done
    if gitleaks detect --source "$PR_FILES_DIR" --no-git --redact > /dev/null 2>&1; then
        pass "gitleaks clean"
    else
        fail "gitleaks found secrets"
        gitleaks detect --source "$PR_FILES_DIR" --no-git --redact 2>&1 | tail -10
    fi
    rm -rf "$PR_FILES_DIR"
else
    fail "gitleaks not installed"
fi

# 7. Secret keyword review
echo "7. Secret keyword review"
SECRET_FILES=$(git diff --name-only upstream/main...HEAD --diff-filter=ACM 2>/dev/null | head -50 || true)
if [ -n "$SECRET_FILES" ]; then
    FOUND=$(echo "$SECRET_FILES" | while read -r file; do
        [ -n "$file" ] && [ -f "$file" ] || continue
        grep -HnE '(password|passwd|secret|token|apikey|api_key|private[_-]?key|BEGIN RSA|BEGIN OPENSSH|FUNCOM_TOKEN|ADMIN_PASSWORD)' "$file" 2>/dev/null | grep -v 'process\.env\|config\.\|env\[\|readFile\|"use strict"\|//\|import\|REQUIRED\|placeholder\|friendlyApiError\|copyEnv\|runtime/secrets' || true
    done)
    if [ -z "$FOUND" ]; then
        pass "no hardcoded secrets"
    else
        fail "hardcoded secrets detected"
        echo "$FOUND" | head -5
    fi
else
    pass "no changed files to scan"
fi

# 8. Trivy filesystem scan
echo "8. Trivy"
if command -v trivy >/dev/null 2>&1; then
    PR_FILES_DIR=".security-reports/pr-files"
    rm -rf "$PR_FILES_DIR"
    mkdir -p "$PR_FILES_DIR"
    git diff --name-only upstream/main...HEAD --diff-filter=ACM 2>/dev/null | while read -r f; do
        [ -n "$f" ] || continue
        [ -f "$f" ] || continue
        mkdir -p "$PR_FILES_DIR/$(dirname "$f")"
        cp "$f" "$PR_FILES_DIR/$f"
    done
    if trivy fs --scanners secret,misconfig --severity HIGH,CRITICAL "$PR_FILES_DIR" > /dev/null 2>&1; then
        pass "trivy clean"
    else
        fail "trivy found issues"
        trivy fs --scanners secret --severity HIGH,CRITICAL "$PR_FILES_DIR" 2>&1 | tail -10
    fi
    rm -rf "$PR_FILES_DIR"
else
    fail "trivy not installed"
fi

# 9. Security (ggshield)
echo "9. Security scans"
GG_OUT=$(ggshield secret scan pre-push 2>&1) || true
if echo "$GG_OUT" | grep -qE 'No secrets|no secrets|nothing to scan'; then
    pass "ggshield clean"
else
    fail "ggshield found issues"
    echo "$GG_OUT" | tail -3
fi

# 10. Merge safety (JSX/TSX syntax)
echo "10. Merge safety"
if bash "$PIPELINE_DIR/merge-safety.sh" > /dev/null 2>&1; then
    pass "JS/TSX syntax clean"
else
    fail "syntax errors — run merge-safety.sh"
    bash "$PIPELINE_DIR/merge-safety.sh" 2>&1 | grep -i "error\|FAIL" | head -5
fi

echo ""
if [ "$FAILS" -eq 0 ]; then
    echo "✓ ALL CHECKS PASSED — READY FOR PR"
    exit 0
else
    echo "✗ $FAILS CHECK(S) FAILED — FIX BEFORE PUSHING"
    exit 1
fi
