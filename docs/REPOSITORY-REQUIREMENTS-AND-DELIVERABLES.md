# Repository Requirements and Deliverables

Status: Draft governance baseline
Repository: `yacketrj/dune-ops-observability-addon`
Canonical branch: `main`
Canonical remote: `origin`
Scope: Dune Ops Observability addon development, release planning, validation evidence, security gates, and release controls.

## 1. Purpose

This document consolidates the standing requirements for this repository.

It defines:

- repository scope;
- working-tree requirements;
- branch and PR gates;
- documentation currency requirements;
- PR documentation requirements;
- release deliverables;
- security and privacy guardrails;
- shift-left security requirements;
- local toolchain bootstrap requirements;
- SBOM requirements;
- SOC2-style evidence requirements;
- package exclusion requirements;
- reusable template requirements.

This document is additive to the existing project docs. If a conflict is found, stop and reconcile before cutting a branch, PR, or release.

## 2. Existing Documentation Baseline

This repository already establishes the following baseline:

- Addon-specific work lives in this repository.
- Core bridge, Console API, runtime, and upstream PR work lives in the WSL/core repository.
- The addon is production-facing and read-only.
- The production data path is the Dune Docker Console addon bridge.
- Direct browser preview mode uses sample data only.
- Release work must pass validation gates before public release.
- Shift-left security is required through local hooks and CI gates.
- Public releases must include package validation and checksum verification.
- Local gates must detect required tooling and bootstrap missing tools where supported.

Relevant existing docs:

```text
docs/BRANCHING.md
docs/WORKSTREAM-SPLIT.md
docs/RFC-ADDENDUM-ADDON-FIRST-OBSERVABILITY.md
docs/DATA-PROVIDERS.md
docs/security/SECURITY-GATES.md
docs/security/SHIFT-LEFT-SECURITY.md
docs/RELEASE-CADENCE.md
docs/PACKAGING.md
docs/COMMUNITY-INDEX-PR.md
docs/GITHUB-RULESETS.md
docs/BRANCH-PROTECTION.md
```

## 2.1 Documentation Currency Requirement

Every PR into `main` must have all affected documentation reviewed and updated before it is marked ready for review or merged.

Documentation drift is a merge blocker.

At a minimum, each PR must check whether the following files or areas are affected by the change:

- `README.md`
- `docs/`
- `ops-observability/roadmap/`
- `ops-observability/releases/`
- `ops-observability/dev-tools/templates/`
- release notes and release testing documents
- tracked PR documentation under `ops-observability/releases/<release-id>/prs/`

The PR body must include a documentation impact statement:

```text
Documentation Impact:
- README.md: updated / not affected / needs follow-up
- docs/: updated / not affected / needs follow-up
- release docs: updated / not affected / needs follow-up
- PR tracking docs: updated
```

A PR must not be marked ready if it changes behavior, workflows, gates, package behavior, release process, permissions, data access, operator commands, or public-facing addon behavior without updating the corresponding documentation.

If documentation is intentionally deferred, the PR must state which documentation is deferred, why it is deferred, who owns the follow-up, and the follow-up PR or issue reference.

`README.md` is the public entry point and must remain aligned with the current release train, current permissions, supported data providers, install and test commands, security posture, and operator workflow.

## 3. Active Repository Scope

The active repository is:

```text
yacketrj/dune-ops-observability-addon
```

The expected local checkout is:

```text
~/dune-work/addon-main
```

The canonical branch is:

```text
main
```

The canonical remote is:

```text
origin
```

The `template` remote may exist as a Red-Blink addon-template reference. It is not the branch base for active development unless explicitly declared for a template-sync task.

## 4. Repository Boundary

This addon repository owns addon UI, addon documentation, addon validation, release packaging, release notes, security gates, addon issues, addon branches, pull requests, read-only player summary and KPI views, observability release planning, release evidence, governance documents, and addon-specific dev tooling.

The WSL/core repository owns bridge action changes, bridge permission changes, Console API route changes, Docker/runtime changes, Prometheus/exporter work, and upstream pull requests into Red-Blink core repositories.

Supporting local worktrees may be referenced by dev scripts, but they are not the active repository for addon governance work by default.

## 5. Required Repository Layout

The required observability control layout is:

```text
ops-observability/
├── dev-tools/
├── evidence/
│   └── releases/
├── releases/
├── roadmap/
└── tools/
```

`ops-observability/dev-tools/` contains tracked development scripts, validation gates, patchers, and reusable templates.

`ops-observability/evidence/` contains curated release evidence only.

`ops-observability/releases/` contains release plans, checklists, PR documentation, and release-specific templates.

`ops-observability/roadmap/` contains internal standards, classification rules, release policy, and observability planning documents.

`ops-observability/tools/` contains stable reusable tooling that supports release evidence or telemetry discovery.

## 6. Branch and PR Base Requirements

Before creating any branch or cutting any PR, `main` must be clean and in lockstep with `origin/main`.

For the addon repository:

Required preflight:
```bash
cd ~/dune-ops-observability-addon

git fetch origin --prune
git switch main
git pull --ff-only origin main

git status --short --branch

test "$(git rev-parse main)" = "$(git rev-parse origin/main)" \
  && echo "PASS: main is in lockstep with origin/main" \
  || echo "FAIL: main differs from origin/main"

test -z "$(git status --porcelain)" \
  && echo "PASS: working tree is clean" \
  || echo "FAIL: working tree has changes"
```

For the core fork repository, additionally verify the fork is synced with upstream before staging a PR:

```bash
cd ~/dune-awakening-selfhost-docker

git fetch upstream --prune
git fetch origin --prune

test "$(git rev-parse origin/main)" = "$(git rev-parse upstream/main)" \
  && echo "PASS: fork main synced with upstream" \
  || echo "FAIL: fork behind upstream — sync before branching"
```

**Automated preflight**:
```bash
bash ops-observability/dev-tools/preflight-main-sync.sh
```

This script checks all three repos (core, addon, catalog) for:
- Fork synced with upstream (core + catalog)
- Local main synced with origin (addon)
- Feature branches (integration/main, release/v*) based on current main
- Zero pending CI failures (stale runs deleted before staging)

No branch or PR may be created from stale `main`, a dirty working tree, detached HEAD, the wrong repository, the wrong branch, unreviewed staged files, unpulled `origin/main`, unknown local-only state, an unsynced upstream fork, or with pending CI failures.

## 6.1 Upstream Sync Cadence

- **Core fork**: Sync `main` with upstream at minimum before each new PR stage. After upstream cuts a release, sync all feature branches within 24 hours.
- **Catalog fork**: Sync before submitting catalog PRs.
- **Sync procedure**:
  ```bash
  # Core fork — reset to upstream
  cd ~/dune-awakening-selfhost-docker
  git checkout main && git reset --hard upstream/main && git push origin main --force

  # Rebase feature branches
  git checkout integration/main && git rebase main && git push origin integration/main --force-with-lease
  git checkout release/v1.0.0 && git reset --hard main && git push origin release/v1.0.0 --force-with-lease
  ```
- **CI cleanup**: Delete stale failed workflow runs before staging PRs:
  ```bash
  for id in $(gh run list --repo yacketrj/dune-awakening-selfhost-docker --status failure --limit 50 --json databaseId --jq '.[].databaseId'); do
    gh api -X DELETE "repos/yacketrj/dune-awakening-selfhost-docker/actions/runs/$id"
  done
  ```

Required result:

```text
PASS: main is in lockstep with origin/main
PASS: working tree is clean
```

No branch or PR may be created from stale `main`, a dirty working tree, detached HEAD, the wrong repository, the wrong branch, unreviewed staged files, unpulled `origin/main`, or unknown local-only state.

## 7. PR Documentation Requirements

Every PR must include a populated PR body with these sections:

```text
Summary
Why
Documentation Impact
Unit / Regression / E2E Testing Output
Security Output
Risks
```

Each PR must also have tracked PR documentation under the relevant release folder.

Recommended path:

```text
ops-observability/releases/<release-id>/prs/
```

If a PR is not tied to a numbered release, use:

```text
ops-observability/releases/unreleased/prs/
```

## 8. Required PR Body Template

Every PR body must follow `ops-observability/dev-tools/templates/pr-body-template.md` unless a release-specific template is stricter.

The Documentation Impact section is mandatory for every PR.

## 9. Security Guardrails

The repository is public. Treat every committed file as public.

Only aggregate, sanitized observability evidence may be committed. Private runtime data, private player data, location-like game data, private operational data, and unsafe direct database access patterns must not be committed.

## 10. Shift-Left Security Requirements

Shift-left security gates must run before review whenever possible.

Required tools:

```text
Gitleaks
Semgrep
Trivy
shellcheck
```

Required local checks (three layers):

```text
Layer 1 — Pre-commit (every git commit):
  - Gitleaks secret scan (staged files)
  - Trivy filesystem secret scan (HIGH/CRITICAL, respects .trivyignore)
  - Semgrep static analysis (p/default ruleset, respects .semgrepignore)
  - Standard hooks: JSON/YAML syntax, merge conflict, line endings, whitespace

Layer 2 — Pre-push (every git push):
  - Gitleaks full-repo secret scan
  - Trivy HIGH/CRITICAL scan
  - Semgrep static analysis
  - API security DAST test (tests/api-security-test.sh) — skipped if Console offline

Layer 3 — Pre-release (before release tag):
  - All Layer 1 + Layer 2 checks
  - npm audit --audit-level=high
  - shellcheck on all bash scripts
  - Security PR checks (keyword review, git diff)
  - Full evidence report generated (scripts/pre-release-security.sh)
```

See [SECURITY-GATES.md](security/SECURITY-GATES.md) for detailed tool configuration, allowlists, and installation.

- Gitleaks for secret scanning;
- Semgrep for static analysis;
- Trivy for filesystem/dependency vulnerability scanning;
- `git diff --check` for whitespace and conflict-marker validation;
- repository-specific privacy scan for prohibited observability data;
- SBOM impact check.

No PR should proceed with unresolved critical or high findings unless risk acceptance is documented.

Quiet local gate wrappers should print concise `PASS:` or `FAIL:` lines. Successful checks should not emit scanner banners, ASCII blocks, marketing text, or long summaries. Failed checks should print compact details showing what failed.

Gate scripts that invoke external tools must detect required tools before running them. By default, gates should bootstrap missing supported tools through `ops-observability/dev-tools/toolchain-bootstrap.sh`. Set `DUNE_AUTO_INSTALL_TOOLS=0` to disable installation and run detection only.

If the environment cannot install a missing tool, the gate must fail closed and name the missing tool and required remediation target.

## 11. PR Gates

A PR is not ready unless all of the following are true:

- `main` was clean and in lockstep with `origin/main` before branching;
- core fork `main` is synced with `upstream/main` (no new upstream commits pending);
- branch is based on current `main`;
- `preflight-main-sync.sh` passes (repos synced, zero CI failures);
- working tree is clean after commit;
- working tree is clean after commit;
- changed files are reviewed;
- README and affected docs are reviewed for drift;
- PR body includes all required sections;
- Documentation Impact is complete;
- tracked PR documentation exists;
- unit output is included;
- pre-commit hooks pass (all 10 hooks, including gitleaks + trivy + semgrep);
- pre-push gates pass (gitleaks + trivy + semgrep + API DAST);
- bridge smoke test passes (`bash tests/bridge-smoke-test.sh`);
- code review checklist complete (`ops-observability/dev-tools/templates/code-review-checklist.md`);
- **zero CI failures across all 4 repos** — stale runs must be deleted before upstream PR;
- upstream fork synced with Red-Blink main;
- all open PRs verified mergeable and clean;
- regression output is included;
- E2E output is included or explicitly justified as not applicable;
- security output is included;
- Gitleaks output is included;
- Semgrep output is included;
- Trivy output is included or explicitly justified as not applicable;
- SBOM impact is stated;
- SOC2-style control impact is stated;
- security/privacy scan confirms no prohibited data committed;
- risks and rollback plan are documented.

## 12. Release Gates

A release is not ready unless it includes release plan, release checklist, PR documentation, test evidence, security evidence, SBOM output or no-change statement, SOC2-style control evidence, risk review, rollback plan, release decision, known limitations, package build output, and release asset checksum.

## 13. SBOM Requirements

Every release package must include or generate an SBOM unless explicitly marked not applicable with justification.

Preferred formats:

```text
CycloneDX JSON
SPDX JSON
```

Recommended path:

```text
ops-observability/evidence/releases/<release-id>/sbom/
```

Required PR statement:

```text
SBOM impact: No dependency or package-content changes.
```

or:

```text
SBOM impact: Dependency or package contents changed. SBOM regenerated and validation output included.
```

## 14. SOC2-Style Evidence Requirements

Use SOC2-style evidence language only. Do not claim SOC2 certification or SOC2 compliance unless formally audited.

Correct language:

```text
SOC2-style evidence
control-oriented evidence
audit-ready release documentation
```

Required control categories include change management, access control, testing evidence, security review, risk review, data handling / privacy review, rollback plan, and audit trail.

## 15. Addon Runtime and Data-Provider Requirements

Production runtime:

```text
Dune Docker Console iframe addon bridge
```

Direct browser preview:

```text
sample data only
```

The addon must not use direct browser calls to raw host-local API ports as its default production data path.

Bridge-mediated access remains the default supported provider.

Any future same-origin local API provider must be optional, reviewed, read-only by default, and explicitly documented.

## 16. Permission and Capability Requirements

Current addon permission boundary (v0.4.1):

```json
{
  "ops": ["read"]
}
```

The addon must not request write permissions for observability MVP work.

Future work that requires new permission, new bridge action, new upstream route, retained history, export, alerting, economy data, storage data, inventory data, or admin/security-sensitive data needs design review before implementation.

## 17. OPS Bridge Requirements

Existing baseline bridge-backed addon action:

```text
leadership.players.list
```

Future Core bridge work may define additional actions, but bridge action changes belong in the WSL/core repository, not this addon repository.

Known Release 0.3 planning targets:

```text
ops.health.players
ops.health.farms
ops.health.summary.v2
```

Compatibility requirement:

```text
ops.health.summary remains unchanged unless explicitly modified by a future compatibility release.
```

## 18. Package and Release Asset Requirements

Local package validation must run before release.

Required commands should include:

```bash
node scripts/validate.js
bash scripts/package.sh
```

Release assets must include versioned addon package zip, SHA-256 checksum, release notes, and pinned release asset URL.

The community addon index must point to a pinned GitHub Release asset URL, not GitHub's automatic source archive.

## 19. Package Exclusion Requirements

The following paths are tracked for governance and development but should be excluded from runtime release packages unless explicitly needed:

```text
ops-observability/dev-tools/
ops-observability/evidence/
ops-observability/releases/
ops-observability/roadmap/
docs/
```

The actual exclusion mechanism must match `scripts/package.sh`.

## 20. Community Index PR Requirements

Open an upstream catalog PR only after the tag exists, the release asset exists, the uploaded asset checksum is verified, private Console test has passed, the manifest URL is final, the download URL is final, the version is final, the checksum is final, and addon repository checks are green.

The community index PR must include summary, why, release package information, test output, security output, permissions requested, and review notes.

## 21. Release 0.2 Deliverables

Release name:

```text
Internal Telemetry Discovery
```

Required deliverables include release plan, SQL classification, SQL review checklist, source artifacts document, checklist, safe candidate file, review files, tool run output, privacy scan output, safe output, and release decision.

Approved safe aggregate candidates:

- player status summary grouped by online status, life state, and character state;
- farm aggregate summary including total, ready, alive, connected players, incoming S2S, and outgoing S2S.

Held or rejected categories include economy, inventory, markers, maps, locations, event logs, JSON keys, guild, Landsraad, and resource fields.

## 22. Release 0.3 Deliverables

Release name:

```text
Expanded Aggregate DB Bridge Actions
```

Required deliverables include release plan, checklist, PR body, PR documentation, patch plan, validation checklist, privacy guard, security output, test evidence, SBOM impact evidence, SOC2-style control evidence, risk review, rollback plan, and release decision.

Required planned bridge actions:

```text
ops.health.players
ops.health.farms
ops.health.summary.v2
```

Compatibility requirement:

```text
ops.health.summary remains unchanged unless explicitly modified by a future compatibility release.
```

## 23. Required Templates

Reusable templates should live under:

```text
ops-observability/dev-tools/templates/
```

Required templates:

```text
pr-body-template.md
pr-validation-template.md
pr-security-output-template.md
pr-risk-review-template.md
sbom-impact-template.md
soc2-style-controls-template.md
shift-left-security-gate-template.md
release-gate-template.md
risk-acceptance-template.md
release-decision-template.md
code-review-checklist.md
```

Release-specific templates may live under:

```text
ops-observability/releases/<release-id>/
```

## 24. Required Dev Tools

Recommended tracked scripts:

```text
ops-observability/dev-tools/toolchain-bootstrap.sh
ops-observability/dev-tools/preflight-main-sync.sh
ops-observability/dev-tools/check-upstream-prs.sh
ops-observability/dev-tools/validate-addon-state.sh
ops-observability/dev-tools/validate-core-ops-health-worktree.sh
ops-observability/dev-tools/security-shift-left.sh
ops-observability/dev-tools/pr-gate.sh
ops-observability/dev-tools/release-gate.sh
ops-observability/dev-tools/run-ops-health-03-validation.sh
tests/bridge-smoke-test.sh
```

Gate and validation tools should fail closed, detect required external tools before use, bootstrap missing supported tools by default, print concise `PASS:` or `FAIL:` results for normal operator use, print compact failure details when checks fail, avoid modifying files unless explicitly named as patchers, refuse wrong repositories, refuse dirty worktrees unless explicitly designed to inspect them, write evidence to release-specific evidence directories, and avoid committing sensitive data.

## 25. Risk Acceptance Requirements

Risk acceptance is required when a high or critical tool finding cannot be remediated before PR, E2E testing is not performed, SBOM generation is skipped, required security tools cannot run, prohibited telemetry categories are touched, release evidence is incomplete, or a compatibility risk is known.

Risk acceptance must include risk description, impacted component, severity, reason for acceptance, compensating controls, expiry or revisit condition, and approving reviewer.

## 26. Definition of Done

A repository change is done when:

- branch was created from synced `main`;
- changes are scoped to expected paths;
- README and affected docs are reviewed and updated;
- documentation impact is recorded in the PR body;
- unit, regression, and E2E evidence is captured or justified;
- security scans are captured;
- SBOM impact is documented;
- SOC2-style controls are documented;
- risks and rollback plan are documented;
- PR body is complete;
- tracked PR documentation exists;
- no prohibited data is committed;
- release evidence is updated where applicable.

A release is done when all PRs are merged or explicitly deferred, release checklist is complete, release decision is written, evidence is complete and sanitized, known limitations are documented, rollback plan is documented, and release package excludes governance/dev-only content unless explicitly required.
