#!/usr/bin/env bash
set -euo pipefail

ENV_FILE=".env.production"
OUT_DIR="deploy/support"
INCLUDE_LOGS=1
TAIL_LINES=500

usage() {
  echo "Usage: $0 [env-file] [output-dir] [--no-logs] [--tail <n>]"
}

POSITIONAL=()
while [[ $# -gt 0 ]]; do
  case "$1" in
    --no-logs)
      INCLUDE_LOGS=0
      shift
      ;;
    --tail)
      if [[ $# -lt 2 ]]; then
        usage
        exit 1
      fi
      if ! [[ "$2" =~ ^[0-9]+$ ]]; then
        echo "Invalid --tail value: $2"
        usage
        exit 1
      fi
      TAIL_LINES="$2"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    --*)
      echo "Unknown option: $1"
      usage
      exit 1
      ;;
    *)
      POSITIONAL+=("$1")
      shift
      ;;
  esac
done

if [[ ${#POSITIONAL[@]} -gt 2 ]]; then
  usage
  exit 1
fi

if [[ ${#POSITIONAL[@]} -ge 1 ]]; then
  ENV_FILE="${POSITIONAL[0]}"
fi

if [[ ${#POSITIONAL[@]} -ge 2 ]]; then
  OUT_DIR="${POSITIONAL[1]}"
fi

STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
BUNDLE_DIR="$OUT_DIR/rogainizer-support-$STAMP"
COMPOSE_FILE="docker-compose.prod.yml"

mkdir -p "$BUNDLE_DIR"

if [[ -f "$ENV_FILE" ]]; then
  sed -E 's/^(MYSQL_ROOT_PASSWORD|DB_PASSWORD)=.*/\1=REDACTED/' "$ENV_FILE" > "$BUNDLE_DIR/env.redacted"
fi

cp -f "$COMPOSE_FILE" "$BUNDLE_DIR/docker-compose.prod.yml" 2>/dev/null || true
cp -f deploy/Caddyfile "$BUNDLE_DIR/Caddyfile" 2>/dev/null || true
cp -f /var/log/rogainizer-report.txt "$BUNDLE_DIR/rogainizer-report.txt" 2>/dev/null || true
cp -f /var/log/rogainizer-autodeploy.log "$BUNDLE_DIR/rogainizer-autodeploy.log" 2>/dev/null || true

docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" ps > "$BUNDLE_DIR/compose-ps.txt" 2>&1 || true
if [[ "$INCLUDE_LOGS" -eq 1 ]]; then
  docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" logs --no-color --tail="$TAIL_LINES" proxy > "$BUNDLE_DIR/logs-proxy.txt" 2>&1 || true
  docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" logs --no-color --tail="$TAIL_LINES" api > "$BUNDLE_DIR/logs-api.txt" 2>&1 || true
  docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" logs --no-color --tail="$TAIL_LINES" db > "$BUNDLE_DIR/logs-db.txt" 2>&1 || true
  docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" logs --no-color --tail="$TAIL_LINES" web > "$BUNDLE_DIR/logs-web.txt" 2>&1 || true
else
  echo "Skipped service logs (--no-logs), tail would have been $TAIL_LINES" > "$BUNDLE_DIR/logs-skipped.txt"
fi

{
  echo "Generated: $(date -u '+%Y-%m-%dT%H:%M:%SZ')"
  echo "Host: $(hostname)"
  echo "Kernel: $(uname -sr)"
  echo "Docker: $(docker --version 2>/dev/null || echo unavailable)"
  echo "Compose: $(docker compose version 2>/dev/null || echo unavailable)"
} > "$BUNDLE_DIR/system.txt"

if [[ -x deploy/postdeploy-check.sh ]]; then
  deploy/postdeploy-check.sh "$ENV_FILE" > "$BUNDLE_DIR/postdeploy-check.txt" 2>&1 || true
fi

TARBALL="$OUT_DIR/rogainizer-support-$STAMP.tar.gz"
tar -czf "$TARBALL" -C "$OUT_DIR" "$(basename "$BUNDLE_DIR")"

echo "Support bundle created: $TARBALL"
