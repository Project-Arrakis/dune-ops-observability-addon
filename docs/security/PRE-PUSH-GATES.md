# Pre-Push Security Gates

The pre-push hook runs on every `git push` across all repositories. It is a shared script at `~/.local/bin/pre-push-gates`, symlinked into each repo's `.git/hooks/pre-push`.

## What it checks

| # | Tool | Scope | Config |
|---|---|---|---|
| 1 | gitleaks | Full repo secret scan | `.gitleaks.toml` |
| 2 | trivy | HIGH/CRITICAL secrets + misconfigs | `.trivyignore` |
| 3 | semgrep | Static analysis (p/default ruleset) | `.semgrepignore` |
| 4 | API DAST | Runtime API security test | `tests/api-security-test.sh` (core only, skipped if Console offline) |

## Installation

```bash
ln -sf ~/.local/bin/pre-push-gates .git/hooks/pre-push
```

## Bypass (emergency only)

```bash
git push --no-verify
```

## Failure behavior

If any gate fails, the push is blocked. Review the failure output, fix the issue, and retry. If a finding is a known false positive, add it to the appropriate allowlist (`.gitleaks.toml`, `.trivyignore`, `.semgrepignore`) before retrying.

## Shared script location

The pre-push script lives at `~/.local/bin/pre-push-gates` and is symlinked into all three repositories:
- `dune-awakening-selfhost-docker/.git/hooks/pre-push`
- `dune-ops-observability-addon/.git/hooks/pre-push`
- `dune-docker-addons/.git/hooks/pre-push`

This ensures consistent enforcement across the entire project.

## API DAST test

The API security test (`tests/api-security-test.sh`) is a DAST (Dynamic Application Security Testing) script that validates the running Console API for:
- Security headers
- Authentication enforcement
- CSRF enforcement
- Input validation (path traversal, SQL injection, XSS, payload size)
- Addon bridge security
- Rate limit enforcement
- Information leakage

It only runs when:
1. The `tests/api-security-test.sh` script exists (core repo only)
2. The `redblink-dune-docker-console` container is running

Otherwise it is silently skipped.

See [API-SECURITY-TEST.md](API-SECURITY-TEST.md) for the full test specification.
