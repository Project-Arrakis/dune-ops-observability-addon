# GitHub Rulesets Setup

## Purpose

This document turns the branch protection requirement into an actionable setup guide for this repository.

The goal is to prevent required status checks from being bypassed on `main` — not to require a second-person review, which is not an achievable control for this repository's single maintainer. See "A note on team size" in `docs/BRANCH-PROTECTION.md` before applying anything below.

## Protected Target

Protect this branch:

```text
main
```

## Required Merge Policy

Changes may land on `main` via PR merge or direct push — both are
permitted for this repository's single maintainer (see "A note on team
size" in `docs/BRANCH-PROTECTION.md`).

Neither route may complete until required status checks pass. Force pushes
and branch deletion are blocked regardless of route.

**This requires `enforce_admins`/"do not allow bypassing the above
settings" to be enabled** (see `docs/BRANCH-PROTECTION.md`'s
2026-08-16 correction) — without it, a repository admin's pushes
(the maintainer, on a single-maintainer repo) bypass required status
checks entirely, silently defeating "neither route may complete until
required status checks pass" above. Confirmed as a real, not
theoretical, gap: the `containerHealth` revert commit landed on `main`
while failing 4 of 7 required checks, with `enforce_admins: false` at
the time.

## Recommended Ruleset

Create a repository ruleset named:

```text
main-required-checks
```

Target branch pattern:

```text
main
```

Enforcement status:

```text
Active
```

## Required Rules

Enable these rules:

- restrict deletions;
- restrict non-fast-forward updates;
- require status checks to pass;
- require branches to be up to date before merging;
- block force pushes.

Deliberately not enabled: "require a pull request before merging" and any
required-approving-review count — see "A note on team size" in
`docs/BRANCH-PROTECTION.md`. Required status checks are the actual
enforcement mechanism here; they apply whether a change lands via PR or a
direct push, so a mandatory-PR rule adds process overhead without adding a
real control for a one-person team.

## Required Status Checks

Use the exact check names displayed in the PR checks panel.

Current required checks (see `docs/BRANCH-PROTECTION.md` for why this list
is `CI Gate` plus the five split-workflow jobs, rather than every
individual job name):

```text
CI Gate
validate
pre-commit
semgrep
gitleaks
trivy
```

## Admin and Bypass Policy

Normal work must not bypass required rules.

If GitHub allows repository admins to bypass rules, disable bypass where possible.

Emergency bypass requires a documented risk acceptance before or immediately after the bypass.

Required bypass evidence:

- PR or commit affected;
- failed or unavailable rule;
- reason for bypass;
- risk severity;
- compensating controls;
- follow-up remediation.

## Setup Steps

1. Open repository settings.
2. Open Rules or Rulesets (or, equivalently, the classic branch protection page for `main`).
3. Create a new branch ruleset (or branch protection rule).
4. Name it `main-required-checks`.
5. Target branch `main`.
6. Set enforcement to active.
7. Require required checks to pass.
8. Require the branch to be up to date before merge.
9. Add each required status check exactly as GitHub displays it (see "Required Status Checks" above).
10. Block force pushes and branch deletion.
11. Do not enable "require a pull request before merging" or any required-approving-review count — see "A note on team size" in `docs/BRANCH-PROTECTION.md`.
12. Save the ruleset.
13. Open a test PR with a failing check and verify merge is blocked; verify a direct push to `main` with a failing check is also blocked.
14. Open or update a passing PR and verify merge is allowed only after all checks complete; verify a direct push to `main` succeeds once checks pass.

## Verification Checklist

- [ ] A push to `main` (direct or via PR merge) is blocked while required checks are pending or failing.
- [ ] A push to `main` is allowed once all required checks complete and pass.
- [ ] Force-push and branch deletion on `main` are blocked.
- [ ] Emergency bypass requires tracked risk acceptance.

## Required Evidence Path

Ruleset changes should be documented under:

```text
ops-observability/releases/unreleased/prs/
```

For release-specific changes, use:

```text
ops-observability/releases/<release-id>/prs/
```

## Current Limitation

GitHub rulesets are configured in repository settings, not by this documentation file.

This document records the required configuration. The repository owner must still apply the ruleset in GitHub.
