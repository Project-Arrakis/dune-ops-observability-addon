# Pre-Release Security Scan

Runs before cutting a release tag (`git tag`). Produces a signed evidence report that must pass before the release proceeds.

## Usage

```bash
bash scripts/pre-release-security.sh v0.4.0 [--ci]
```

- `v0.4.0` — release version tag
- `--ci` — skip API DAST test (no running Console in CI)

## What it checks

| # | Tool | What it catches | Output |
|---|---|---|---|
| 1 | gitleaks | Full-history secret scan | `gitleaks-report.json` |
| 2 | trivy | Filesystem secrets + misconfigs (HIGH/CRITICAL) | `trivy-report.json` |
| 3 | semgrep | Full static analysis (p/default ruleset) | `semgrep-report.json` |
| 4 | npm audit | Dependency vulnerabilities (HIGH+) | `npm-audit-output.txt` |
| 5 | shellcheck | Bash script security lints | `shellcheck-output.txt` |
| 6 | security PR checks | Keyword review, git diff check | `security-pr-checks-output.txt` |
| 7 | API DAST | Runtime API security test | `api-security-output.txt` |

## Evidence output

All reports are written to:

```
ops-observability/evidence/releases/<version>/security/
├── evidence-manifest.txt
├── gitleaks-report.json
├── trivy-report.json
├── semgrep-report.json
├── npm-audit-output.txt
├── shellcheck-output.txt
├── security-pr-checks-output.txt
└── api-security-output.txt
```

## Exit criteria

- All 7 checks pass (or are documented as skipped with reason)
- Zero unresolved HIGH/CRITICAL findings
- npm audit reports zero HIGH/CRITICAL vulnerabilities
- ShellCheck reports zero errors
- API DAST test passes all applicable checks

If any check fails:
1. Review the failure in the evidence directory
2. Fix the issue or document risk acceptance
3. Re-run the pre-release scan
4. Proceed only when all checks pass

## Script location

The pre-release scan script is maintained in both repositories:
- `dune-ops-observability-addon/scripts/pre-release-security.sh` (addon)
- `dune-awakening-selfhost-docker/scripts/pre-release-security.sh` (core)

Both are identical — the script auto-detects which checks are applicable based on what files exist (e.g., `console/api/package-lock.json` for npm audit).

## CI integration

The pre-release scan is NOT part of the CI workflow — it requires local tooling (Docker for API DAST) and generates evidence artifacts that must be committed. Run it locally before the release tag.

See [SECURITY-GATES.md](SECURITY-GATES.md) for the full three-layer security pipeline.
