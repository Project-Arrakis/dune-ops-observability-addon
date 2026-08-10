# Dune Ops Observability

Dune Ops Observability is a production-facing, read-only operations addon for Dune Docker Console.

It gives server owners and operators a lightweight visibility surface for player operations, data-source capability, and derived read-only KPI panels without expanding beyond the approved player-read permission boundary.

## Status

- Public addon: listed through the community addon catalog.
- Current release train: `v0.5.1` (Phase 0: tab-aware lazy loading, Grafana tab, NOC service table, placeholder tabs for AAA/NOC/Audit metrics).
- Upstream Dune Docker Console: the 9 bridge action families this addon calls (listed in "Current bridge-backed actions" below) were last individually re-confirmed against Core `v1.3.61`'s route table on 2026-07-22 — see `docs/SECURITY-ARCHITECTURE-GAP-ANALYSIS.md`. This is a targeted route-table check, not a full end-to-end compatibility test across the intervening versions from the previously-stated `v1.3.45`. No compatibility-tracking automation exists yet; re-verify against Core's `console/api/src/server.js` route table before relying on this line if significant time has passed since the date above.
- Runtime model: static addon UI loaded inside Dune Docker Console as an iframe.
- Production data path: Dune Docker Console addon bridge.
- Direct browser preview path: local sample data only.
- Repository workflow: this repository has one maintainer; changes may land via PR or direct push to `main`, gated by required status checks (see `docs/BRANCH-PROTECTION.md`) rather than a required second-person review, which is not an achievable control for a one-person team.
- Required checks: Validate addon, Pre-commit, Secret Scan, SAST, and Filesystem Scan.

## What the addon provides

### A3 Player Summary

The player summary panel shows read-only player rows when the Console bridge provides player summary data.

It is designed to handle:

- populated player data;
- empty player lists;
- missing optional fields;
- bridge or provider errors;
- local browser preview mode.

### A4 KPI Capability

The KPI capability panel states which reporting categories are currently supportable by the available read-only data.

Unsupported categories are shown explicitly instead of implying that data exists.

### A5 Read-only KPI Panels

The first KPI panels are derived only from the existing player summary payload:

- active rate;
- average level;
- top faction;
- top guild.

No additional permission, upstream route, bridge action, database access, export, webhook, or write capability is introduced by these panels.

## Security and permission boundary

The addon currently requests only:

```json
{
  "ops": ["read"]
}
```

The addon does not request or use:

- write permissions;
- `database:read`;
- raw logs;
- admin audit logs;
- exports;
- webhooks;
- persistent history;
- direct localhost browser API calls.

**Economy and inventory data**: the addon does call `ops.economy.summary` and `ops.inventory.summary` (both aggregate totals only — no player-level identifiers; see "Current bridge-backed actions" below for their current live/unavailable status) under the same `ops:read` permission as every other panel. An earlier version of this document stated the addon does not use economy or inventory data at all — that was inaccurate as of the shipped `v0.4.x` code, which has queried `ops.economy.summary` since the Activity/Combat/Resources/Economy panels were added. Both remain read-only, aggregate-only queries within the single `ops:read` scope; no new permission scope was introduced to add them.

Previous releases used `players:read`. The v0.3.0 release upgraded to `ops:read` to support the OPS Health Foundation panels without expanding the permission boundary beyond read-only operations access. Current release v0.5.1 continues with `ops:read`.

Future features that require a new permission, new bridge action, new upstream route, retained history, export, alerting, economy data, storage data, inventory data, or admin/security-sensitive data must go through design review before implementation.

See `docs/SOC-OPS-ROADMAP.md` and `docs/REPOSITORY-REQUIREMENTS-AND-DELIVERABLES.md`.

## Architecture

Dune Ops Observability has two runtime modes.

### Console iframe mode

When the addon runs inside Dune Docker Console, it uses the Console addon bridge as the production data path.

Current bridge-backed actions (as called by `web/data-providers.js`, verified against Core's `console/api/src/server.js` route table):

| Action | Status in Core | Panel |
|---|---|---|
| `ops.health.summary.v2` / `.players` / `.farms` | Live | OPS Health |
| `ops.activity.summary` | Live | Activity |
| `ops.combat.deaths` | Live | Combat |
| `ops.resources.summary` | Live | Resources |
| `ops.economy.summary` | Live | Economy |
| `ops.inventory.summary` | Live | Inventory |
| `ops.location.activity` | Not implemented — addon calls it optimistically; provider returns `{status: "unavailable"}` | Location |
| `ops.soc.summary` | Live | SOC |
| `ops.health.prometheus` | Live, conditionally — real integration against this project's optional, opt-in Prometheus stack (`dune metrics start`); returns `{status: "unavailable", reason: "metrics_stack_not_running"}` when that stack isn't running (the common/default case), which the addon surfaces with a specific "not running" message distinct from "not implemented" | Prometheus/Metrics |

`leadership.players.list` (used under the earlier `players:read` permission model, before the v0.3.0 upgrade to `ops:read`) is no longer called by any shipped panel and has been removed from this list; see `docs/METRICS-BRIDGE-ACTIONS.md` and the RFC history in `docs/RFC.md` for that migration's context.

`ops.location.activity` is permanently out of scope by design (decided 2026-07-24) — see `docs/tabs/LOCATION.md`. Per-player real-time location tracking already belongs to, and is already surfaced by, the Console's own map UI; this addon's scope is aggregate operational metrics (AAA-style NOC/SOC KPIs), not per-player tracking. `ops.health.prometheus` is implemented but conditionally available (depends on the operator having opted into the optional metrics stack). The addon's bridge provider (`web/data-providers.js`) correctly distinguishes "permanently out of scope," "implemented but currently unavailable," and other unavailable states via a `{status: "unavailable", reason: ...}` envelope.

### Direct browser preview mode

When the addon is opened directly in a browser, the real Console bridge is not available. In that case, the addon uses sample data so layout and UI work can be tested without a running Console instance.

Direct browser preview mode is not the production data path.

## Repository boundary

Addon work belongs in this repository:

- addon UI;
- addon documentation;
- addon validation;
- release packaging;
- release notes;
- security gates;
- addon branches, issues, and pull requests;
- read-only player summary and KPI views;
- addon-specific governance and developer tooling.

Bridge, API, core Console, Docker, Prometheus, and upstream runtime changes belong in the Dune Docker Console repository, not in this addon repository.

### Upstream contributions

Changes contributed to `Red-Blink/dune-awakening-selfhost-docker`:

| PR | Release | Changes |
|---|---|---|
| [#61](https://github.com/Red-Blink/dune-awakening-selfhost-docker/pull/61) | v1.3.45 | Bridge rate limiter (per-addon sliding window), IP allowlisting (ADMIN_ALLOWED_IPS), session sliding extension, CI workflow (api-tests, metrics-unit, security-checks), pre-commit hooks (gitleaks + trivy + semgrep), security PR checks, API security DAST test |

When upstream cuts a release that includes our changes, update the compatibility note in the README status section.

## Branch and PR governance

All changes must use the PR route into `main`.

Before cutting a branch, sync from `origin/main` and confirm the working tree is clean. Do not create a PR from a dirty tree, stale `main`, detached HEAD, wrong repository, wrong branch, or unreviewed staged files.

PRs must include:

- summary;
- why;
- documentation impact;
- unit / regression / E2E testing output;
- security output;
- risks and rollback plan;
- tracked PR documentation under `ops-observability/releases/<release-id>/prs/` or `ops-observability/releases/unreleased/prs/`.

`main` should be protected with GitHub rulesets or branch protection so merges are blocked until required checks complete and pass.

Required checks:

```text
Validate addon
Pre-commit
Secret Scan
SAST
Filesystem Scan
```

See `docs/GITHUB-RULESETS.md` and `docs/BRANCH-PROTECTION.md`.

## Documentation currency

Documentation drift is a merge blocker.

Every PR into `main` must review and update affected documentation before it is marked ready for review or merged.

At minimum, each PR must check:

- `README.md`;
- `docs/`;
- release notes and release testing documents;
- `ops-observability/roadmap/`;
- `ops-observability/releases/`;
- `ops-observability/dev-tools/templates/`;
- tracked PR documentation under `ops-observability/releases/<release-id>/prs/`.

If documentation is intentionally deferred, the PR must state which documentation is deferred, why it is deferred, who owns the follow-up, and the follow-up PR or issue reference.

## Installation

### Community catalog installation

Server owners should normally install published releases through the Dune Docker Console community addon catalog after the release has been reviewed and listed.

Upstream catalog submissions are release-train based. This project does not submit an upstream catalog PR for every internal feature merge.

### Private local testing

Private testing does not require the community addon index.

For release validation, test against a local Dune Docker Console checkout at:

```text
/home/darkdante/dune-clean-repro
```

The standard private test install command is:

```bash
bash /home/darkdante/dune-ops-observability-addon/scripts/validate-and-install-local-console.sh
```

The script validates the addon, builds the package, synchronizes the local Console checkout, copies the addon into the local Console runtime, and enables the approved read-only permission.

After the script completes, refresh Dune Docker Console, open Addons, and verify the addon through the Console iframe bridge.

See `docs/LOCAL-CONSOLE-TEST.md` and the current release testing document.

## Pipeline Toolchain

### Pre-PR Workflow (REQUIRED before every upstream push)

```bash
# 1. Sync base
git fetch upstream main && git rebase upstream/main

# 2. Run comprehensive PR readiness check
bash pipeline/pr-ready-check.sh

# 3. If all passes, push WITHOUT --no-verify
git push origin <branch> --force-with-lease
```

### Pre-push gate (installed as git hook)

Every push triggers `pre-push-gates` which runs:
- ggshield secret scan
- API tests
- Web build + typecheck
- Artifact guard

### Available tools

| Tool | Purpose | Run |
|------|---------|-----|
| `pr-ready-check.sh` | 7-step pre-PR validation | `bash pipeline/pr-ready-check.sh` |
| `pre-pr-check.sh` | 10-step validation | `bash pipeline/pre-pr-check.sh` |
| `pre-push-gates` | Git pre-push hook | Installed automatically |
| `merge-safety.sh` | JSX/TSX syntax check | `bash pipeline/merge-safety.sh` |
| `artifact-guard.sh` | Blocks generated files | `bash pipeline/artifact-guard.sh` |

**Cross-repo tool, not part of this repository's own pipeline**: `tools/cross-repo-security-tests/run-security-tests.sh` injects OWASP Top 10-style tests into a checked-out `dune-awakening-selfhost-docker` repo and runs them there (`bash tools/cross-repo-security-tests/run-security-tests.sh <path-to-that-repo>`). It tests Core's `console/api/src/server.js`, not anything in this addon, and is not run by any workflow in this repository — see that directory's own README.

### Common pushback causes (caught by pr-ready-check)

| Issue | Caught by |
|-------|-----------|
| Trailing whitespace | Step 1 (merge check) |
| Stale base / merge conflict | Step 0 (upstream sync) |
| Broken tests | Step 4 (API tests) |
| Build failure | Step 5 (web build) |
| Hardcoded secrets | Step 7 (keyword review) |
| Dirty working tree | Step 2 |

The local gate scripts detect required tools before they run. When a tool is missing, they attempt to install it automatically by default.

Auto-install can use available local package managers and language installers such as apt, pipx/pip, Go, Homebrew, or the upstream Trivy installer. If a tool cannot be installed safely in the current environment, the gate fails closed with the missing tool and remediation target.

Disable auto-install when you only want detection:

```bash
DUNE_AUTO_INSTALL_TOOLS=0 bash ops-observability/dev-tools/pr-gate.sh
```

Bootstrap the full local toolchain explicitly:

```bash
bash ops-observability/dev-tools/toolchain-bootstrap.sh
```

Run local validation from the addon repository:

```bash
node scripts/validate.js
bash scripts/package.sh
bash ops-observability/dev-tools/precommit-gate.sh
bash ops-observability/dev-tools/security-shift-left.sh
bash ops-observability/dev-tools/pr-gate.sh
```

The gate scripts intentionally print concise `PASS:` / `FAIL:` lines. When a gate fails, it prints compact failure details. For full scanner diagnostics, run the underlying tool directly.

Individual quiet gates:

```bash
bash ops-observability/dev-tools/precommit-gate.sh
bash ops-observability/dev-tools/gitleaks-gate.sh
bash ops-observability/dev-tools/semgrep-gate.sh
bash ops-observability/dev-tools/trivy-gate.sh
```

GitHub's contents API does not preserve executable mode. Use `bash <script>` unless the local file has been made executable.

For quick UI work, open `web/index.html` directly in a browser. The addon will use sample data in direct browser preview mode.

For bridge validation, install the addon into the local Dune Docker Console checkout and open it through the Console Addons page.

## Release process

Public releases follow a release-train model.

Internal addon work continues through focused pull requests for auditability. Upstream community catalog updates are batched by released addon version or meaningful feature batch.

A public release requires:

- addon manifest validation;
- pre-commit checks;
- secret scan;
- static analysis;
- filesystem scan;
- package build;
- browser preview smoke test;
- private Dune Docker Console test;
- real bridge smoke test through the Console Addons page;
- release notes;
- pinned GitHub release asset;
- SHA-256 checksum verified from the uploaded release asset.

See:

- `docs/LOCAL-CONSOLE-TEST.md`;
- `docs/RELEASE-CADENCE.md`;
- current release notes;
- current release testing checklist.

## Roadmap

The current public roadmap spans 5 Addon releases (v0.2–v1.0) with 4 Core infrastructure releases (R1–R5). See `docs/ROADMAP.md` for the full release table, dependency graph, and tagging convention.

Near-term releases:

- `v0.2.0`: Player Operations — A3 Player Summary, A4 KPI Capability, A5 read-only KPI panels (released)
- `v0.3.0`: OPS Health Foundation — source health, bridge freshness, stale-data warnings, operator status (released)
- `v0.4.0`: Game Activity & Combat — sessions, transitions, retention, PvP/PvE, NPC kills (released)
- `v0.4.1`: Security & CI Hardening — pinned actions, SBOM, dependency review, unavailable states, tests (released)
- `v0.5.1`: Phase 0 — tab-aware lazy loading, NOC service table, freshness badges, Grafana tab, placeholder tabs, live resource gauges (released 2026-08-10)
- `v0.6.0`: Economy & Resources — gathering, currency, market, inflation
- `v0.7.0`: World & Assets — crafting, territory, heat maps, storage
- `v1.0.0`: SOC/OPS Operations Center — platform health, Prometheus display, runbooks (requires Core R3+R4)

Upstream contributions to Dune Docker Console:

| PR | Changes | Status |
|---|---|---|
| [#61](https://github.com/Red-Blink/dune-awakening-selfhost-docker/pull/61) | Bridge rate limiter, IP allowlisting, session sliding, CI workflow | Merged (v1.3.45) |

See `docs/ROADMAP.md`, `docs/OBSERVABILITY-ROADMAP.md`, and `docs/SOC-OPS-ROADMAP.md`.

## Contributing

Contributions, testing notes, issue reports, and operator feedback are welcome.

Good contributions include:

- bug reports with clear reproduction steps;
- screenshots or notes from private Console testing;
- accessibility improvements;
- documentation corrections;
- safer empty-state handling;
- read-only UI improvements;
- proposals for SOC / OPS metrics with permission and security impact clearly stated.

Before opening a pull request:

1. Keep the change focused.
2. Branch from current `main`.
3. Avoid expanding permissions unless a design discussion has already approved it.
4. Run local validation and quiet gates.
5. Review README and affected docs for drift.
6. Document testing performed.
7. Call out any security, permission, bridge, documentation, or upstream impact.

For metric proposals, classify the proposal as minor, major, or patch using `docs/SOC-OPS-ROADMAP.md`.

## Feedback and support

Use GitHub issues and pull requests for feedback, bug reports, roadmap discussion, and contribution review.

When reporting an issue, include:

- addon version;
- Dune Docker Console version or commit when known;
- whether the addon was installed through the catalog or privately copied into Console;
- browser and operating system;
- screenshots or logs when safe to share;
- expected behavior;
- actual behavior.

Do not include secrets, tokens, private server data, player personal data, or sensitive logs in public issues.

## Documentation index

- `docs/ROADMAP.md` — unified roadmap: release table, dependency graph, tagging convention, decision log.
- `docs/RFC.md` — formal RFC for the comprehensive roadmap and release cadence.
- `docs/OBSERVABILITY-ROADMAP.md` — per-release candidate metrics and database review requirements.
- `docs/SOC-OPS-ROADMAP.md` — SOC / OPS P0/P1/P2 metric taxonomy and release classification.
- `docs/RELEASE-CADENCE.md` — release train policy, versioning, upstream catalog PR rules.
- `docs/BRANCHING.md` — branch naming conventions for addon and core.
- `docs/BRANCH-PROTECTION.md` — branch protection intent and required checks.
- `docs/GITHUB-RULESETS.md` — actionable GitHub ruleset setup for `main`.
- `docs/REPOSITORY-REQUIREMENTS-AND-DELIVERABLES.md` — repository governance baseline, gates, deliverables, upstream sync requirements.
- `docs/DATA-PROVIDERS.md` — sample provider and Console bridge provider boundary.
- `docs/LOCAL-CONSOLE-TEST.md` — local Console validation and install procedure.
- `docs/PACKAGING.md` — package build and release workflow.
- `docs/RELEASE-ASSET-CHECKSUM.md` — release asset checksum verification procedure.
- `docs/COMMUNITY-INDEX-PR.md` — upstream catalog submission guidance.
- `docs/security/SECURITY-GATES.md` — three-layer security pipeline: pre-commit, pre-push, pre-release.
- `docs/security/SHIFT-LEFT-SECURITY.md` — local hook and CI security policy.
- `docs/security/PRE-PUSH-GATES.md` — pre-push hook specification.
- `docs/security/PRE-RELEASE-SECURITY.md` — pre-release security scan specification.
- `docs/security/API-SECURITY-TEST.md` — DAST test categories and semantics.
- `docs/security/CONFIG-TEMPLATES.md` — security config file reference across repos.
- `docs/METRICS-BRIDGE-ACTIONS.md` — proposed bridge action names and behavior.
- `docs/DATABASE-EVENT-INVENTORY.md` — PostgreSQL event inventory procedure.
- `docs/METRIC-DISCOVERY-FINDINGS.md` — first discovery run findings.

## License

No license file is currently included. Add a license before accepting broad external code contributions.

## Development & Testing

### Deployment Scripts

The `scripts/deploy/` directory contains tools for managing clean testing environments:

```bash
# Deploy full stack with feature branch
./scripts/deploy/deploy-clean-stack.sh feature/my-branch

# Deploy web UI only (faster for UI-only changes)
./scripts/deploy/deploy-clean.sh main

# Deploy with fresh secrets (don't preserve from RBAC stack)
./scripts/deploy/deploy-clean-stack.sh main --clean-secrets

# Skip post-deploy tests
./scripts/deploy/deploy-clean-stack.sh main --skip-tests
```

**Features:**
- Automatic volume isolation (prevents conflicts with other deployments)
- Secrets preservation from RBAC stack (optional)
- Mount validation (ensures container reads from correct directory)
- Post-deployment health checks
- Support for feature branch testing

See `scripts/deploy/README.md` for detailed documentation.

### Testing Workflow

1. **Make changes** to addon code in `web/` or backend in upstream fork
2. **Deploy clean environment** using deployment scripts
3. **Test changes** in isolated environment
4. **Run E2E tests** to validate functionality
5. **Commit and push** to feature branch
6. **Create PR** when ready for review

### Repository Structure

```
addon-main/
├── web/                    # Addon UI (HTML/CSS/JS)
├── scripts/
│   └── deploy/            # Deployment scripts
├── docs/                  # Documentation
└── addon.json             # Addon manifest
```
