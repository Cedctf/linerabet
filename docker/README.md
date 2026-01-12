# Linera Casino - Docker Setup

This Docker setup provides a complete development environment for the Linera Casino buildathon submission. It works on **Mac, Windows, and Linux**.

## Features

- ✅ **Isolated Linera state** - Uses `LINERA_HOME=/data/linera` so it never touches your host's `~/.config/linera`
- ✅ **Cross-platform** - No GNU sed or OS-specific shell commands
- ✅ **Dev-friendly** - Mount your code, edit on host, see changes immediately
- ✅ **Two modes** - Interactive (manual setup) or auto-deploy

## Quick Start

### Option 1: Auto-Deploy (Recommended for Demo)

Runs everything automatically - network, contracts, and frontend:

```bash
cd docker
docker compose build
docker compose --profile auto up linera-auto
```

Wait for the build to complete, then access:
- **Frontend**: http://localhost:5173
- **Faucet**: http://localhost:8080
- **GraphQL API**: http://localhost:8081

### Option 2: Interactive Mode (For Development)

Start the container and run commands manually:

```bash
cd docker
docker compose build
docker compose up -d linera-dev

# Enter the container
docker exec -it linera-dev bash

# Inside container - see available commands
bash /app/docker/manual-setup.sh

# Or run everything at once
bash /app/docker/entrypoint.sh
```

## Ports

| Port  | Service                |
|-------|------------------------|
| 5173  | Frontend (Vite)        |
| 8080  | Linera Faucet          |
| 8081  | Linera Service (GraphQL)|
| 9001  | Validator Proxy        |
| 13001 | Validator Shard        |

## Volumes

| Volume Name          | Container Path    | Purpose                        |
|----------------------|-------------------|--------------------------------|
| `linera-casino-data` | `/data/linera`    | Persistent Linera wallet/state |
| (bind mount)         | `/app`            | Your application code          |

## Files

| File                   | Purpose                                      |
|------------------------|----------------------------------------------|
| `Dockerfile`           | Container image with Rust, Node.js, Linera   |
| `compose.yaml`         | Docker Compose configuration                 |
| `entrypoint.sh`        | Full automated deployment script             |
| `run.bash`             | Buildathon template compatibility wrapper    |
| `update-constants.mjs` | Cross-platform constants.ts updater          |
| `manual-setup.sh`      | Reference for step-by-step manual commands   |

## DigitalOcean Droplet Deployment

```bash
# 1. SSH into your droplet
ssh root@your-droplet-ip

# 2. Install Docker (if needed)
curl -fsSL https://get.docker.com | sh

# 3. Clone the repo
git clone https://github.com/your-username/linerabet.git
cd linerabet/docker

# 4. Build and run (auto mode)
docker compose build
docker compose --profile auto up -d linera-auto

# 5. Check logs
docker logs -f linera-auto

# 6. Configure firewall (if needed)
ufw allow 5173
ufw allow 8080
ufw allow 8081
```

Access at: `http://your-droplet-ip:5173`

## Resetting State

To completely reset the Linera state:

```bash
docker compose down -v  # Removes the linera-data volume
docker compose build --no-cache
docker compose --profile auto up linera-auto
```

## Troubleshooting

### Container won't start
```bash
# Check logs
docker compose logs linera-dev

# Rebuild from scratch
docker compose build --no-cache
```

### Faucet not responding
```bash
# Inside container, check if network is running
ps aux | grep linera
cat /app/net.log
```

### Contract build fails
```bash
# Make sure you're in the right directory
cd /app/contracts
cargo build --release --target wasm32-unknown-unknown 2>&1 | head -50
```

## Versions

- **Linera**: 0.15.8
- **Rust**: 1.86
- **Node.js**: 22.x (LTS)
