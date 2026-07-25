# Upstream PR Tracker

Status of pull requests submitted to upstream repositories. Checked with:
```bash
bash ops-observability/dev-tools/check-upstream-prs.sh
```

**Note (2026-07-25):** this file's automated append logic
(`scripts/create-upstream-addon-pr.sh`'s `sed -i "/^| PR | Title | Status/i ..."`)
inserts a new row before the *first* matching header line it finds in the
whole file, regardless of which section that header belongs to — so a
single script run can (and did, for PR #17 below) insert the same row
under multiple unrelated section headers simultaneously, and duplicate an
existing header/separator pair. That produced a genuinely broken table
structure the last time this script ran, cleaned up by hand here. The
underlying `sed` logic itself has not been fixed yet — treat any future
automated append to this file as needing a manual sanity check before
trusting it.

## Core (Red-Blink/dune-awakening-selfhost-docker)

| PR | Title | Status | Merged | Upstream Release |
|---|---|---|---|---|
| [#68](https://github.com/Red-Blink/dune-awakening-selfhost-docker/pull/68) | ops.activity/resource/combat bridges + death poller | Open | — | — |
| [#61](https://github.com/Red-Blink/dune-awakening-selfhost-docker/pull/61) | Bridge rate limiter + IP allowlisting + CI workflow | Merged | 2026-07-05 | v1.3.45 |
| [#49](https://github.com/Red-Blink/dune-awakening-selfhost-docker/pull/49) | Addon ops health bridge actions | Merged | — | v1.3.x |
| [#45](https://github.com/Red-Blink/dune-awakening-selfhost-docker/pull/45) | R1 Metrics Stack MVP | Merged | — | v1.3.x |
| [#35](https://github.com/Red-Blink/dune-awakening-selfhost-docker/pull/35) | Generated command auth token | Merged | 2026-07-06 | — |
| [#37](https://github.com/Red-Blink/dune-awakening-selfhost-docker/pull/37) | Console update release source | Merged | 2026-07-06 | — |

## Catalog (Red-Blink/dune-docker-addons)

| PR | Title | Status | Merged | Notes |
|---|---|---|---|---|
| [#17](https://github.com/Red-Blink/dune-docker-addons/pull/17) | Dune Ops Observability 0.4.7 catalog entry | Open | — | Real per-size Potential Spice + release-gate script fixes; catalog was stale at 0.4.1 before this PR |
| [#10](https://github.com/Red-Blink/dune-docker-addons/pull/10) | v0.4.0 catalog entry | Open | — | — |
| [#7](https://github.com/Red-Blink/dune-docker-addons/pull/7) | Dune Ops Observability v0.3.0 SHA + catalog validation | Open | — | Leadership-board-demo version reverted to 1.0.0 |
| [#5](https://github.com/Red-Blink/dune-docker-addons/pull/5) | Update Dune Ops Observability to v0.3.0 | Closed | — | Replaced by #7 — had wrong SHA + wrong leadership-board-demo version |

## Process

1. After submitting an upstream PR, add it to this tracker with status OPEN.
2. Run `bash ops-observability/dev-tools/check-upstream-prs.sh` before staging new PRs.
3. When a PR merges, update its status to MERGED and record the upstream release tag.
4. If upstream cuts a release that includes our changes:
   - Update the tracker with the release tag
   - Update `README.md` compatibility line: "Upstream Dune Docker Console: compatible with `v1.X.Y`"
   - Sync the core fork (`main` → reset to upstream, rebase feature branches)
5. If a PR is closed without merging, record the reason and close it in this tracker.
