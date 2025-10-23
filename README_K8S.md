# Run Neuralizard on local Kubernetes

This repo includes Kubernetes manifests under `k8s/` to run the stack (Postgres, API, Frontend, optional pgweb) on a local cluster (Docker Desktop Kubernetes, kind, or minikube).

## 1) Prereqs

- kubectl installed
- One of:
  - Docker Desktop with Kubernetes enabled, or
  - kind (https://kind.sigs.k8s.io/) or
  - minikube (https://minikube.sigs.k8s.io/)
- Optional: ingress controller (e.g. `ingress-nginx`) if you want pretty hostnames

## 2) Namespace and Secrets

Create the namespace and a Secret with DB creds and provider API keys.

```
kubectl apply -f k8s/namespace.yaml
# Copy the example and edit values
cp k8s/secrets.example.yaml k8s/secrets.yaml
# Edit k8s/secrets.yaml with your keys, then apply
kubectl apply -f k8s/secrets.yaml
```

Alternatively, you can generate from your existing `.env`:

```
kubectl -n neuralizard create secret generic neuralizard-secrets \
  --from-literal=POSTGRES_USER=neuralizard \
  --from-literal=POSTGRES_PASSWORD=neuralizard \
  --from-literal=POSTGRES_DB=neuralizard \
  --from-env-file=.env
```

## 3) Build local images

Build API and Frontend images and tag them as `:local` so the manifests can use them.

```
# API
docker build -t neuralizard-api:local .

# Frontend (static build via Nginx)
# Option A (quick): default WS URL is ws://localhost:8001; use port-forward below
docker build -t neuralizard-frontend:local ./frontend

# Option B (ingress): bake WS URL so the app talks to the API host via ingress
# Rebuild with env available during build: VITE_WS_URL=ws://api.neuralizard.localtest.me/chat/ws
# (Dockerfile uses `npm run build`; Vite picks environment vars prefixed with VITE_.)
VITE_WS_URL=ws://api.neuralizard.localtest.me/chat/ws docker build -t neuralizard-frontend:local ./frontend
```

Notes:
- On kind/minikube, load images into the cluster:
  - kind: `kind load docker-image neuralizard-api:local neuralizard-frontend:local`
  - minikube: `minikube image load neuralizard-api:local neuralizard-frontend:local`

## 4) Deploy Postgres, API, Frontend (and optional pgweb)

```
kubectl apply -f k8s/postgres.yaml
kubectl apply -f k8s/api.yaml
kubectl apply -f k8s/frontend.yaml
# Optional
kubectl apply -f k8s/pgweb.yaml
```

Wait for pods to be Ready:

```
kubectl -n neuralizard get pods -w
```

## 5) Access locally

### Option A — Port-forward (no ingress required)
This works with the default frontend build and the hardcoded fallback `ws://localhost:8001`.

```
# API on localhost:8001 (WS endpoint: ws://localhost:8001/chat/ws)
kubectl -n neuralizard port-forward svc/api 8001:8001

# Frontend on localhost:8080 (Nginx in the container listens on 80)
kubectl -n neuralizard port-forward svc/frontend 8080:80
```
Open http://localhost:8080 — the frontend connects to the API over ws://localhost:8001.

### Option B — Ingress (nicer hosts)
Install an ingress controller (e.g., `ingress-nginx`), then apply the example ingress:

```
kubectl apply -f k8s/ingress.example.yaml
```
You’ll get:
- Frontend: http://neuralizard.localtest.me/
- API WS: ws://api.neuralizard.localtest.me/chat/ws

Rebuild the frontend with `VITE_WS_URL` baked in (see step 3 Option B).

## 6) pgweb (optional)
Port-forward pgweb to browse the DB:

```
kubectl -n neuralizard port-forward svc/pgweb 8081:8081
```
Open http://localhost:8081.

## 7) Teardown

```
kubectl delete -f k8s/frontend.yaml
kubectl delete -f k8s/api.yaml
kubectl delete -f k8s/postgres.yaml
kubectl delete -f k8s/pgweb.yaml # if applied
kubectl delete -f k8s/secrets.yaml # if created from file
kubectl delete -f k8s/namespace.yaml
```

## Troubleshooting
- Image not found: ensure you built with `:local` tag and loaded into kind/minikube as needed.
- Frontend can’t connect to WS: use port-forward Option A or rebuild the frontend with `VITE_WS_URL` (Option B).
- Postgres PVC Pending: your local cluster storage class might differ; update `postgres.yaml` to match your StorageClass or use emptyDir for quick tests.