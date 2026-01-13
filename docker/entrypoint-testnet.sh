#!/usr/bin/env bash
set -e

echo "🔹 Starting Linera Casino (TESTNET MODE)..."

# Source nvm to get node/npm
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

cd /app

# ========================================
# INITIALIZE WALLET FOR TESTNET
# ========================================
echo "🔹 Setting up testnet wallet..."
rm -rf /root/.config/linera

# Initialize with testnet faucet
linera wallet init --faucet https://faucet.testnet-conway.linera.net
linera wallet request-chain --faucet https://faucet.testnet-conway.linera.net

# Get Chain ID
CHAIN_ID=$(linera wallet show | grep "Chain ID:" | head -n 1 | awk '{print $3}' | tr -d '\r\n')
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
# START LINERA SERVICE (processes cross-chain messages)
# ========================================
echo "🔹 Starting Linera Service on port 8081..."
linera service --port 8081 > /app/service.log 2>&1 &
sleep 2
echo "✅ Linera Service started!"

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
echo "   App ID:   $APP_ID"
echo "   Bank Chain: $CHAIN_ID"
echo "========================================"

# Use pre-built dist if available, otherwise dev server
if [ -d "/app/dist" ]; then
    echo "✅ Using pre-built static files (faster)"
    npm run preview -- --host 0.0.0.0 --port 5173
else
    echo "⚠️ No pre-built files, using dev server"
    npm run dev -- --host 0.0.0.0
fi
