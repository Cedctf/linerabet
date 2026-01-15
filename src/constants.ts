// Network configuration - reads from environment variables
// Set automatically by Docker entrypoints or manually in .env.local

// Network mode: "devnet" or "testnet"
const NETWORK_MODE = import.meta.env.VITE_NETWORK_MODE || "testnet";

// Network-specific URLs based on mode
const DEVNET_CONFIG = {
    faucetUrl: "http://localhost:8080",
    serviceUrl: "http://localhost:8081",
};

const TESTNET_CONFIG = {
    faucetUrl: "https://faucet.testnet-conway.linera.net",
    serviceUrl: "https://faucet.testnet-conway.linera.net",
};

const config = NETWORK_MODE === "devnet" ? DEVNET_CONFIG : TESTNET_CONFIG;

// Exported constants - URLs determined by network mode
export const LINERA_FAUCET_URL = config.faucetUrl;
export const LINERA_SERVICE_URL = config.serviceUrl;
export const LINERA_RPC_URL = LINERA_FAUCET_URL;

// Application IDs - replaced by docker/update-constants.mjs
export const APP_ID = "09944ad5e700e0d5bddfb52d02cc60e47449512d1308747b9356c4b91d5f1784";
export const BANK_CHAIN_ID = "5c2f5406ea1608532a824c0f58549a3cd3ca66c099e18457681f88195299da22";

// Legacy alias (for compatibility with existing code)
export const CONTRACTS_APP_ID = APP_ID;

export const DEPLOYER_ADDRESS = "0xef4a68d80af8ae3082ef5549f2fc8a5bb930f3a0f6e69333e0b0af925efe2986";
