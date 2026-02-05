// Network configuration - reads from environment variables
// Set automatically by Docker entrypoints or manually in .env.local

// Network mode: "devnet" or "testnet"
const NETWORK_MODE = import.meta.env.VITE_NETWORK_MODE || "testnet";

// Export network mode for UI display
export const CURRENT_NETWORK = NETWORK_MODE;

// Network-specific URLs based on mode
const DEVNET_CONFIG = {
    faucetUrl: "http://localhost:8080",
    serviceUrl: "http://localhost:8081",
};

const TESTNET_CONFIG = {
    faucetUrl: "https://faucet.testnet-conway.linera.net",
    serviceUrl: "http://localhost:8081",
};

const config = NETWORK_MODE === "devnet" ? DEVNET_CONFIG : TESTNET_CONFIG;

// Exported constants - URLs determined by network mode
export const LINERA_FAUCET_URL = config.faucetUrl;
export const LINERA_SERVICE_URL = config.serviceUrl;
export const LINERA_RPC_URL = LINERA_FAUCET_URL;

// Application IDs - replaced by docker/update-constants.mjs
export const APP_ID = "16c91c60b28644460394ec5a03df228c6f0e1d576425ca1bb62d3f209abdbfc8";
export const BANK_CHAIN_ID = "7518edc4d1a916f3592edec239c4c2ea511cef896abc24be81cd4e96ee661bfe";

// Legacy alias (for compatibility with existing code)
export const CONTRACTS_APP_ID = APP_ID;

export const DEPLOYER_ADDRESS = "0xef4a68d80af8ae3082ef5549f2fc8a5bb930f3a0f6e69333e0b0af925efe2986";
