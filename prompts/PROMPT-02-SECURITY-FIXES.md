# PROMPT: Addon Security Fixes — M-2, M-6, L-6

**Severity:** MEDIUM | **Domain:** Security  
**Repository:** `dune-ops-observability-addon`  
**Timeout estimate:** 1-2 hours

## Context

The dune-ops-observability-addon shipped code has 0 Critical and 0 High
security findings. The remaining issues are in deploy infrastructure and
defense-in-depth items.

## Task 1: Remove hardcoded public IP from deploy script (M-2)

**File:** `scripts/deploy/deploy-lib.sh:24`

`SERVER_IP="${SERVER_IP:-50.123.64.61}"` — a real, routable public IP
hardcoded as a default fallback. This exposes the maintainer's live
server address to anyone cloning or reading the repo.

**What to do:** Remove the hardcoded default IP. Replace with empty
string or a descriptive error. The deploy script should refuse to run
if `SERVER_IP` is not explicitly set by the operator.

```bash
# Before:
SERVER_IP="${SERVER_IP:-50.123.64.61}"

# After:
SERVER_IP="${SERVER_IP:-}"
if [ -z "$SERVER_IP" ]; then
  echo "ERROR: SERVER_IP must be set before running this script."
  echo "export SERVER_IP=<your-server-ip>"
  exit 1
fi
```

**Files to modify:**
- `scripts/deploy/deploy-lib.sh`

**Verification:**
- Run the script without setting SERVER_IP — confirm it exits with an error
- Set SERVER_IP to a valid address, confirm the script proceeds normally
- Verify via `grep "50.123.64.61"` that the IP is gone from all repo files

## Task 2: Scope gitleaks gho_ token allowlist to specific paths (M-6)

**File:** `.gitleaks.toml:17`

The `gho_[A-Za-z0-9]{40}` regex (GitHub OAuth token pattern) is currently
whitelisted globally for the entire repo. This was intended to suppress
false positives in cache files (`.placeable-cache`, `.augment-cache`),
but the scope is too broad — a real `gho_` token committed anywhere in
the repo would be silently ignored.

**What to do:** Scope the allowlist to the specific cache file paths
that need it, using gitleaks' path-scoped allowlist syntax.

```toml
[[rules]]
id = "github-oauth"
[rules.allowlist]
paths = [
  '''\.placeable-cache''',
  '''\.augment-cache''',
]
```

**Files to modify:**
- `.gitleaks.toml`

**Verification:**
- Create a test file containing a fake `gho_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx` token
- Run `gitleaks detect --source . --verbose` — confirm the test file triggers a finding
- Add the test file path to the allowlist — confirm the finding is suppressed
- Remove the test file — confirm normal scan is clean

## Task 3: Add data-sensitivity note to Diag tab (L-6)

**File:** `web/addon.js:496-512`

The Diag tab calls `writeOutput()` which includes `raw: snapshot.raw` —
the complete, unredacted bridge response. Currently safe because all
data is aggregate, but if Core ever expands a bridge action to return
per-player data (names, UUIDs, IPs), the Diag tab would display it to
anyone with Console access.

**What to do:** Add a comment above the `writeOutput()` call documenting
this regression risk. Add a data-classification note in the Diag tab's
HTML section heading: "Diagnostic output — may contain raw bridge data.
Do not share screenshots of this tab."

Also add a code comment at the `writeOutput` site:
```js
// SECURITY: This writes the unredacted bridge payload. Currently all
// bridge actions return aggregate-only data (no PII, no player IDs).
// If a bridge action ever adds per-player fields, this tab MUST be
// gated behind a higher permission or the raw output must be redacted.
```

**Files to modify:**
- `web/addon.js` — code comment at writeOutput() call
- `web/index.html` — data-classification note in Diag tab heading

**Verification:**
- Confirm the Diag tab HTML shows the data-classification warning
- Verify the code comment is present at the writeOutput() site

## State After Completion
- [ ] No hardcoded public IP anywhere in the repo
- [ ] gitleaks gho_ allowlist scoped to specific cache paths only
- [ ] Diag tab has data-classification warning
- [ ] All 57 tests pass
- [ ] Pre-commit hooks pass (gitleaks, semgrep, trivy)
