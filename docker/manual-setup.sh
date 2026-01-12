#!/usr/bin/env bash
# ============================================================
# Manual Setup Commands for Linera Development
# ============================================================
# Run these commands step-by-step inside the container:
#   docker exec -it linera-dev bash
#
# Or run this script directly for a quick reference:
#   bash /app/docker/manual-setup.sh
# ============================================================

cat << 'EOF'
========================================
🔧 Linera Manual Setup Commands
========================================

1️⃣  Start the network (run in background):
    eval "$(linera net helper)"
    linera_spawn linera net up --with-faucet --faucet-port 8080 --testing-prng-seed 37

2️⃣  Wait for faucet to be ready:
    while ! curl -s http://localhost:8080 > /dev/null; do sleep 1; done
    echo "Faucet ready!"

3️⃣  Initialize wallet:
    linera wallet init --faucet http://localhost:8080
    linera wallet request-chain --faucet http://localhost:8080

4️⃣  Get Chain ID:
    CHAIN_ID=$(linera wallet show | grep 'Chain ID:' | head -n 1 | awk '{print $3}')
    echo "Chain ID: $CHAIN_ID"

5️⃣  Build contracts:
    cd /app/contracts
    cargo build --release --target wasm32-unknown-unknown
    cd /app

6️⃣  Deploy application:
    linera publish-and-create \
      contracts/target/wasm32-unknown-unknown/release/contracts_contract.wasm \
      contracts/target/wasm32-unknown-unknown/release/contracts_service.wasm \
      --json-parameters "{\"bank_chain_id\":\"$CHAIN_ID\"}" \
      --json-argument '{"starting_balance": 100, "random_seed": 12345}'
    
    # Copy the APP_ID from the output (last line)

7️⃣  Update constants (replace <APP_ID> with actual value):
    node /app/docker/update-constants.mjs <APP_ID> $CHAIN_ID

8️⃣  Start Linera service:
    linera service --port 8081 &

9️⃣  Install dependencies and start frontend:
    npm install
    npm run dev -- --host 0.0.0.0

========================================
📝 Quick one-liner (if you want everything at once):
    bash /app/docker/entrypoint.sh
========================================
EOF
