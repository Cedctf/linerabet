#!/usr/bin/env bash
set -e

echo "🔹 Starting Linera Casino (Testnet Mode)..."

# Source nvm to get node/npm
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

cd /app

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
echo "   Testnet Faucet: https://faucet.testnet-conway.linera.net"
echo "========================================"

# Use pre-built dist if available, otherwise dev server
if [ -d "/app/dist" ]; then
    echo "✅ Using pre-built static files (faster)"
    npm run preview -- --host 0.0.0.0 --port 5173
else
    echo "⚠️ No pre-built files, using dev server"
    npm run dev -- --host 0.0.0.0
fi
