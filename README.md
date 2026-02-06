# StoreForge: Kubernetes Store Orchestration Platform

A production-ready store provisioning platform built for Kubernetes. Deploy WooCommerce or MedusaJS stores instantly with full isolation and persistence.

## 🚀 Features

- **Multi-Engine Support**: Provisions **WooCommerce** (WordPress + MariaDB) or **MedusaJS** (Node + Postgres + Redis).
- **Kubernetes Native**: Uses Helm for robust, repeatable deployments.
- **Production Ready**: Same charts work locally (Kind/Minikube) and in production (VPS/k3s) via values injection.
- **Isolation**: Each store gets its own Namespace.
- **Persistence**: Stateful workloads are preserved using PVCs.
- **Modern Dashboard**: React-based UI with glassmorphism design for easy management.

## 🛠 Prerequisites

- **Node.js** (v18+)
- **Kubernetes Cluster** (Kind, Minikube, or K3s)
- **Helm** (v3)
- **Kubectl** configured to talk to your cluster.

## 🏃‍♂️ Quick Start (Local)

### 1. Start the Backend (Orchestrator)

The backend manages Helm operations.

```bash
cd backend
npm install
npm run start
```

*Server runs on localhost:3001*

### 2. Start the Dashboard

```bash
cd frontend
npm install
npm run dev
```

*Dashboard opens on localhost:5173*

### 3. Provision a Store

1. Open the Dashboard.
2. Click **+ New Store**.
3. Choose a name (e.g., `my-shop`) and engine (WooCommerce or Medusa).
4. Click **Create**.
5. Watch the status change from `Provisioning` to `Deployed`.

Access your store at: `http://my-shop.local` (ensure you have Ingress Controller running and `/etc/hosts` mapped).

## 🌍 Production Deployment (VPS / k3s)

1. **Clone Repo** to your VPS.
2. **Setup K3s**: `curl -sfL https://get.k3s.io | sh -`
3. **Run Backend**: Use PM2 or Dockerize the backend.
   ```bash
   pm2 start backend/src/index.js --name orchestrator
   ```
4. **Deploy Stores**: The backend will use the local Helm binary to deploy to k3s.
5. **Configuration**: The system automatically uses `values-prod.yaml` principles (configurable via backend logic extension or manual override). To apply production values manually:

```bash
helm install my-store ./charts/universal-store -f ./charts/universal-store/values-prod.yaml
```

## 🏗 Architecture & Trade-offs

- **Orchestration**: verification verified via `helm list`.
- **Database**: Each store gets a dedicated database pod. *Trade-off*: Higher resource usage per store vs shared DB, but better isolation.
- **Ingress**: Uses Host-based routing. Requires an Ingress Controller (nginx/traefik).
- **Security**: 
    - No hardcoded secrets in code (passed via Env/Values).
    - Namespace isolation prevents cross-store access.

## 🛡️ Security & Scaling

- **Rate Limiting**: Backend is ready for `express-rate-limit`.
- **RBAC**: The backend requires a ServiceAccount with permissions to manage Namespaces and Releases if running inside K8s.
- **Horizontal Scaling**: The Dashboard and Backend allow horizontal scaling (stateless).

## 📂 Project Structure

- `backend/`: Node.js Express server + Helm interactions.
- `frontend/`: React + Vite Dashboard.
- `charts/`: Universal Helm Chart.
