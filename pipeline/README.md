# ACP Pipeline Tools

Located in `yacketrj/dune-docker-addon` repo (GitHub-backed). Symlinked to `~/.local/bin/`.

## Tools

| Script | Purpose | When |
|--------|---------|------|
| `pre-push-gates` | Security + build + artifact checks | Every `git push` |
| `pre-pr-check.sh` | Full pre-PR validation | Before upstream PR push |
| `merge-safety.sh` | JS/TSX syntax check | After `git merge upstream/main` |
| `artifact-guard.sh` | Blocks generated files | Called by pre-push-gates |
| `deploy-clean.sh` | Deploy clean upstream + fix | Testing on e2e-clean |
| `restore-stack.sh` | Restore previous stack | After clean testing |

## Pre-PR Checklist

Before submitting ANY upstream PR:

1. [ ] `pre-pr-check.sh` passes — all 6 checks green
2. [ ] Deploy to e2e-clean: `deploy-clean.sh <fix-branch>`
3. [ ] Test in-game (if applicable)
4. [ ] Verify web UI loads: `curl http://localhost:8088/api/health`
5. [ ] No generated artifacts in git diff
6. [ ] CI green on yacketrj fork before pushing to upstream

## After Merging upstream/main

```
merge-safety.sh
```
Catches corrupted JSX/TSX from conflict resolution. If it fails:
```
git checkout upstream/main -- <broken-file>
# Manually re-apply your changes
```

## Install on New Machine

<!-- BUG FIX (2026-07-25): this used to reference cloning a
     yacketrj/dune-docker-addon repo -- that repo never actually
     existed on GitHub; this was always describing an incorrect setup.
     The real repo is dune-ops-observability-addon (see Repo Location
     below); corrected the clone/symlink commands to match. -->
```bash
git clone git@github.com:yacketrj/dune-ops-observability-addon.git ~/dune-ops-observability-addon
ln -sf ~/dune-ops-observability-addon/pipeline/pre-push-gates ~/.local/bin/pre-push-gates
ln -sf ~/dune-ops-observability-addon/pipeline/pre-pr-check.sh ~/.local/bin/pre-pr-check.sh
ln -sf ~/dune-ops-observability-addon/pipeline/deploy-clean.sh ~/.local/bin/deploy-clean.sh
ln -sf ~/dune-ops-observability-addon/pipeline/restore-stack.sh ~/.local/bin/restore-stack.sh
ln -sf ~/dune-ops-observability-addon/pipeline/merge-safety.sh ~/.local/bin/merge-safety.sh
```

## Repo Location
`yacketrj/dune-ops-observability-addon` — `pipeline/` directory

## Current State (2026-07-12)
- PR #77 closed — RabbitMQ quality limitation documented
- All 5 upstream PRs (#75, #76, #71, #13, #77) resolved
- Pipeline tools deployed to `~/.local/bin/`
- e2e-clean stack available for testing
