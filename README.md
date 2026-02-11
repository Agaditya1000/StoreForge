# StoreForge — Kubernetes Store Provisioning Platform

A production-ready platform for provisioning **WooCommerce** e-commerce stores on Kubernetes. Each store gets its own namespace with full isolation, persistent storage, and automatic WooCommerce setup.

---

## ✨ Features

- **One-Click Provisioning** — Create fully functional WooCommerce stores from a React dashboard
- **Automatic WooCommerce Setup** — WP-CLI Job installs WordPress, WooCommerce plugin, Storefront theme, COD payment, and a sample product
- **Kubernetes Native** — Helm charts with Deployments, Services, Ingress, PVCs, Secrets, and Jobs
- **Namespace Isolation** — Each store runs in its own namespace
- **Persistent Storage** — PVCs for both WordPress files and MariaDB data
- **No Hardcoded Secrets** — Credentials auto-generated via Kubernetes Secrets
- **Local ↔ Production** — Same charts work on Kind/Minikube (local) and k3s/VPS (prod) via `values-local.yaml` / `values-prod.yaml`
- **Clean Teardown** — Deleting a store removes namespace, PVCs, secrets, and all resources

---

## 🏗 Architecture

```
┌──────────────────────────────────────────────────────────────┐
│  React Dashboard (:5173)                                     │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐                       │
│  │ Store 1 │ │ Store 2 │ │ + New   │                        │
│  │ Ready ✓ │ │ Prov... │ │ Store   │                        │
│  └─────────┘ └─────────┘ └─────────┘                        │
└──────────────────────┬───────────────────────────────────────┘
                       │ REST API
┌──────────────────────▼───────────────────────────────────────┐
│  Node.js Backend (:3001)                                     │
│  Express + Helm CLI wrapper                                  │
└──────────────────────┬───────────────────────────────────────┘
                       │ helm upgrade --install / uninstall
┌──────────────────────▼───────────────────────────────────────┐
│  Kubernetes Cluster                                          │
│                                                              │
│  Namespace: store-alpha          Namespace: store-beta       │
│  ┌─────────────────────┐        ┌─────────────────────┐     │
│  │ WordPress + MariaDB │        │ WordPress + MariaDB │     │
│  │ PVC (wp) + PVC (db) │        │ PVC (wp) + PVC (db) │     │
│  │ Secret (db-creds)   │        │ Secret (db-creds)   │     │
│  │ Service + Ingress   │        │ Service + Ingress   │     │
│  │ Job (woo-setup)     │        │ Job (woo-setup)     │     │
│  └─────────────────────┘        └─────────────────────┘     │
└──────────────────────────────────────────────────────────────┘
```

---

## 📋 Prerequisites

| Tool | Version | Purpose |
|------|---------|---------|
| Node.js | v18+ | Backend + Frontend |
| Docker | Latest | Container runtime |
| kubectl | Latest | Cluster management |
| Helm | v3+ | Chart deployment |
| Kind / Minikube / k3d | Latest | Local Kubernetes cluster |

---

## 🚀 Quick Start (Local)

### 1. Create a Local Kubernetes Cluster

```bash
# Option A: Kind
kind create cluster --name storeforge

# Option B: Minikube
minikube start --driver=docker --memory=4096

# Option C: k3d
k3d cluster create storeforge -p "80:80@loadbalancer"
```

### 2. Install an Ingress Controller

```bash
# NGINX Ingress (for Kind / Minikube)
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/main/deploy/static/provider/cloud/deploy.yaml

# Wait for it to be ready
kubectl wait --namespace ingress-nginx \
  --for=condition=ready pod \
  --selector=app.kubernetes.io/component=controller \
  --timeout=120s
```

> **Minikube users**: Run `minikube addons enable ingress` instead.

### 3. Start the Backend

```bash
cd backend
npm install
npm start
```

Backend runs on **http://localhost:3001**.

### 4. Start the Dashboard

```bash
cd frontend
npm install
npm run dev
```

Dashboard opens at **http://localhost:5173**.

### 5. Provision a Store

1. Open the Dashboard
2. Click **+ New Store**
3. Enter a name (e.g., `my-shop`) — must be kebab-case, 3+ chars
4. Click **🚀 Create Store**
5. Watch status: **Provisioning** → **Ready**

### 6. Configure Local DNS

Add entries to your hosts file for each store:

**Windows** (`C:\Windows\System32\drivers\etc\hosts` — run as Administrator):
```
127.0.0.1  my-shop.local
```

**Mac / Linux** (`/etc/hosts`):
```
127.0.0.1  my-shop.local
```

> For **Kind**, you may need to port-forward: `kubectl port-forward -n ingress-nginx svc/ingress-nginx-controller 80:80`

### 7. Access Your Store

| URL | Purpose |
|-----|---------|
| `http://my-shop.local` | Customer storefront |
| `http://my-shop.local/wp-admin` | WordPress admin |

**Default admin credentials**: `admin` / `admin123`

---

## 🧪 End-to-End Testing (WooCommerce Order Flow)

Once a store is **Ready**:

1. Open `http://my-shop.local` — Storefront loads with a sample product
2. Click on **Sample Product** → **Add to Cart**
3. Click **View Cart** → **Proceed to Checkout**
4. Fill in billing details (any test data) and select **Cash on Delivery**
5. Click **Place Order**
6. ✅ "Order received" confirmation should appear
7. In WP Admin (`/wp-admin`) → **WooCommerce** → **Orders** — verify the order is listed

---

## 🌍 Production Deployment (VPS / k3s)

1. **Install k3s** on your VPS:
   ```bash
   curl -sfL https://get.k3s.io | sh -
   ```

2. **Clone the repo** to the VPS.

3. **Deploy stores** using production values:
   ```bash
   helm install my-store ./charts/universal-store \
     -f ./charts/universal-store/values-prod.yaml \
     --namespace my-store --create-namespace \
     --set store.name=my-store \
     --set ingress.host=my-store.example.com \
     --set woocommerce.db.rootPassword=$(openssl rand -base64 16) \
     --set woocommerce.db.password=$(openssl rand -base64 16)
   ```

4. **Run the backend** with PM2:
   ```bash
   npm install -g pm2
   cd backend && pm2 start src/index.js --name storeforge-api
   ```

### Local vs Production (Helm Values)

| Setting | `values.yaml` (Local) | `values-prod.yaml` (Prod) |
|---------|----------------------|--------------------------|
| Ingress Class | `nginx` | `traefik` |
| Storage Class | `standard` | `local-path` |
| PVC Size | `1Gi` | `5Gi` |
| CPU Request | `250m` | `500m` |
| Memory Request | `512Mi` | `1Gi` |
| Secrets | Auto-generated | Pass via `--set` |

---

## 📂 Project Structure

```
StoreForge/
├── backend/
│   └── src/
│       ├── index.js        # Express API (create, list, delete stores)
│       └── helm.js         # Helm CLI wrapper
├── frontend/
│   └── src/
│       ├── App.jsx         # React dashboard
│       ├── index.css       # Glassmorphism design system
│       └── main.jsx        # Entry point
├── charts/
│   └── universal-store/
│       ├── Chart.yaml
│       ├── values.yaml           # Local defaults
│       ├── values-prod.yaml      # Production overrides
│       └── templates/
│           ├── deployment-woo.yaml   # WordPress + MariaDB pod
│           ├── service.yaml          # ClusterIP service
│           ├── ingress.yaml          # Host-based routing
│           ├── pvc.yaml              # Persistent volumes
│           ├── secrets.yaml          # Auto-generated DB credentials
│           └── woo-setup-job.yaml    # WP-CLI auto-setup job
└── README.md
```

---

## 🔒 Security

- **No hardcoded secrets** — DB passwords are auto-generated via Helm's `randAlphaNum` and stored in Kubernetes Secrets
- **Namespace isolation** — Each store is fully isolated
- **Helmet middleware** — Backend uses Helmet for HTTP security headers
- **Production secrets** — Pass via `--set` flags or use an external secret manager (Vault, Sealed Secrets, etc.)

---

## 🔧 Troubleshooting

| Issue | Solution |
|-------|----------|
| Store stuck on "Provisioning" | Check pod status: `kubectl get pods -n <store-name>`. MariaDB may need time to initialize. |
| Can't reach `*.local` URL | Verify hosts file entry and ingress controller is running. For Kind, port-forward port 80. |
| WordPress shows "Error establishing DB connection" | DB may still be starting. Wait 1-2 min and refresh. Check: `kubectl logs -n <store-name> <pod> -c mariadb` |
| WooCommerce not installed | Check setup job: `kubectl logs -n <store-name> job/<store-name>-woo-setup` |
| Helm command not found | Ensure Helm is in PATH. On Windows with Winget install, the backend auto-detects the Winget path. |
