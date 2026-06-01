# OpusHeart Deployment Guide

Single-node Docker Swarm deployment behind Traefik (TLS terminated upstream).

## Prerequisites

- Docker Engine 24+ with Swarm mode initialized (`docker swarm init`)
- Registry access (GitLab Container Registry, Docker Hub, or self-hosted)
- Node label for storage: `docker node update --label-add storage=true $(docker node ls -q)`

## 1. Build & Push Images

From the repo root:

```bash
export REGISTRY=registry.example.com/opusheart
export TAG=$(git rev-parse --short HEAD)

docker build -t $REGISTRY/opusheart-server:$TAG -f packages/server/Dockerfile .
docker build -t $REGISTRY/opusheart-web:$TAG -f packages/web/Dockerfile .
docker build -t $REGISTRY/opusheart-dashboard:$TAG -f packages/dashboard/Dockerfile .

docker push $REGISTRY/opusheart-server:$TAG
docker push $REGISTRY/opusheart-web:$TAG
docker push $REGISTRY/opusheart-dashboard:$TAG
```

## 2. Create Secrets

```bash
# Generate secrets
openssl rand -hex 32  # JWT_SECRET
openssl rand -hex 32  # ENCRYPTION_KEY
openssl rand -hex 16  # MONGO password
openssl rand -hex 16  # REDIS password

# Create Docker secrets
echo "GENERATED_VALUE" | docker secret create jwt_secret -
echo "GENERATED_VALUE" | docker secret create encryption_key -
echo "opusheart" | docker secret create mongo_root_username -
echo "GENERATED_MONGO_PW" | docker secret create mongo_root_password -
echo "GENERATED_REDIS_PW" | docker secret create redis_password -
echo "mongodb://opusheart:GENERATED_MONGO_PW@mongo:27017/opusheart?authSource=admin" | docker secret create mongo_uri -
echo "redis://:GENERATED_REDIS_PW@redis:6379" | docker secret create redis_url -
```

## 3. Configure nginx

Copy `nginx/nginx.conf` to the deployment host. The config proxies:

| Path | Service | Port |
|------|---------|------|
| `/api/` | server | 3020 |
| `/socket.io/` | server (WebSocket) | 3020 |
| `/dashboard/` | dashboard (SPA) | 3021 |
| `/health` | server health check | 3020 |
| `/` (catch-all) | web (SSR) | 3022 |

TLS: by default this nginx serves plain HTTP and expects an upstream proxy
(Traefik, cloud LB, Cloudflare) to terminate TLS and set `X-Forwarded-Proto`.
To terminate TLS in this nginx instead, uncomment the `443`/redirect blocks in
`nginx/nginx.conf`, mount your certs, and publish `443` in `docker-stack.yml`.
Security headers (nosniff, X-Frame-Options, Referrer-Policy, Permissions-Policy)
are applied either way; enable the commented HSTS header once HTTPS is in front.

## 4. Deploy Stack

```bash
export REGISTRY=registry.example.com/opusheart
export TAG=$(git rev-parse --short HEAD)
export DOMAIN=mychurch.example.com

docker stack deploy -c docker-stack.yml opusheart --with-registry-auth
```

## 5. Seed Admin User

One-time, after first deploy — run the bundled seed as a one-shot service:

```bash
docker service create --name opusheart-seed \
  --network opusheart_internal \
  --secret mongo_uri \
  --env NODE_ENV=production \
  --restart-condition none \
  $REGISTRY/opusheart-server:$TAG \
  node dist/scripts/seed.js
```

This creates the starter data and an `admin@opusheart.local` / `ChangeMe123!`
account — **change that password immediately** after first login.

## 6. Environment Variables

The server resolves each secret from, in order: the environment variable, a `<NAME>_FILE` path, or the Docker/Swarm secret mount at `/run/secrets/<name>` (lowercased). So `docker-stack.yml` only needs to declare the matching Docker secrets (e.g. `jwt_secret`, `encryption_key`, `mongo_uri`, `redis_url`) — no `environment` mapping required.

Required env vars (see `.env.example` for full list):

| Variable | Required | Description |
|----------|----------|-------------|
| `MONGO_URI` | Yes | MongoDB connection string |
| `REDIS_URL` | Yes | Redis connection string |
| `JWT_SECRET` | Yes | 64-char hex, token signing |
| `ENCRYPTION_KEY` | Yes | 64-char hex, PII field encryption |
| `CORS_ORIGINS` | Prod | Comma-separated allowed origins (dev default: localhost) |
| `INSTANCE_NAME` | Prod | Display name for this community (default: OpusHeart) |
| `INSTANCE_URL` | Prod | Public URL of this instance (default: localhost:3020) |
| `FEATURE_*` | No | Feature flags (see `.env.example`) |
| `MONITORING_TOKEN` | No | Bearer token for `/metrics` endpoint |

## 7. Verify

```bash
# Check services are running
docker stack services opusheart

# Health check
curl http://localhost/health

# API responds
curl http://localhost/api/events/public

# Dashboard loads
curl -I http://localhost/dashboard/

# Web SSR renders
curl http://localhost/
```

## 8. Updates

```bash
export TAG=new-commit-sha

# Build and push new images
docker build -t $REGISTRY/opusheart-server:$TAG -f packages/server/Dockerfile .
docker push $REGISTRY/opusheart-server:$TAG

# Rolling update
docker service update --image $REGISTRY/opusheart-server:$TAG opusheart_server
```

The `start-first` update policy ensures zero-downtime deploys — new container starts before old one stops.

## Resource Requirements

| Spec | Minimum | Recommended |
|------|---------|-------------|
| CPU | 2 cores | 4 cores |
| RAM | 4 GB | 8 GB |
| Disk | 40 GB SSD | 80 GB SSD |
| Capacity | ~500 members | ~2,000 members |

## Backup

```bash
# MongoDB dump
docker exec $(docker ps -qf "name=opusheart_mongo") \
  mongodump --uri="mongodb://opusheart:PASSWORD@localhost:27017/opusheart?authSource=admin" \
  --archive --gzip > backup-$(date +%F).gz

# Redis (AOF/RDB already on volume)
docker run --rm -v opusheart_redis-data:/data -v $(pwd):/backup \
  busybox tar czf /backup/redis-$(date +%F).tar.gz /data
```
