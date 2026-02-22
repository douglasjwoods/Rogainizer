#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="${ROOT_DIR}/.env.production"
BACKUP_DIR="${ROOT_DIR}/deploy/backups"
RETENTION_DAYS="${RETENTION_DAYS:-14}"

if [[ ! -f "${ENV_FILE}" ]]; then
  echo "Missing ${ENV_FILE}."
  exit 1
fi

mkdir -p "${BACKUP_DIR}"

set -a
source "${ENV_FILE}"
set +a

if [[ -z "${DB_NAME:-}" || -z "${DB_USER:-}" || -z "${DB_PASSWORD:-}" ]]; then
  echo "DB_NAME, DB_USER, and DB_PASSWORD must be set in ${ENV_FILE}."
  exit 1
fi

timestamp="$(date +%Y%m%d-%H%M%S)"
backup_file="${BACKUP_DIR}/${DB_NAME}-${timestamp}.sql.gz"

docker compose --env-file "${ENV_FILE}" -f "${ROOT_DIR}/docker-compose.prod.yml" \
  exec -T db sh -lc "exec mysqldump -u\"${DB_USER}\" -p\"${DB_PASSWORD}\" --databases \"${DB_NAME}\" --single-transaction --quick --lock-tables=false" \
  | gzip > "${backup_file}"

find "${BACKUP_DIR}" -type f -name "${DB_NAME}-*.sql.gz" -mtime +"${RETENTION_DAYS}" -delete

echo "Backup written: ${backup_file}"
