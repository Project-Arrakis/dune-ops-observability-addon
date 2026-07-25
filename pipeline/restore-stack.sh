#!/usr/bin/env bash
# restore-stack.sh — Restore a backed-up stack.
# Usage: sudo ./restore-stack.sh <backup-dir>
set -euo pipefail

BACKUP="${1:-}"; [ -z "$BACKUP" ] && { echo "Usage: $0 <backup-dir>"; exit 1; }
[ ! -d "$BACKUP" ] && { echo "Backup not found: $BACKUP"; exit 1; }

# BUG FIX (2026-07-25): this used to point at
# /home/darkdante/dune-docker-addon/e2e-integration -- a test-integration
# clone inside a 15GB redundant scratch directory that was deleted during
# a home-directory cleanup audit. The Docker volume names referenced
# below (dune-awakening-selfhost-docker_dune-*) already made clear this
# script's real target was always the actual production stack, not a
# disposable e2e clone -- pointing INT at the real deployment path.
INT="/home/darkdante/dune-awakening-selfhost-docker"

echo "=== RESTORE: $BACKUP ==="

echo "=== 1. Stop ==="
sudo docker compose -f "$INT/docker-compose.web.yml" down 2>/dev/null || true
sudo docker compose -f "$INT/docker-compose.metrics.yml" down 2>/dev/null || true
sudo docker compose -f "$INT/docker-compose.bot.yml" down 2>/dev/null || true
docker ps -q --filter "name=dune" | xargs -r docker stop 2>/dev/null || true
sleep 3

echo "=== 2. Restore volumes ==="
for vol in dune-postgres-data dune-awakening-selfhost-docker_dune-server dune-awakening-selfhost-docker_dune-steam dune-awakening-selfhost-docker_dune-cache dune-awakening-selfhost-docker_dune-generated; do
    SRC="$BACKUP/volumes/$vol"
    DST="/var/lib/docker/volumes/${vol}/_data"
    if [ -d "$SRC" ]; then
        docker volume rm "$vol" 2>/dev/null || true
        docker volume create "$vol" 2>/dev/null
        sudo rsync -a "$SRC/" "$DST/" 2>/dev/null
        echo "  $vol restored"
    fi
done

echo "=== 3. Restore runtime ==="
for dir in runtime generated backups secrets logs work container defaults addons; do
    if [ -d "$BACKUP/runtime/$dir" ]; then
        sudo rm -rf "$INT/$dir" 2>/dev/null
        sudo rsync -a "$BACKUP/runtime/$dir/" "$INT/$dir/" 2>/dev/null
        echo "  $dir restored"
    fi
done
[ -f "$BACKUP/runtime/.env" ] && sudo cp "$BACKUP/runtime/.env" "$INT/.env" && echo "  .env restored"
[ -f "$BACKUP/runtime/VERSION" ] && sudo cp "$BACKUP/runtime/VERSION" "$INT/VERSION"

echo "=== 4. Start stack ==="
sudo docker compose -f "$INT/docker-compose.yml" up -d orchestrator 2>/dev/null
sleep 10
sudo bash "$INT/runtime/scripts/start-all.sh" 2>/dev/null &
sleep 25
sudo docker compose -f "$INT/docker-compose.web.yml" up -d --force-recreate redblink-dune-docker-console 2>/dev/null
sleep 5

echo "=== RESTORE COMPLETE ==="
curl -s --max-time 3 http://localhost:8088/api/health
