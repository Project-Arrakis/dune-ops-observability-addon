#!/usr/bin/env bash
# deploy-lib.sh — Shared functions for clean stack deployment
# Source this file: . ./deploy-lib.sh

set -euo pipefail

# ─── Configuration (override via environment) ───
REPO="${REPO:-/home/darkdante/dune-awakening-selfhost-docker}"
# BUG FIX (2026-07-25): ADDON used to default to
# /home/darkdante/dune-docker-addon -- a 15GB redundant scratch
# workspace directory deleted during a home-directory cleanup audit.
# This whole deploy-clean testing workflow (e2e-clean/, e2e-integration/
# as siblings under ADDON) has not been re-created since -- defaulting
# ADDON to $HOME so this at least resolves to a real, existing directory
# instead of hard-failing, but the e2e-clean/e2e-integration workspace
# itself will need to be (re)created under $HOME before this workflow
# can actually run end-to-end again. Override ADDON explicitly if you
# want a different workspace root.
ADDON="${ADDON:-$HOME}"
CLEAN="${CLEAN:-$ADDON/e2e-clean}"
UPSTREAM="${UPSTREAM:-https://github.com/Red-Blink/dune-awakening-selfhost-docker.git}"
PROJECT_NAME="${PROJECT_NAME:-dune-clean-test}"
DB_VOLUME="${DB_VOLUME:-dune-postgres-data-clean}"
SERVER_IP="${SERVER_IP:-50.123.64.61}"
DOCKER_GID="${DOCKER_GID:-986}"
UID_HOST="${UID_HOST:-$(id -u)}"
GID_HOST="${GID_HOST:-$(id -g)}"
PRESERVE_SECRETS="${PRESERVE_SECRETS:-false}"

# ─── Logging ───
log() { echo "[$(date +%H:%M:%S)] $*"; }
error() { log "ERROR: $*" >&2; }
die() { error "$@"; exit 1; }

# ─── Cleanup on failure ───
cleanup_on_failure() {
  local exit_code=$?
  if [ $exit_code -ne 0 ]; then
    error "Deployment failed (exit $exit_code)"
    error "Clean stack may be in inconsistent state"
    error "Run: docker rm -f \$(docker ps -aq --filter name=dune) 2>/dev/null || true"
  fi
}
trap cleanup_on_failure EXIT

# ─── Safety checks ───
require_branch() {
  local branch="${1:-}"
  [ -z "$branch" ] && die "Usage: $0 <fix-branch>"
  echo "$branch"
}

check_repo_exists() {
  [ -d "$REPO" ] || die "Repo not found: $REPO"
  [ -d "$ADDON" ] || die "Addon not found: $ADDON"
}

# ─── Docker operations ───
stop_all_dune_containers() {
  log "Stopping all dune containers..."
  docker ps -aq --filter "name=dune" | xargs -r docker rm -f 2>/dev/null || true
  sleep 2
}

stop_clean_stack() {
  log "Stopping clean stack..."
  COMPOSE_PROJECT_NAME="$PROJECT_NAME" docker compose -f "$CLEAN/docker-compose.web.yml" down 2>/dev/null || true
  COMPOSE_PROJECT_NAME="$PROJECT_NAME" docker compose -f "$CLEAN/docker-compose.yml" down 2>/dev/null || true
  docker ps -q --filter "name=dune" | xargs -r docker stop 2>/dev/null || true
  sleep 2
}

# ─── Clone and apply ───
fresh_clone() {
  log "Fresh clone from upstream..."
  [ -d "$CLEAN" ] && sudo rm -rf "$CLEAN"
  git clone "$UPSTREAM" "$CLEAN" --quiet
  sudo chown -R "$USER:$USER" "$CLEAN"
}

apply_fix_branch_files() {
  local branch="$1"
  log "Applying all files from fix branch: $branch"

  cd "$REPO"
  git fetch origin "$branch" --quiet 2>/dev/null || die "Cannot fetch $branch from origin"

  local files
  files=$(git diff --name-only upstream/main "origin/$branch" 2>/dev/null)

  # If no differences, this is a clean upstream deployment - skip apply step
  if [ -z "$files" ]; then
    log "  No differences from upstream/main - deploying clean upstream"
    return 0
  fi

  echo "$files" | while read -r file; do
    if git show "origin/$branch:$file" > "$CLEAN/$file" 2>/dev/null; then
      mkdir -p "$(dirname "$CLEAN/$file")"
      log "  Applied: $file"
    else
      log "  Skipped (not in branch): $file"
    fi
  done
}

apply_single_file() {
  local branch="$1"
  local file="$2"
  log "Applying single file from fix branch: $branch:$file"

  cd "$REPO"
  git fetch origin "$branch" --quiet 2>/dev/null || die "Cannot fetch $branch from origin"

  mkdir -p "$(dirname "$CLEAN/$file")"
  git show "origin/$branch:$file" > "$CLEAN/$file" 2>/dev/null || die "Cannot extract $file from $branch"
  log "  Applied: $file"
}

# ─── Configuration ───
configure_env() {
  log "Configuring .env..."

  if [ -f "$ADDON/e2e-integration/.env" ]; then
    cp "$ADDON/e2e-integration/.env" "$CLEAN/.env"
    sed -i "s|DUNE_HOST_REPO_ROOT=.*|DUNE_HOST_REPO_ROOT=${CLEAN}|" "$CLEAN/.env"
    sed -i '/^COMPOSE_PROJECT_NAME=/d' "$CLEAN/.env"
    log "  Copied from RBAC stack, paths updated"
  else
    cat > "$CLEAN/.env" << EOF
SERVER_IP=$SERVER_IP
SERVER_IP_MODE=public
DOCKER_SOCKET_GID=$DOCKER_GID
DUNE_HOST_UID=$UID_HOST
DUNE_HOST_GID=$GID_HOST
DUNE_HOST_REPO_ROOT=$CLEAN
EOF
    log "  Created minimal .env"
  fi
}

isolate_db_volume() {
  log "Isolating DB volume: $DB_VOLUME"

  for script in start-postgres.sh init.sh; do
    local path="$CLEAN/runtime/scripts/$script"
    [ -f "$path" ] && sed -i "s/dune-postgres-data\([^-]\)/dune-postgres-data-clean\1/g" "$path"
  done

  # Add docker group to compose only if not already present
  if ! grep -q "group_add:" "$CLEAN/docker-compose.yml"; then
    sed -i '/network_mode: host/a\    group_add:\n      - "'"$DOCKER_GID"'"' "$CLEAN/docker-compose.yml"
    log "  group_add: $DOCKER_GID"
  else
    log "  group_add already configured"
  fi
}

# ─── Build ───
build_web_ui() {
  log "Building web UI..."
  cd "$CLEAN/console/web"
  npm install --silent 2>&1 | tail -1
  npm run build 2>&1 | tail -3
}

# ─── Permissions ───
fix_permissions() {
  log "Fixing permissions..."
  sudo chown -R "$USER:$USER" "$CLEAN"

  # Handle secrets and generated directories based on PRESERVE_SECRETS flag
  if [ "$PRESERVE_SECRETS" = "true" ]; then
    if [ -d "$ADDON/e2e-integration/runtime/secrets" ]; then
      log "  Copying secrets from RBAC stack..."
      rm -rf "$CLEAN/runtime/secrets"
      cp -r "$ADDON/e2e-integration/runtime/secrets" "$CLEAN/runtime/secrets"
    else
      log "  Creating empty secrets directory..."
      rm -rf "$CLEAN/runtime/secrets"
      mkdir -p "$CLEAN/runtime/secrets"
    fi

    if [ -d "$ADDON/e2e-integration/runtime/generated" ]; then
      log "  Copying generated state from RBAC stack..."
      rm -rf "$CLEAN/runtime/generated"
      cp -r "$ADDON/e2e-integration/runtime/generated" "$CLEAN/runtime/generated"
    else
      log "  Creating empty generated directory..."
      rm -rf "$CLEAN/runtime/generated"
      mkdir -p "$CLEAN/runtime/generated"
    fi
  else
    log "  Creating fresh secrets and generated directories (--clean-secrets)..."
    rm -rf "$CLEAN/runtime/secrets" "$CLEAN/runtime/generated"
    mkdir -p "$CLEAN/runtime/secrets" "$CLEAN/runtime/generated"
  fi

  sudo chown -R "$USER:$USER" "$CLEAN/runtime/secrets" "$CLEAN/runtime/generated"
}

# ─── Start services ───
start_full_stack() {
  log "Starting full stack..."
  cd "$CLEAN"

  DUNE_HOST_REPO_ROOT="$CLEAN" \
  COMPOSE_PROJECT_NAME="$PROJECT_NAME" \
  docker compose -f docker-compose.yml up -d orchestrator 2>&1 | tail -1
  log "Waiting for orchestrator..."
  sleep 10

  bash runtime/scripts/start-all.sh 2>&1 | head -5 &
  log "Waiting for game servers..."
  sleep 25

  start_web_console
}

start_web_console() {
  log "Starting web console..."
  cd "$CLEAN"

  # Ensure old container is fully removed before recreating
  docker rm -f redblink-dune-docker-console 2>/dev/null || true
  sleep 2

  DUNE_HOST_UID=$UID_HOST \
  DUNE_HOST_GID=$GID_HOST \
  DUNE_HOST_REPO_ROOT="$CLEAN" \
  COMPOSE_PROJECT_NAME="$PROJECT_NAME" \
  docker compose -f docker-compose.web.yml up -d redblink-dune-docker-console 2>&1 | tail -1

  sleep 3

  # Validate mount is correct
  validate_mount_source

  docker cp console/web/dist/. redblink-dune-docker-console:/app/web-dist/ 2>/dev/null || true
  docker restart redblink-dune-docker-console 2>/dev/null || true
  sleep 5
}

# ─── Validation ───
validate_mount_source() {
  local actual_mount
  actual_mount=$(docker inspect redblink-dune-docker-console --format '{{range .Mounts}}{{if eq .Destination "/repo"}}{{.Source}}{{end}}{{end}}' 2>/dev/null)

  if [ "$actual_mount" = "$CLEAN" ]; then
    log "  Mount source correct: $actual_mount"
    return 0
  else
    error "  Mount source MISMATCH!"
    error "    Expected: $CLEAN"
    error "    Actual:   $actual_mount"
    error "  Container will read secrets from wrong directory!"
    return 1
  fi
}

wait_for_health() {
  local url="${1:-http://localhost:8088/api/health}"
  local timeout="${2:-30}"
  local elapsed=0

  log "Waiting for health check: $url"
  while [ $elapsed -lt $timeout ]; do
    if curl -s --max-time 2 "$url" 2>/dev/null | grep -q '"ok":true'; then
      log "  Health check passed"
      return 0
    fi
    sleep 2
    elapsed=$((elapsed + 2))
  done

  error "Health check timeout after ${timeout}s"
  return 1
}

validate_uid_match() {
  local container_uid
  container_uid=$(docker exec redblink-dune-docker-console id -u 2>/dev/null || echo "?")

  if [ "$container_uid" = "$UID_HOST" ]; then
    log "  UID match: $container_uid = $UID_HOST ✓"
    return 0
  else
    error "  UID mismatch: container=$container_uid host=$UID_HOST"
    return 1
  fi
}

validate_ownership() {
  docker exec redblink-dune-docker-console touch /repo/runtime/secrets/.test 2>/dev/null || return 1
  local owner
  owner=$(stat -c '%U:%G' "$CLEAN/runtime/secrets/.test" 2>/dev/null || echo "?")
  docker exec redblink-dune-docker-console rm /repo/runtime/secrets/.test 2>/dev/null || true

  if [ "$owner" = "$USER:$USER" ]; then
    log "  Ownership: $owner ✓"
    return 0
  else
    error "  Ownership mismatch: $owner (expected $USER:$USER)"
    return 1
  fi
}

validate_secrets_match() {
  local host_pass container_pass
  host_pass=$(cat "$CLEAN/runtime/secrets/admin-web-password.txt" 2>/dev/null || echo "")
  container_pass=$(docker exec redblink-dune-docker-console cat /repo/runtime/secrets/admin-web-password.txt 2>/dev/null || echo "")

  if [ -z "$host_pass" ] || [ -z "$container_pass" ]; then
    log "  Secrets validation skipped (password file not found)"
    return 0
  fi

  if [ "$host_pass" = "$container_pass" ]; then
    log "  Secrets match ✓"
    return 0
  else
    error "  Secrets MISMATCH!"
    error "  Container is reading from wrong directory!"
    return 1
  fi
}

get_admin_password() {
  docker exec redblink-dune-docker-console cat runtime/secrets/admin-web-password.txt 2>/dev/null || echo "check console"
}

# ─── Post-deploy testing ───
run_post_deploy_tests() {
  local mode="$1"
  local skip_tests="${2:-false}"

  if [ "$skip_tests" = "true" ]; then
    log "Skipping post-deploy tests (--skip-tests)"
    return 0
  fi

  log "=== Running post-deploy tests ==="
  cd "$CLEAN"

  local test_failed=0

  # Core CLI tests (always run if script exists)
  if [ -x tests/dune-cli-test.sh ]; then
    log "Running dune-cli-test.sh..."
    if bash tests/dune-cli-test.sh 2>&1 | tee /tmp/dune-cli-test.log | tail -20; then
      log "  ✓ CLI tests passed"
    else
      error "  ✗ CLI tests failed"
      test_failed=1
    fi
  else
    log "  Skipping dune-cli-test.sh (not found)"
  fi

  # Bridge tests (only if addon installed)
  if [ -x tests/bridge-smoke-test.sh ]; then
    log "Running bridge-smoke-test.sh..."
    if bash tests/bridge-smoke-test.sh 2>&1 | tee -a /tmp/dune-cli-test.log | tail -10; then
      log "  ✓ Bridge tests passed"
    else
      local exit_code=$?
      if [ $exit_code -eq 2 ]; then
        log "  - Bridge tests skipped (addon not installed)"
      else
        error "  ✗ Bridge tests failed"
        test_failed=1
      fi
    fi
  else
    log "  Skipping bridge-smoke-test.sh (not found)"
  fi

  # API security tests
  if [ -x tests/api-security-test.sh ]; then
    log "Running api-security-test.sh..."
    if bash tests/api-security-test.sh 2>&1 | tee -a /tmp/dune-cli-test.log | tail -10; then
      log "  ✓ API security tests passed"
    else
      error "  ✗ API security tests failed"
      test_failed=1
    fi
  else
    log "  Skipping api-security-test.sh (not found)"
  fi

  # Mode-specific tests
  if [ "$mode" = "FULL STACK" ]; then
    # Container lifecycle tests (only for full stack)
    if [ -x tests/container-lifecycle-test.sh ]; then
      log "Running container-lifecycle-test.sh..."
      if bash tests/container-lifecycle-test.sh 2>&1 | tee -a /tmp/dune-cli-test.log | tail -10; then
        log "  ✓ Container lifecycle tests passed"
      else
        error "  ✗ Container lifecycle tests failed"
        test_failed=1
      fi
    fi
  fi

  if [ $test_failed -eq 0 ]; then
    log "=== All post-deploy tests passed ==="
    return 0
  else
    error "=== Some post-deploy tests failed ==="
    error "See /tmp/dune-cli-test.log for details"
    return 1
  fi
}

# ─── Output ───
print_summary() {
  local mode="$1"
  local branch="$2"

  echo ""
  echo "============================================="
  echo "  CLEAN STACK DEPLOYED ($mode)"
  echo "============================================="
  echo "  URL:       http://$SERVER_IP:8088"
  echo "  Password:  (check runtime/secrets/admin-web-password.txt)"
  echo "  Branch:    $branch"
  echo "  Project:   $PROJECT_NAME"
  echo "  DB volume: $DB_VOLUME"
  echo ""
  echo "  TO SWITCH BACK TO RBAC:"
  echo "  cd e2e-integration && docker compose up -d"
  echo "============================================="
}
