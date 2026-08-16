# Branch Protection Requirements

## Purpose

`main` must be protected so pull requests cannot merge until required checks have completed and passed.

## A note on team size

This repository has one maintainer. A required-approving-review count is
**not** part of this document's required settings, and should not be added:
with exactly one contributor, "require 1 approval" either blocks the
maintainer from merging their own work, or is satisfied by self-approval,
which is not a real control. Everything below is scoped to what a solo
maintainer can meaningfully configure and comply with — protecting the
maintainer from their own mistakes (an accidental force-push, a
`--no-verify` commit under time pressure, forgetting to open a PR), not
requiring a second person who doesn't exist on this project.

## Protected Branch

```text
main
```

## Required Settings

Enable the following protections for `main`:

- require status checks to pass before merging;
- require branches to be up to date before merging;
- **enforce restrictions for administrators (`enforce_admins: true`)**;
- do not allow force pushes;
- do not allow branch deletion.

**Correction (2026-08-16, issue #85):** an earlier version of this
document claimed "direct pushes to `main` remain possible for the
maintainer, gated only by required status checks." That claim was
**factually wrong**, not a deliberate risk acceptance — per GitHub's
own documentation ("Do not allow bypassing the above settings"), a
repository admin's pushes bypass ALL branch protection restrictions,
*including* required status checks, unless `enforce_admins` is
explicitly enabled. With `enforce_admins: false` (this repo's actual
setting until this correction), required status checks provided no
real protection against the account owner's own direct pushes at
all — confirmed directly: the `containerHealth` revert commit
(`22ad998`) is currently failing 4 of its 7 required checks
(`CI Gate`, `Unit Tests`, `pre-commit`, `validate`) yet landed as
`HEAD` on `main` for 6 days. This is precisely the incident this
document's own "Purpose" section says branch protection exists to
prevent. `enforce_admins: true` is required for required-status-checks
to mean anything for a solo-maintainer repo, since the maintainer *is*
the admin and the only person who ever pushes.

Deliberately **not** enabled: "require a pull request before merging" (this
would still allow a self-merge with no meaningful review step given a single
contributor, while adding friction for hotfixes) and any required-approving-
review count (see "A note on team size" above). Direct pushes to `main` are
still technically possible for the maintainer via `git push`, but — with
`enforce_admins: true` — are now actually gated by required status checks,
not merely intended to be. **This account's other repos
(`acp-landing`, `Arrakis-Control-Panel`, `dune-awakening-selfhost-docker`)
independently confirmed to share this repo's exact pre-correction
`enforce_admins: false` misconfiguration as of 2026-08-16 — each has its
own tracking issue for the same fix, filed the same session this
correction was made, rather than assuming this repo was uniquely
affected.**

## Required Checks

Use the exact check names shown in the GitHub PR checks panel.

This repository runs two parallel CI setups: `.github/workflows/ci.yml` (a
monolithic workflow with its own working `CI Gate` aggregation job — job
IDs `shellcheck`, `validate-json`, `npm-audit`, `security` all live in the
*same* workflow file, so its `needs:` list resolves correctly) and a set of
split single-purpose workflows (`validate.yml`, `pre-commit.yml`,
`sast.yml`, `secret-scan.yml`, `filesystem-scan.yml`,
`security-gates.yml`) that duplicate much of the same scanning. A prior,
separate `.github/workflows/ci-gate.yml` attempted to aggregate the split
workflows into a second "CI Gate"-named job, but its `needs:` list
referenced job IDs (`validate`, `pre-commit`, `semgrep`, `gitleaks`,
`trivy`) defined in those *other* workflow files — GitHub Actions `needs:`
can only reference jobs within the same workflow file, so that job failed
its own startup validation on every single run and was removed rather than
fixed, since `ci.yml`'s own `CI Gate` already provides a working
aggregation for its four jobs. Required check set, current as of this
writing — verify against the live PR checks panel before applying, since
new checks may be added over time:

```text
CI Gate
validate
pre-commit
semgrep
gitleaks
trivy
```

`CI Gate` (from `ci.yml`) already covers Shell Lint, Validate JSON, NPM
Audit, and Security Scanning (gitleaks + semgrep + trivy) as its own
prerequisite jobs — only the five checks from the split workflows need to
be listed separately, since they have no aggregating gate of their own.

## Bypass Policy

Bypass should not be used for normal work.

Emergency bypass requires a tracked risk acceptance that includes:

- reason for bypass;
- impacted PR or release;
- failed or unavailable check;
- compensating control;
- follow-up remediation;
- approver.

## Merge Policy

A PR may merge only after:

- required checks are complete and passing;
- the PR body is populated;
- tracked PR documentation exists when required;
- review conversations are resolved;
- risks are documented;
- rollback is documented.
