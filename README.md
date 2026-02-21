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
