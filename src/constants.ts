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
export const APP_ID = "3d9cc75aa22d6eecface7f5f471d0e72b7da19faf848af764ae1ae99e82d90ef";
export const BANK_CHAIN_ID = "df4a3b4338cb1e15c2fef183296228b089022b4ad723a9801e4c6508da29da01";

// Legacy alias (for compatibility with existing code)
export const CONTRACTS_APP_ID = APP_ID;

export const DEPLOYER_ADDRESS = "0xef4a68d80af8ae3082ef5549f2fc8a5bb930f3a0f6e69333e0b0af925efe2986";
