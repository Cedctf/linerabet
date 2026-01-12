#!/usr/bin/env bash
set -e

echo "🔹 Starting Linera Development Environment..."
echo "   LINERA_HOME=$LINERA_HOME"

# Source nvm to get node/npm
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

cd /app

# Clean up any existing wallet (for fresh start)
echo "🔹 Cleaning up old wallet state..."
rm -rf /root/.config/linera
rm -rf /data/linera/*
mkdir -p /data/linera
echo "🔹 Starting Linera Network with Faucet..."

# Use linera net helper for proper process management
eval "$(linera net helper)"
linera_spawn linera net up --with-faucet --faucet-port 8080 --testing-prng-seed 37

export LINERA_FAUCET_URL=http://localhost:8080

# Wait for faucet to be ready
echo "   Waiting for faucet to be ready..."
count=0
while ! curl -s http://localhost:8080 > /dev/null 2>&1; do
    sleep 1
    count=$((count+1))
    if [ $count -ge 60 ]; then
        echo "❌ Faucet timed out!"
        exit 1
    fi
done
echo "✅ Faucet is ready!"

# ========================================
# INITIALIZE WALLET
# ========================================
echo "🔹 Initializing wallet..."
linera wallet init --faucet="$LINERA_FAUCET_URL"
linera wallet request-chain --faucet="$LINERA_FAUCET_URL"

# Get Chain ID
CHAIN_ID=$(linera wallet show | grep "Chain ID:" | head -n 1 | awk '{print $3}' | tr -d '\r\n')
echo "   Chain ID: $CHAIN_ID"

# ========================================
# BUILD CONTRACTS
# ========================================
echo "🔹 Building contracts..."
cd /app/contracts
cargo build --release --target wasm32-unknown-unknown
cd /app

# ========================================
# DEPLOY APPLICATION
# ========================================
echo "🔹 Deploying application..."
DEPLOY_OUTPUT=$(linera publish-and-create \
  contracts/target/wasm32-unknown-unknown/release/contracts_contract.wasm \
  contracts/target/wasm32-unknown-unknown/release/contracts_service.wasm \
  --json-parameters "{\"bank_chain_id\":\"$CHAIN_ID\"}" \
  --json-argument '{"starting_balance": 100, "random_seed": 12345}')

echo "$DEPLOY_OUTPUT"
APP_ID=$(echo "$DEPLOY_OUTPUT" | tail -n 1 | tr -d '\r\n')

if [ -z "$APP_ID" ]; then
    echo "❌ Failed to extract App ID!"
    exit 1
fi
echo "   App ID: $APP_ID"

# ========================================
# UPDATE CONSTANTS (portable Node.js approach)
# ========================================
echo "🔹 Updating src/constants.ts..."
node /app/docker/update-constants.mjs "$APP_ID" "$CHAIN_ID"
echo "✅ Constants updated!"

# ========================================
# START LINERA SERVICE
# ========================================
echo "🔹 Starting Linera Service on port 8081..."
linera service --port 8081 > /app/service.log 2>&1 &
sleep 2

# ========================================
# INSTALL FRONTEND DEPENDENCIES
# ========================================
echo "🔹 Installing frontend dependencies..."
cd /app
npm install

# ========================================
# START FRONTEND
# ========================================
echo "🔹 Starting frontend server..."
echo "========================================"
echo "🎰 Casino is running!"
echo "   Frontend: http://localhost:5173"
echo "   Faucet:   http://localhost:8080"
echo "   Service:  http://localhost:8081"
echo "   App ID:   $APP_ID"
echo "   Chain ID: $CHAIN_ID"
echo "========================================"

# Use pre-built dist if available, otherwise dev server
if [ -d "/app/dist" ]; then
    echo "✅ Using pre-built static files (faster)"
    npm run preview -- --host 0.0.0.0 --port 5173
else
    echo "⚠️ No pre-built files, using dev server"
    npm run dev -- --host 0.0.0.0
fi
