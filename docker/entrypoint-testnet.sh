#!/usr/bin/env bash
set -e

echo "🔹 Starting Linera Casino (TESTNET MODE)..."
echo "   Conway Testnet - https://faucet.testnet-conway.linera.net"

# Source nvm to get node/npm
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

cd /app

# ========================================
# CLEAN UP OLD WALLET STATE
# ========================================
echo "🔹 Cleaning up old wallet state..."
rm -rf /root/.config/linera
rm -rf /data/linera/*
mkdir -p /data/linera

# ========================================
# INITIALIZE WALLET FOR TESTNET
# ========================================
echo "🔹 Setting up testnet wallet..."

FAUCET_URL="https://faucet.testnet-conway.linera.net"

# Initialize with testnet faucet
linera wallet init --faucet "$FAUCET_URL"

# Request a chain from testnet faucet
echo "🔹 Requesting chain from testnet faucet..."
linera wallet request-chain --faucet "$FAUCET_URL"

# Get Chain ID (this will be the Bank Chain)
CHAIN_ID=$(linera wallet show | grep "Chain ID:" | head -n 1 | awk '{print $3}' | tr -d '\r\n')

if [ -z "$CHAIN_ID" ]; then
    echo "❌ Failed to get Chain ID!"
    exit 1
fi
echo "   Bank Chain ID: $CHAIN_ID"

# ========================================
# BUILD CONTRACTS
# ========================================
echo "🔹 Building contracts..."
cd /app/contracts
cargo build --release --target wasm32-unknown-unknown
cd /app

# ========================================
# DEPLOY APPLICATION TO TESTNET
# ========================================
echo "🔹 Deploying application to testnet..."
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
# UPDATE CONSTANTS
# ========================================
echo "🔹 Updating src/constants.ts..."
node /app/docker/update-constants.mjs "$APP_ID" "$CHAIN_ID"
echo "✅ Constants updated!"

# ========================================
# START LINERA SERVICE
# ========================================
echo "🔹 Starting Linera Service on port 8081..."
linera service --port 8081 > /app/service.log 2>&1 &
LINERA_PID=$!

# Wait for service to be ready
sleep 3
if ! kill -0 $LINERA_PID 2>/dev/null; then
    echo "❌ Linera service failed to start!"
    cat /app/service.log
    exit 1
fi
echo "✅ Linera Service started (PID: $LINERA_PID)"

# ========================================
# INSTALL FRONTEND DEPENDENCIES
# ========================================
echo "🔹 Installing frontend dependencies..."
npm install

# ========================================
# START FRONTEND
# ========================================
echo "🔹 Starting frontend server..."
echo "========================================"
echo "🎰 Casino is running on Conway Testnet!"
echo "   Frontend: http://localhost:5173"
echo "   Service:  http://localhost:8081"
echo "   Faucet:   $FAUCET_URL"
echo "   App ID:   $APP_ID"
echo "   Bank Chain: $CHAIN_ID"
echo "========================================"

npm run dev -- --host 0.0.0.0
