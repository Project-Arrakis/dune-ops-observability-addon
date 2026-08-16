# Compliance — dune-ops-observability-addon

This addon is a read-only UI component with no server-side code, no database,
and no persistent state. It communicates with Core exclusively via postMessage
bridge and renders aggregate-only data. Its compliance posture is derived from
the Core repo's compliance framework
(`dune-awakening-selfhost-docker/docs/security/`).

## In-Scope Controls

- **CI/CD gates:** Pre-commit (gitleaks, semgrep, trivy, unit tests), CI workflow
  (shellcheck, npm-audit, security-scanning, CI gate)
- **Branch protection:** Required status checks on `main` (7 checks), no force push
- **Secret scanning:** gitleaks (pre-commit + CI), GitGuardian (GitHub App on PRs)
- **CSP:** Content-Security-Policy meta tag in `web/index.html`
- **Release evidence:** Per `ops-observability/roadmap/release-standard.md`

## Out-of-Scope

This addon has no server, no database, no authentication, and no persistent
state. Controls that apply to the ACP bot or Core (SOC 2 policies, backup
recovery, rollback, data deletion, access review) are documented in those
repos, not duplicated here.

## Audit Trail

- Eight-hats findings register (2026-08-07, v0.4.7): `compliance/eight-hats-findings-register.md`
- Eight-hats findings register (2026-08-16, containerHealth/scope review): `compliance/eight-hats-findings-register-2026-08-16.md`
- Release evidence bundles: `ops-observability/evidence/releases/`
- Incident index (cross-repo): `~/projects/meta/Arrakis-Project/archive/INCIDENT-INDEX.md`
  (path corrected 2026-08-12 per that repo's own README -- this file
  previously pointed at a bare `~/archive/` path that no longer exists)
