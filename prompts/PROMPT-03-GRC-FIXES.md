# PROMPT: GRC + Documentation Fixes — H-2, M-3, M-4, L-8, L-9

**Severity:** HIGH + MEDIUM | **Domain:** GRC  
**Repository:** `dune-ops-observability-addon`  
**Timeout estimate:** 1-2 hours

## Context

The addon has strong operations documentation (5-gate release standard,
comprehensive CI, CHANGELOG) but the governance/compliance layer has
several documented-but-not-enforced controls and stale artifacts.

## Task 1: Enable branch protection on main (H-2)

**Background:** `docs/GITHUB-RULESETS.md` describes a ruleset called
`main-required-checks` with 5 required CI checks. The CHANGELOG marks
S-2 (missing branch protection) as resolved, but the 2026-07-22 gap
analysis confirmed the GitHub API returns 404/empty for both branch
protection and rulesets on this repo.

**What to do:** Enable the documented ruleset. Use the GitHub CLI or
API to create a ruleset matching the documentation:
- Target: `main` branch
- Required status checks: all 5 CI jobs (unit-tests, shellcheck, json-validation, npm-audit, security-scanning + ci-gate)
- Require branches to be up to date
- Block force pushes

Verify with: `gh api repos/yacketrj/dune-ops-observability-addon/rulesets`

**Verification:**
- Ruleset is visible in GitHub repo settings
- A push to a branch with a failing CI check cannot be merged to main

## Task 2: Update compliance scaffolding (M-3)

**Background:** `compliance/README.md` references SOC 2 controls for the
ACP ecosystem. Every policy and runbook it lists (threat-model.md,
backup-recovery.md, rollback.md) is missing from this repo. This is a
stale artifact from the ACP bot repo.

**What to do:**

Option A (preferred): Update the compliance README to state that this
addon's compliance framework lives within the Core repo's compliance
framework (`dune-awakening-selfhost-docker`). The addon is a read-only
UI component with no server-side code, no database, and no persistent
state — its compliance posture is derived from Core's. Replace the ACP
scaffolding with a brief note referencing Core.

Option B: Create the missing files. If you want this addon to have its
own independent compliance framework, create the referenced files.

**Files to modify:**
- `compliance/README.md`

**Verification:**
- No broken references to missing files in compliance/README.md
- All referenced files exist OR the references are removed

## Task 3: Document release evidence requirements (M-4)

**Background:** Only two release evidence bundles exist (0.2 and 0.3)
despite the shipped version being 0.4.7. The release standard requires
16-file evidence bundles per release.

**What to do:** Document a policy for when evidence is required:
- Major/minor releases (0.x.0, 1.0.0): full 16-file evidence bundle
- Patch releases (0.x.y): security scan output + CHANGELOG entry only
- Pre-release candidates (0.x.y-rcN): security scan output only

Add this policy to the release standard doc and note which past releases
are grandfathered (evidence not required retroactively for 0.4.0-0.4.6).

**Files to modify:**
- `ops-observability/roadmap/release-standard.md`
OR
- `docs/RELEASE-CADENCE.md`

**Verification:**
- Policy is clearly stated in one of the release docs
- The current v0.4.7 release has at minimum security scan output

## Task 4: Fix stale checkout path in docs (L-9)

**Background:** `docs/REPOSITORY-REQUIREMENTS-AND-DELIVERABLES.md`
§3 says the expected checkout is `~/dune-work/addon-main`, but the
actual clone lives at `~/projects/dune/dune-ops-observability-addon`.
This is documentation drift from the July 2026 directory reorganization.

**What to do:** Search the entire repo for `dune-work/addon-main` and
replace with `projects/dune/dune-ops-observability-addon` or use a
variable reference (`$ADDON_REPO` or similar).

**Files to modify:**
- `docs/REPOSITORY-REQUIREMENTS-AND-DELIVERABLES.md`
- Any other files referencing the old path

**Verification:**
- `grep -r "dune-work" .` returns zero matches in tracked files

## State After Completion
- [ ] Branch protection ruleset enabled on main
- [ ] Compliance README no longer references missing files
- [ ] Release evidence requirements documented by version type
- [ ] No stale file paths referencing the pre-reorg directory structure
