# Deployment Scripts

These scripts manage clean Dune: Awakening self-hosted Docker deployments for testing the Dune Ops Observability addon.

## Scripts

- **deploy-lib.sh** - Shared library functions for deployment operations
- **deploy-clean.sh** - Deploy web UI only (minimal stack for quick UI testing)
- **deploy-clean-stack.sh** - Deploy full stack (orchestrator + game servers + web UI)

## Features

- **Volume isolation** - Prevents conflicts with other deployments using project-specific Docker volumes
- **Secrets preservation** - Optionally preserves secrets from RBAC stack for convenience
- **Mount validation** - Ensures containers read from the correct directory (prevents wrong password issues)
- **Post-deployment health checks** - Validates deployment success
- **Feature branch testing** - Deploy any branch for isolated testing

## Usage

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

## Requirements

- Docker and Docker Compose
- Access to upstream Dune: Awakening repository (`dune-awakening-selfhost-docker`)
- Node.js (for web UI builds)
- Workspace structure with `e2e-clean/` and `e2e-integration/` directories

## How It Works

1. **Clones upstream** to `e2e-clean/` directory
2. **Applies feature branch** changes on top
3. **Configures environment** with isolated project name and volumes
4. **Preserves secrets** from RBAC stack (unless `--clean-secrets` is used)
5. **Validates mounts** to ensure container reads from correct directory
6. **Runs health checks** to verify deployment success

## Directory Structure

<!-- BUG FIX (2026-07-25): this used to describe a workspace layout
     rooted at ~/dune-docker-addon (a 15GB redundant scratch directory
     deleted during a home-directory cleanup audit). deploy-lib.sh's
     ADDON now defaults to $HOME instead, but the e2e-clean/ and
     e2e-integration/ directories below have not been re-created since
     -- this workflow needs that workspace rebuilt under $HOME (or
     ADDON pointed at wherever you rebuild it) before it can run
     end-to-end again. -->

Scripts expect this workspace layout (rooted at `$ADDON`, defaulting to `$HOME`):
```
$ADDON/                      # defaults to $HOME
├── dune-ops-observability-addon/  # This repository
│   └── scripts/deploy/      # These scripts
├── e2e-clean/               # Clean deployment workspace (created by scripts) -- NOT currently present, needs recreating
├── e2e-integration/         # RBAC stack (production-like environment) -- NOT currently present, needs recreating
└── dune-awakening-selfhost-docker/  # Upstream fork (already exists at $HOME/dune-awakening-selfhost-docker)
```

## Troubleshooting

### Wrong password after deployment
- Check container logs: `docker logs redblink-dune-docker-console`
- Verify mount: `docker inspect redblink-dune-docker-console | grep -A 5 Mounts`
- Ensure `DUNE_HOST_REPO_ROOT` in `.env` matches actual deployment path

### Container won't start
- Check for volume conflicts: `docker volume ls | grep dune-test-isolated`
- Remove old volumes: `docker volume rm $(docker volume ls -q | grep dune-test-isolated)`

### Mount validation fails
- Scripts now validate that container `/repo` mount points to correct host directory
- If validation fails, deployment aborts to prevent reading wrong secrets
