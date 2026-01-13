// Determine environment based on hostname
const hostname = typeof window !== 'undefined' ? window.location.hostname : 'localhost';

export const isTestnet = hostname === 'linera.click' || hostname === 'www.linera.click';
export const NETWORK_NAME = isTestnet ? 'Conway Testnet' : 'Local Devnet';

// URL configuration based on environment
export const LINERA_FAUCET_URL = isTestnet
    ? "https://faucet.testnet-conway.linera.net"  // Direct testnet faucet
    : "http://localhost:8080";                     // Local devnet

export const LINERA_SERVICE_URL = isTestnet
    ? `${window.location.origin}/api`       // Testnet via nginx proxy
    : "http://localhost:8081";              // Local devnet

// Legacy alias
export const LINERA_RPC_URL = LINERA_FAUCET_URL;

// Cross-chain casino app
// For testnet (linera.click): uses pre-deployed contract
// For local devnet: auto-updated by entrypoint.sh
export const APP_ID = isTestnet
    ? "74b7491ca9d1b7eb49b260ebbe8acaaa6e67011772915daa737664bba5962020"
    : "PLACEHOLDER_APP_ID";

export const BANK_CHAIN_ID = isTestnet
    ? "22a92babed77fbddef55307c876673f74dd5250fea77405087f70af698ec199b"
    : "PLACEHOLDER_BANK_CHAIN_ID";

// Legacy alias (for compatibility with existing code)
export const CONTRACTS_APP_ID = APP_ID;

export const DEPLOYER_ADDRESS = "0xef4a68d80af8ae3082ef5549f2fc8a5bb930f3a0f6e69333e0b0af925efe2986";