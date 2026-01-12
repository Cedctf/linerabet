#!/bin/bash

# Exit on error
set -e

echo "🔹 Cleaning up old processes..."
pkill -f linera || true
rm -rf ~/.config/linera

echo "🔹 Starting Linera Net (Background)..."
# Start net in background, redirect log to file
linera net up --with-faucet --faucet-port 8080 --testing-prng-seed 37 > net.log 2>&1 &
NET_PID=$!

echo "   Waiting for network to be ready..."
# Wait for the faucet to be responsive
count=0
while ! curl -s http://localhost:8080 > /dev/null; do
    sleep 1
    count=$((count+1))
    if [ $count -ge 30 ]; then
        echo "❌ Network timed out!"
        exit 1
    fi
done
echo "✅ Network is up!"
linera wallet init --faucet http://localhost:8080
linera wallet request-chain --faucet http://localhost:8080

echo "🔹 Fetching Chain ID..."
# Extract chain ID from 'linera wallet show' (assuming it's the first hex string or using grep)
# 'linera wallet show' output format:
# Chain ID: 6b70...
CHAIN_ID=$(linera wallet show | grep "Chain ID:" | head -n 1 | awk '{print $3}' | tr -d '\r\n')
echo "   Chain ID: $CHAIN_ID"

echo "🔹 Building Contracts..."
cd contracts
cargo build --release --target wasm32-unknown-unknown
cd ..

echo "🔹 Deploying Application..."
# We need to capture the output to get the App ID
# The command output usually ends with "Created application <APP_ID>"
DEPLOY_OUTPUT=$(linera publish-and-create \
  contracts/target/wasm32-unknown-unknown/release/contracts_contract.wasm \
  contracts/target/wasm32-unknown-unknown/release/contracts_service.wasm \
  --json-parameters "{\"bank_chain_id\":\"$CHAIN_ID\"}" \
  --json-argument '{"starting_balance": 100, "random_seed": 12345}')

echo "$DEPLOY_OUTPUT"

# Extract App ID. It's usually the last word of the output "Created application <APP_ID>"
# User confirmed the last line is the App ID
APP_ID=$(echo "$DEPLOY_OUTPUT" | tail -n 1 | tr -d '\r\n')

if [ -z "$APP_ID" ]; then
    echo "❌ Failed to extract App ID from deployment output."
    exit 1
fi

echo "   App ID: $APP_ID"

echo "🔹 Updating src/constants.ts..."
# Update constants.ts
CONSTANTS_FILE="src/constants.ts"

# Use sed to replace the values
# Note: simple sed might fail if file doesn't match exactly, but based on user file it should work
sed -i "s/export const APP_ID = \".*\";/export const APP_ID = \"$APP_ID\";/" "$CONSTANTS_FILE"
sed -i "s/export const BANK_CHAIN_ID = \".*\";/export const BANK_CHAIN_ID = \"$CHAIN_ID\";/" "$CONSTANTS_FILE"

echo "✅ Configuration updated!"
echo "   APP_ID: $APP_ID"
echo "   BANK_CHAIN_ID: $CHAIN_ID"

echo "========================================================"
echo "🚀 Deployment Complete!"
echo "========================================================"


# ------------------------------------------------------------------
# RUNNING SERVICES
# ------------------------------------------------------------------

# Trap Ctrl+C (SIGINT) to kill background processes when usage is done
trap "trap - SIGINT && kill -- -$$" SIGINT TERM EXIT

echo "🔹 Starting Linera Service (Background, Port 8081)..."
linera service --port 8081 > service.log 2>&1 &
SERVICE_PID=$!
echo "   Service running (PID: $SERVICE_PID). Logs in service.log"

echo "   Waiting 2 seconds..."
sleep 2

echo "🔹 Starting Frontend (npm run dev)..."
echo "========================================================"
echo "📝 LOGGING INFO:"
echo "   - Network Logs: net.log"
echo "   - Service Logs: service.log"
echo "   - Frontend Logs: (Displayed below)"
echo "👉 Press Ctrl+C to stop ALL services (Network, Service, Frontend)."
echo "========================================================"

npm run dev
