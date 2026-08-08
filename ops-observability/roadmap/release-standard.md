# Dune Ops Observability Release Standard

## Purpose

This document defines the internal release standard for Dune Ops Observability. It applies to Core bridge changes, telemetry discovery tools, addon UI changes, runtime operations metrics, and evidence-generation scripts.

The standard exists to prevent unsafe telemetry exposure, unstable releases, undocumented behavior, and unverified claims.

## Release Classification

Every release must be classified before implementation.

| Classification   | Description                                                     | Default Target     |
| ---------------- | --------------------------------------------------------------- | ------------------ |
| Upstream Core    | Changes intended for `Red-Blink/dune-awakening-selfhost-docker` | Upstream PR        |
| Internal Tooling | Discovery, evidence, release automation, local validation       | Local or fork only |
| Addon Product    | Addon dashboard, UI, bridge client, operator UX                 | Addon repo/fork    |
| Runtime Ops      | Host/container/process/network/log metrics                      | Internal first     |
| Experimental     | Unknown safety or usefulness                                    | Internal only      |

## Required Release Gates

### Gate 0 — Scope Gate

Required before coding.

Must define:

* release objective
* target repository
* upstream/fork/internal classification
* in-scope files
* out-of-scope work
* data sources
* telemetry classification
* permissions required
* rollback plan
* evidence plan

Exit criteria:

* no unclear scope
* no unknown data exposure
* no raw player-data intent
* target repo is explicit
* release owner is explicit

### Gate 1 — Design Gate

Required before implementation.

Must define:

* API or bridge contract
* permission model
* response schema
* failure-mode behavior
* degraded-state behavior
* security controls
* privacy controls
* E2E plan
* standards mapping

Exit criteria:

* contract is written
* forbidden fields are listed
* test cases are identified
* degraded behavior is deterministic
* all telemetry fields are classified

### Gate 2 — Implementation Gate

Required before PR or internal release candidate.

Must pass:

* unit tests
* targeted tests
* source gate
* permission enforcement checks
* schema guard checks
* missing-table/missing-column handling
* no hardcoded endpoint scan
* privacy static scan

Exit criteria:

* branch is clean
* changed-file scope matches release scope
* tests pass locally
* no known sensitive leakage remains

### Gate 3 — Verification Gate

Required before merge or internal release approval.

Must pass, where applicable:

* local CLI E2E
* public-origin CLI E2E
* WebUI E2E
* privacy regression E2E
* failure-mode E2E
* evidence snapshot generation

Exit criteria:

* all E2E commands pass
* output reviewed
* evidence stored
* no unsupported claims are made

### Gate 4 — Release Gate

Required before declaring the release complete.

Must produce:

* release decision
* known limitations
* rollback instructions
* release notes
* evidence bundle
* next-release backlog

Exit criteria:

* no unresolved critical/high risk
* release evidence is archived
* deferred work is tracked
* upstream PR, fork PR, or internal artifact is complete

## Required Evidence Bundle

Every release must create:

```text
ops-observability/evidence/releases/<release-id>/
```

Required files:

```text
release-plan.md
scope.md
standards-mapping.md
git-state.txt
changed-files.txt
unit-test-output.txt
targeted-test-output.txt
e2e-local-output.txt
e2e-public-output.txt
webui-validation.md
privacy-scan-output.txt
failure-mode-output.txt
known-limitations.md
rollback.md
release-decision.md
```

If a file is not applicable, include the file with `Not applicable` and the reason.

### Evidence Requirements by Release Type

Not every release requires the full 16-file evidence bundle. The evidence
requirement scales with release impact:

| Release Type | Examples | Evidence Required |
|---|---|---|
| Major (N.0.0) | Breaking changes, new architecture | Full 16-file bundle |
| Minor (0.N.0) | New features, new tabs, new data sources | Full 16-file bundle |
| Patch (0.N.x) | Bug fixes, CSS tweaks, copy changes, config updates | Security scan output + CHANGELOG entry only |
| Pre-release (x.y.z-rcN) | Release candidates | Security scan output only |

Past releases 0.4.0 through 0.4.6 are grandfathered — evidence is not required
retroactively. Starting from 0.5.0, this policy is enforced for all new releases.

## Release Decision Values

| Value                     | Meaning                                                    |
| ------------------------- | ---------------------------------------------------------- |
| Approved                  | Release passed all applicable gates                        |
| Approved with limitations | Release passed but has documented non-blocking limitations |
| Blocked                   | Release failed a required gate                             |
| Abandoned                 | Release is no longer pursued                               |
| Superseded                | Release was replaced by another release                    |

## Non-Negotiable Security Rules

The following must never be exposed through addon bridge responses, dashboard UI, evidence bundles, or exported reports:

* raw player rows
* player IDs
* account IDs
* character names
* Funcom/FLS identifiers
* actor IDs
* coordinates
* exact positions
* raw serialized blobs
* SQL text
* PromQL text
* tokens
* passwords
* secrets
* raw logs by default
* unbounded high-cardinality labels

## Upstream PR Rules

Only submit upstream PRs when:

* the change is generally useful to upstream users;
* the implementation does not depend on private/internal infrastructure;
* evidence exists;
* the PR scope is narrow;
* the PR does not contain internal roadmap, private workflow, or local-only scripts unless explicitly useful to upstream.

Internal roadmap documents should not be submitted upstream unless upstream maintainers request them.

## Local/Fork Rules

Use local/fork-only work for:

* roadmap planning
* release orchestration
* experimental telemetry discovery
* evidence collection scripts
* internal dashboards
* host/runtime checks that may not be acceptable upstream
* operator-specific workflows
