#!/usr/bin/env bash
set -u

ENV_FILE="${1:-.env.production}"
OUTPUT_FILE="${2:-/var/log/rogainizer-report.txt}"
COMPOSE_FILE="docker-compose.prod.yml"

{
  echo "Rogainizer First Boot Report"
  echo "Generated: $(date -u '+%Y-%m-%dT%H:%M:%SZ')"
  echo "Host: $(hostname)"
  echo "Kernel: $(uname -sr)"
  echo

  if command -v docker >/dev/null 2>&1; then
    echo "Docker: $(docker --version 2>/dev/null || echo unavailable)"
    echo "Compose: $(docker compose version 2>/dev/null || echo unavailable)"
  else
    echo "Docker: unavailable"
  fi

  if [[ -f "$ENV_FILE" ]]; then
    set -a
    source "$ENV_FILE"
    set +a
    echo "Domain: ${DOMAIN:-missing}"
  else
    echo "Domain: unavailable (missing env file $ENV_FILE)"
  fi

  echo
  echo "Container Status"
  if command -v docker >/dev/null 2>&1; then
    docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" ps 2>&1 || true
  else
    echo "docker compose unavailable"
  fi

  echo
  echo "Health Check"
  if [[ -x ./deploy/postdeploy-check.sh ]]; then
    ./deploy/postdeploy-check.sh "$ENV_FILE" 2>&1 || true
  else
    echo "postdeploy-check.sh missing or not executable"
  fi
} > "$OUTPUT_FILE"

echo "Report written to $OUTPUT_FILE"
