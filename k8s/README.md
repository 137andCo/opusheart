# OpusHeart on Kubernetes

Plain manifests (no Helm required). They run server + web + dashboard with an
in-cluster MongoDB and Redis, fronted by an nginx-ingress + cert-manager TLS.

## Prerequisites

- A cluster with a default `StorageClass`, an **nginx-ingress** controller, and
  **cert-manager** (for the `letsencrypt-prod` ClusterIssuer referenced by the
  Ingress).
- Images built from this repo's Dockerfiles and pushed to a registry your
  cluster can pull. Tag them by version/digest (never `:latest`):

  ```bash
  docker build -f packages/server/Dockerfile    -t <registry>/opusheart-server:0.1.0 .
  docker build -f packages/web/Dockerfile        -t <registry>/opusheart-web:0.1.0 .
  docker build -f packages/dashboard/Dockerfile  -t <registry>/opusheart-dashboard:0.1.0 .
  docker push <registry>/opusheart-{server,web,dashboard}:0.1.0
  ```

  Then update the `image:` field in `server.yaml`, `web.yaml`, `dashboard.yaml`.

## Apply

```bash
kubectl apply -f k8s/namespace.yaml
cp k8s/secret.example.yaml k8s/secret.yaml   # then edit real values (git-ignored)
kubectl apply -f k8s/secret.yaml
kubectl apply -f k8s/configmap.yaml           # edit domain/instance first
kubectl apply -f k8s/mongo.yaml -f k8s/redis.yaml
kubectl apply -f k8s/server.yaml -f k8s/web.yaml -f k8s/dashboard.yaml
kubectl apply -f k8s/ingress.yaml             # edit hostnames first
```

Generate the app secrets with `openssl rand -hex 32` (JWT_SECRET,
ENCRYPTION_KEY). The server **refuses to boot** if any secret still contains a
placeholder/dev value in production.

## Security posture baked in

- All workloads run as non-root with `allowPrivilegeEscalation: false`, all
  Linux capabilities dropped, and (where the image allows) a read-only root
  filesystem.
- CPU/memory requests and limits on every pod.
- Liveness/readiness probes wired to real endpoints.
- Datastores are `StatefulSet`s with persistent volumes; only the Ingress is
  exposed externally — Mongo/Redis are cluster-internal `ClusterIP` services.
- `TRUST_PROXY=1` so the app sees real client IPs behind the Ingress.

`secret.yaml` is git-ignored — only `secret.example.yaml` is tracked.
