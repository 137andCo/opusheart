# Self-Hosting OpusHeart

Three supported deployment paths, smallest to largest:

| Path | Best for | Orchestrator |
|------|----------|--------------|
| **Docker Compose** | a single box / a small community | `docker compose` |
| **Docker Swarm** | a few nodes, rolling updates | `docker stack` |
| **Kubernetes** | existing clusters, autoscaling | `kubectl` (see `k8s/`) |

All three run the same images: `server` (:3020), `web` public site (:3022),
`dashboard` admin SPA (:3021), behind a reverse proxy that terminates TLS.

## Prerequisites

- Docker + Docker Compose v2 (Compose/Swarm paths), or a Kubernetes cluster.
- Secrets generated with `openssl rand -hex 32` for `JWT_SECRET` and
  `ENCRYPTION_KEY`. **The server refuses to boot in production with
  placeholder/dev values** — set real ones.

---

## Path 1 — Docker Compose (single box)

```bash
git clone https://github.com/137andCo/opusheart.git
cd opusheart
cp .env.example .env
# Edit .env — set JWT_SECRET, ENCRYPTION_KEY, and strong MONGO_ROOT_PASSWORD /
# REDIS_PASSWORD (the dev defaults are rejected in production).

# Datastores only:
docker compose up -d

# OR the whole stack (builds server/web/dashboard, runs nginx on :80):
docker compose --profile app up -d --build
```

With the `app` profile everything is served through nginx on **http://localhost**:

- **Public site**: `http://localhost/`
- **Admin dashboard**: `http://localhost/dashboard/`
- **API**: `http://localhost/api`

In development you can also run the datastores in Compose and the apps with
`pnpm dev:server` / `pnpm dev:dashboard` / `pnpm dev:web` (ports 3020/3021/3022).

---

## Path 2 — Docker Swarm (multi-node, rolling updates)

```bash
docker swarm init                         # once, on the manager
docker node update --label-add storage=true <node>   # where Mongo/Redis live

# Create the external secrets the stack expects:
printf '%s' "$(openssl rand -hex 32)" | docker secret create jwt_secret -
printf '%s' "$(openssl rand -hex 32)" | docker secret create encryption_key -
printf '%s' 'opusheart'                  | docker secret create mongo_root_username -
printf '%s' "$(openssl rand -hex 24)"    | docker secret create mongo_root_password -
printf '%s' "$(openssl rand -hex 24)"    | docker secret create redis_password -
printf '%s' 'mongodb://opusheart:<pw>@mongo:27017/opusheart?authSource=admin' | docker secret create mongo_uri -
printf '%s' 'redis://:<pw>@redis:6379'   | docker secret create redis_url -

export REGISTRY=<your-registry> DOMAIN=yourdomain.org TAG=0.1.0
# Build & push the three images (see k8s/README.md for the build commands), then:
docker stack deploy -c docker-stack.yml opusheart
```

`docker-stack.yml` runs every service non-root, with dropped capabilities,
`no-new-privileges`, read-only root filesystems where the image allows, resource
limits, and healthchecks. `TAG` is required (no `:latest` default).

---

## Path 3 — Kubernetes

Plain manifests live in [`k8s/`](../k8s/) with their own
[README](../k8s/README.md): namespace, secrets (template), configmap, Mongo +
Redis StatefulSets, server/web/dashboard Deployments, and an nginx-ingress +
cert-manager Ingress. Every workload ships with non-root security contexts,
dropped capabilities, resource requests/limits, and liveness/readiness probes.

---

## TLS / reverse proxy

`nginx/nginx.conf` serves plain HTTP on :80 and is designed to sit **behind** a
TLS terminator (Traefik, a cloud load balancer, Cloudflare, or the k8s Ingress),
which owns HTTPS + HSTS. To terminate TLS at this nginx instead, uncomment the
`:443` server block in `nginx/nginx.conf` and mount your certs. Either way, keep
`TRUST_PROXY` set to the number of proxy hops (default `1`) so the app records
real client IPs for rate limiting and audit logs.

## Manual (no containers)

```bash
pnpm install && pnpm build
cp .env.example .env   # edit
# Start MongoDB 8+ and Redis 7+ yourself, then:
node packages/server/dist/index.js
```
Serve the built frontends (`packages/web/.output/server/index.mjs` with Node;
`packages/dashboard/.output/public` with any static server).

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `MONGO_URI` | Yes | - | MongoDB connection string |
| `REDIS_URL` | Yes | - | Redis connection string |
| `JWT_SECRET` | Yes | - | JWT signing secret (32+ chars) |
| `ENCRYPTION_KEY` | Yes | - | 32-byte hex key (64 hex chars) for PII encryption |
| `PORT` | No | 3020 | API server port |
| `NODE_ENV` | No | development | `development` or `production` |
| `TRUST_PROXY` | No | 1 | Proxy hops to trust for client IP; `false` if no proxy |
| `CORS_ORIGINS` | No | localhost | Comma-separated allowed origins |
| `INSTANCE_NAME` | No | OpusHeart | Your community name |
| `INSTANCE_URL` | No | localhost:3020 | Public URL of your instance |
| `VERTICAL` | No | church | Audience preset: `church` ships; `community`/`nonprofit`/`custom` planned |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` / `SMTP_FROM` | No | - | Email delivery (communications, password reset) |

See `.env.example` for the full list including feature toggles, VAPID push, and
AI configuration.

## First-Time Setup

1. Start the services.
2. Seed the starter data + admin user: `pnpm seed`.
3. Log into the dashboard with `admin@opusheart.local` / `ChangeMe123!`.
4. **Change the admin password immediately** (Settings → password, or the
   forgot-password flow if SMTP is configured).
5. Configure instance settings and enable the features you need.

## Backups

```bash
export MONGO_URI="mongodb://localhost:27017/opusheart"
./scripts/backup.sh
```
Creates a compressed mongodump in `./backups/` and prunes archives older than 30
days (`BACKUP_DIR`, `RETENTION_DAYS` to tune). Automate via cron:
```
0 2 * * * cd /opt/opusheart && ./scripts/backup.sh >> /var/log/opusheart-backup.log 2>&1
```

## Updating

```bash
git pull
docker compose --profile app up -d --build     # Compose
# Swarm: rebuild+push images, then: docker stack deploy -c docker-stack.yml opusheart
# k8s:   rebuild+push, bump the image tag, kubectl apply -f k8s/
```

## Troubleshooting

- **Refuses to boot citing a placeholder secret**: set real `JWT_SECRET` /
  `ENCRYPTION_KEY` and non-default DB passwords (production guard).
- **MongoDB/Redis connection refused**: check `docker compose logs mongo|redis`
  and that the credentials in `MONGO_URI`/`REDIS_URL` match.
- **Rate limiter returns 503**: it fails closed when Redis is unreachable —
  verify Redis is up.
- **Health**: `GET /health` (liveness) and `GET /ready` (DB-connected).
