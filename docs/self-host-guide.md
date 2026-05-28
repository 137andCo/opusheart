# Self-Hosting OpusHeart

## Prerequisites

- Docker and Docker Compose v2+
- OR Node.js 24+, pnpm 9+, MongoDB 7+, Redis 7+

## Docker Deployment (Recommended)

```bash
git clone https://github.com/137andCo/opusheart.git
cd opusheart
cp .env.example .env
# Edit .env — at minimum set JWT_SECRET, REFRESH_TOKEN_SECRET, ENCRYPTION_KEY

# Start everything
docker compose --profile app up -d
```

Services will be available at:
- **API**: http://localhost:3020
- **Public site**: http://localhost:3000
- **Admin dashboard**: http://localhost:3021

## Manual Deployment

```bash
pnpm install
pnpm build
cp .env.example .env
# Edit .env

# Start MongoDB and Redis separately, then:
node packages/server/dist/index.js
```

Build the frontends with `pnpm --filter @opusheart/web build` and `pnpm --filter @opusheart/dashboard build`, then serve their `.output/server/index.mjs` with Node.

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `MONGO_URI` | Yes | - | MongoDB connection string |
| `REDIS_URL` | Yes | - | Redis connection string |
| `JWT_SECRET` | Yes | - | JWT signing secret (64+ chars) |
| `REFRESH_TOKEN_SECRET` | Yes | - | Refresh token secret (64+ chars) |
| `ENCRYPTION_KEY` | Yes | - | 32-byte hex key for PII encryption |
| `PORT` | No | 3020 | API server port |
| `NODE_ENV` | No | development | `development` or `production` |
| `CORS_ORIGINS` | No | localhost | Comma-separated allowed origins |
| `INSTANCE_NAME` | No | OpusHeart | Your community name |
| `INSTANCE_URL` | No | localhost:3020 | Public URL of your API |
| `VERTICAL` | No | church | Vertical config (church, nonprofit) |

See `.env.example` for the full list including feature toggles, SMTP, VAPID, and AI configuration.

## First-Time Setup

1. Start the services
2. Run the seed script: `pnpm seed`
3. Log into the dashboard at `/dashboard` with `admin@opusheart.local` / `ChangeMe123!`
4. Change the admin password immediately
5. Configure instance settings, enable desired features

## Backups

Use the included backup script:

```bash
export MONGO_URI="mongodb://localhost:27017/opusheart"
./scripts/backup.sh
```

This creates a compressed mongodump in `./backups/` and cleans up archives older than 30 days. Configure with `BACKUP_DIR` and `RETENTION_DAYS` environment variables.

Set up a cron job for automated backups:
```
0 2 * * * cd /opt/opusheart && ./scripts/backup.sh >> /var/log/opusheart-backup.log 2>&1
```

## Updating

```bash
git pull
pnpm install
pnpm build
docker compose --profile app up -d --build
# OR restart Node processes manually
```

## Troubleshooting

- **MongoDB connection refused**: Ensure MongoDB is running and `MONGO_URI` is correct. Check `docker compose logs mongo`.
- **Redis connection refused**: Same as above for Redis. Check `docker compose logs redis`.
- **Port conflicts**: Change ports in `.env` and `docker-compose.yml`.
- **Health check**: Hit `GET /health` and `GET /ready` to verify the server is running and connected.
- **Metrics**: `GET /metrics` returns uptime, memory usage, and DB connection state.
