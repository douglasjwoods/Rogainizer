# Rogainizer Infrastructure

Basic full-stack setup with:

- Vue 3 + Vite frontend (`frontend`)
- Node.js + Express API (`backend`)
- MySQL database connection via `mysql2`

## Prerequisites

- Node.js 20+
- npm 10+
- MySQL 8+
- Docker Desktop (for containerized setup)

## 1) Configure database

Create schema/table in MySQL:

```sql
SOURCE backend/sql/init.sql;
```

## 2) Configure backend env

Copy `backend/.env.example` to `backend/.env` and set values.

## 3) Install dependencies

From repo root:

```bash
npm install
npm install --prefix backend
```

The frontend dependencies are already installed by Vite scaffolding. If needed:

```bash
npm install --prefix frontend
```

## 4) Run app

From repo root:

```bash
npm run dev
```

- API: http://localhost:3000
- Frontend: http://localhost:5173

## Run with Docker Compose

From repo root:

```bash
docker compose up --build
```

This starts:

- `db` (MySQL 8.4) on port `3306`
- `api` (Express) on port `3000`
- `web` (Vite + Vue) on port `5173`

The MySQL schema and `events` table are initialized automatically from `backend/sql/init.sql`.

Stop and remove containers:

```bash
docker compose down
```

Stop and remove containers + DB volume:

```bash
docker compose down -v
```

View logs:

```bash
docker compose logs -f
```

## Production deploy (single VPS, low-cost)

This repository includes production deployment artifacts for a single VPS:

- `docker-compose.prod.yml`
- `deploy/Caddyfile`
- `frontend/Dockerfile.prod`
- `.env.production.example`

### 0) Create the DigitalOcean VPS (Droplet)

1. In DigitalOcean, create a new Droplet:
	- Region: closest to your users
	- Image: Ubuntu 22.04 LTS or newer
	- Size: Basic shared CPU (start with 1 vCPU / 1 GB for low volume)
2. Add SSH key authentication (recommended) and disable password login if possible.
3. In **Advanced Options**:
	- Paste one of the provided cloud-init files into User Data, or leave blank for manual setup.
4. Create the droplet and note the public IPv4 address.
5. Point your domain DNS `A` record to that IPv4.
6. Wait for DNS to propagate before expecting TLS certificate issuance.

If you used cloud-init, initial provisioning starts automatically on first boot.
If you did not use cloud-init, install Docker + Compose plugin manually before continuing.

### 1) Prepare server

- Ubuntu 22.04+ VPS with Docker + Compose plugin installed
- DNS `A` record for your domain pointing to the VPS IP
- Open ports `80` and `443` in firewall/security group

DigitalOcean cloud-init options are included:

- `deploy/digitalocean-cloud-init.yaml` (bootstrap only)
- `deploy/digitalocean-cloud-init-autodeploy.yaml` (bootstrap + clone + deploy)
- `deploy/digitalocean-cloud-init-autodeploy-private.yaml` (bootstrap + private repo clone + deploy)
- `deploy/digitalocean-cloud-init-autodeploy-metadata.yaml` (bootstrap + deploy using metadata-provided secrets)

If you use the auto-deploy variant, edit placeholders before creating the droplet:

- `REPO_URL`
- `REPO_REF`
- `DOMAIN`
- `MYSQL_ROOT_PASSWORD`
- `DB_PASSWORD`

After droplet creation, verify:

```bash
sudo tail -f /var/log/rogainizer-autodeploy.log
docker ps
```

For private repositories:

1. Create a GitHub deploy key with read access and add it to your repository.
2. Base64-encode the private key and set `GITHUB_DEPLOY_KEY_BASE64` in `deploy/digitalocean-cloud-init-autodeploy-private.yaml`.
3. Set `REPO_URL` to SSH format (for example `git@github.com:owner/repo.git`).

Base64 examples:

```bash
# Linux/macOS
base64 -w 0 ~/.ssh/id_ed25519

# PowerShell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("$env:USERPROFILE\.ssh\id_ed25519"))
```

For metadata-driven secrets:

`deploy/digitalocean-cloud-init-autodeploy-metadata.yaml` expects JSON at:

`http://169.254.169.254/metadata/v1/vendor-data`

Expected shape:

```json
{
	"rogainizer": {
		"domain": "example.com",
		"mysql_root_password": "strong-root-pass",
		"db_user": "root",
		"db_password": "strong-db-pass",
		"db_name": "rogainizer",
		"github_deploy_key_base64": "<optional-base64-ssh-private-key>"
	}
}
```

Notes:

- This variant is safest for keeping secrets out of committed files.
- If your DigitalOcean setup does not provide custom `vendor-data`, use the private variant instead.

### 2) Configure environment

From repo root:

```bash
cp .env.production.example .env.production
```

Edit `.env.production` and set:

- `DOMAIN` (for TLS certificate)
- `MYSQL_ROOT_PASSWORD`
- `DB_PASSWORD`

### 3) Start production stack

```bash
docker compose \
	--env-file .env.production \
	-f docker-compose.prod.yml \
	up -d --build
```

This runs:

- `db` (internal only)
- `api` on internal network (`npm start`)
- `web` as static nginx serving built Vite output
- `proxy` (Caddy) handling HTTPS and routing `/api/*` to backend

### 4) Initialize schema (first deploy)

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml exec api npm run db:init
```

### 5) Verify

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml ps
docker compose --env-file .env.production -f docker-compose.prod.yml logs -f proxy
```

Then open `https://your-domain`.

### 5b) Post-deploy self-check (PASS/FAIL)

`deploy/postdeploy-check.sh` validates:

- DNS resolution for `DOMAIN`
- HTTPS/TLS reachability for `https://DOMAIN`
- API health endpoint (`/api/health`)
- Direct DB connectivity via `mysqladmin ping`

Run manually:

```bash
cd /opt/rogainizer
chmod +x deploy/postdeploy-check.sh
./deploy/postdeploy-check.sh .env.production
```

Output ends with either:

- `SUMMARY PASS`
- `SUMMARY FAIL count=<n>`

### 5c) First-boot report file

Autodeploy variants also generate:

- `/var/log/rogainizer-report.txt`

The report includes timestamp, host/kernel, Docker/Compose versions, container status, and health check output.

Regenerate manually:

```bash
cd /opt/rogainizer
chmod +x deploy/first-boot-report.sh
./deploy/first-boot-report.sh .env.production /var/log/rogainizer-report.txt
cat /var/log/rogainizer-report.txt
```

### 6) Nightly database backups

Backup assets are included:

- `deploy/backup-db.sh`
- `deploy/backup-db.cron.example`

On VPS:

```bash
chmod +x /opt/rogainizer/deploy/backup-db.sh
cp /opt/rogainizer/deploy/backup-db.cron.example /tmp/rogainizer-cron
crontab /tmp/rogainizer-cron
```

Run a manual backup test:

```bash
cd /opt/rogainizer
./deploy/backup-db.sh
ls -lh deploy/backups
```

By default backups older than 14 days are deleted. Override with:

```bash
RETENTION_DAYS=30 ./deploy/backup-db.sh
```

Restore from a backup:

```bash
gunzip -c deploy/backups/<your-backup>.sql.gz \
	| docker compose --env-file .env.production -f docker-compose.prod.yml exec -T db sh -lc "exec mysql -uroot -p\"$MYSQL_ROOT_PASSWORD\""
```

## Troubleshooting bundle

Generate a support bundle tarball with redacted env, compose status, key service logs, and health output:

```bash
cd /opt/rogainizer
chmod +x deploy/collect-support-bundle.sh
./deploy/collect-support-bundle.sh .env.production
ls -lh deploy/support/*.tar.gz
```

Optional output directory:

```bash
./deploy/collect-support-bundle.sh .env.production /tmp/rogainizer-support
```

Lightweight bundle (skip service logs):

```bash
./deploy/collect-support-bundle.sh .env.production /tmp/rogainizer-support --no-logs
```

Smaller log bundle (include logs but limit lines):

```bash
./deploy/collect-support-bundle.sh .env.production /tmp/rogainizer-support --tail 200
```

## API routes

- `GET /api/health` - checks API and DB connectivity
- `GET /api/users` - lists users
- `POST /api/users` - creates user (`{ "name": "...", "email": "..." }`)
- `PUT /api/users?name={originalName}&email={originalEmail}` - updates user key/data (`{ "name": "...", "email": "..." }`)
- `DELETE /api/users?name={name}&email={email}` - deletes user by key
- `GET /api/events` - lists all events
- `POST /api/events` - creates event (`{ "name": "...", "date": "YYYY-MM-DD", "location": "...", "courses": ["6hr"], "categories": ["MO"] }`)
- `PUT /api/events/:id` - updates an existing event
- `DELETE /api/events/:id` - deletes an event
- `GET /api/events/:eventId/teams` - lists teams for an event
- `POST /api/events/:eventId/teams` - creates team (`{ "name": "...", "competitors": "Alice, Bob", "course": "6hr", "category": "MO" }`)
- `PUT /api/events/:eventId/teams/:teamId` - updates an event team
- `DELETE /api/events/:eventId/teams/:teamId` - deletes an event team

Users are keyed by the `name + email` combination.
