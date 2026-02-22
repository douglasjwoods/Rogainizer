#!/usr/bin/env bash
set -u

ENV_FILE="${1:-.env.production}"
COMPOSE_FILE="docker-compose.prod.yml"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "FAIL env_file_missing file=$ENV_FILE"
  exit 1
fi

set -a
source "$ENV_FILE"
set +a

if [[ -z "${DOMAIN:-}" ]]; then
  echo "FAIL domain_missing in $ENV_FILE"
  exit 1
fi

failures=0

pass() {
  echo "PASS $1"
}

fail() {
  echo "FAIL $1"
  failures=$((failures + 1))
}

if getent ahosts "$DOMAIN" >/dev/null 2>&1; then
  pass "dns_resolves domain=$DOMAIN"
else
  fail "dns_resolves domain=$DOMAIN"
fi

if curl -fsS "https://$DOMAIN" -o /dev/null; then
  pass "tls_https domain=$DOMAIN"
else
  fail "tls_https domain=$DOMAIN"
fi

api_body="$(curl -fsS "https://$DOMAIN/api/health" 2>/dev/null || true)"
if [[ "$api_body" == *"ok"* ]]; then
  pass "api_health endpoint=https://$DOMAIN/api/health"
else
  fail "api_health endpoint=https://$DOMAIN/api/health"
fi

if docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" exec -T db sh -lc 'mysqladmin ping -h localhost -uroot -p"$MYSQL_ROOT_PASSWORD" --silent' >/dev/null 2>&1; then
  pass "db_connectivity service=db"
else
  fail "db_connectivity service=db"
fi

if [[ "$failures" -eq 0 ]]; then
  echo "SUMMARY PASS"
  exit 0
fi

echo "SUMMARY FAIL count=$failures"
exit 1
