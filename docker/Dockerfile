FROM rust:1.86-slim

SHELL ["bash", "-c"]

# Install system dependencies
RUN apt-get update && apt-get install -y \
    pkg-config \
    protobuf-compiler \
    clang \
    make \
    curl \
    git \
    jq \
    && rm -rf /var/lib/apt/lists/*

# Install Linera CLI tools (v0.15.8)
RUN cargo install --locked linera-service@0.15.8 linera-storage-service@0.15.8

# Add wasm32 target for contract compilation
RUN rustup target add wasm32-unknown-unknown

# Install Node.js via nvm
RUN curl https://raw.githubusercontent.com/creationix/nvm/v0.40.3/install.sh | bash \
    && . ~/.nvm/nvm.sh \
    && nvm install 22 \
    && npm install -g pnpm

# Environment: Isolate Linera state to /data/linera (never touches host ~/.config/linera)
ENV LINERA_HOME=/data/linera
ENV NVM_DIR=/root/.nvm
ENV PATH="/root/.nvm/versions/node/v22.14.0/bin:$PATH"

# Working directory for application code
WORKDIR /app

# Create data directory for Linera state
RUN mkdir -p /data/linera

# Expose ports
EXPOSE 5173 8080 8081 9001 13001

# Healthcheck - verify frontend or faucet is running
HEALTHCHECK --interval=10s --timeout=5s --start-period=60s --retries=3 \
    CMD curl -sf http://localhost:5173 || curl -sf http://localhost:8080 || exit 1

# Default command - keeps container running so you can exec into it
CMD ["bash", "-c", "echo '🚀 Container ready. Use docker exec -it linera-dev bash to interact.' && tail -f /dev/null"]
