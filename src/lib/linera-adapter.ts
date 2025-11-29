import initLinera, {
  Faucet,
  Client,
  Wallet,
  Application,
} from "@linera/client";
import type { Wallet as DynamicWallet } from "@dynamic-labs/sdk-react-core";
import { DynamicSigner } from "./dynamic-signer";

export interface LineraProvider {
  client: Client;
  wallet: Wallet;
  faucet: Faucet;
  address: string;
  chainId: string;
}

export class LineraAdapter {
  private static instance: LineraAdapter | null = null;
  private provider: LineraProvider | null = null;
  private application: Application | null = null;
  private wasmInitPromise: Promise<unknown> | null = null;
  private connectPromise: Promise<LineraProvider> | null = null;

  private constructor() { }

  static getInstance(): LineraAdapter {
    if (!LineraAdapter.instance) LineraAdapter.instance = new LineraAdapter();
    return LineraAdapter.instance;
  }

  async connect(
    dynamicWallet: DynamicWallet,
    rpcUrl: string
  ): Promise<LineraProvider> {
    if (this.provider) return this.provider;
    if (this.connectPromise) return this.connectPromise;

    if (!dynamicWallet) {
      throw new Error("Dynamic wallet is required for Linera connection");
    }

    try {
      this.connectPromise = (async () => {
        const { address } = dynamicWallet;
        console.log("🔗 Connecting with Dynamic wallet:", address);

        try {
          if (!this.wasmInitPromise) this.wasmInitPromise = initLinera();
          await this.wasmInitPromise;
          console.log("✅ Linera WASM modules initialized successfully");
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          if (msg.includes("storage is already initialized")) {
            console.warn(
              "⚠️ Linera storage already initialized; continuing without re-init"
            );
          } else {
            throw e;
          }
        }

        console.log("🔗 Connecting to Linera Faucet:", rpcUrl);
        const faucet = await new Faucet(rpcUrl);
        const wallet = await faucet.createWallet();
        // Reverting to 2 arguments as the previous code worked with 2.
        // Casting to any to bypass conflicting lint errors (some say 2, some say 3).
        const chainId = await faucet.claimChain(wallet, address);

        const signer = await new DynamicSigner(dynamicWallet);
        const client = await new Client(wallet, signer);
        console.log("✅ Linera wallet created successfully!");

        this.provider = {
          client,
          wallet,
          faucet,
          chainId,
          address: dynamicWallet.address,
        };

        this.notifyListeners();
        return this.provider;
      })();

      const provider = await this.connectPromise;
      return provider;
    } catch (error) {
      console.error("Failed to connect to Linera:", error);
      throw new Error(
        `Failed to connect to Linera network: ${error instanceof Error ? error.message : "Unknown error"
        }`
      );
    } finally {
      this.connectPromise = null;
    }
  }

  async setApplication(appId: string) {
    if (!this.provider) throw new Error("Not connected to Linera");
    if (!appId) throw new Error("Application ID is required");

    // Use client.frontend().application(appId) as per official docs
    const application = await this.provider.client
      .frontend()
      .application(appId);

    if (!application) throw new Error("Failed to get application");
    console.log("✅ Linera application set successfully!");
    this.application = application;
    this.notifyListeners();
  }

  async queryApplication<T>(query: string, variables?: Record<string, any>): Promise<T> {
    if (!this.application) throw new Error("Application not set");

    const queryJson = variables ? JSON.stringify({ query, variables }) : JSON.stringify({ query });
    const result = await this.application.query(queryJson);
    const response = JSON.parse(result);

    if (response.errors) {
      console.error("GraphQL Errors:", response.errors);
      throw new Error(response.errors[0].message);
    }

    console.log("✅ Linera application queried successfully!");
    return response.data as T;
  }

  getProvider(): LineraProvider {
    if (!this.provider) throw new Error("Provider not set");
    return this.provider;
  }

  getFaucet(): Faucet {
    if (!this.provider?.faucet) throw new Error("Faucet not set");
    return this.provider.faucet;
  }

  getWallet(): Wallet {
    if (!this.provider?.wallet) throw new Error("Wallet not set");
    return this.provider.wallet;
  }

  getApplication(): Application {
    if (!this.application) throw new Error("Application not set");
    return this.application;
  }

  identity(): string {
    if (!this.provider) throw new Error("Not connected to Linera");
    return this.provider.address;
  }

  isChainConnected(): boolean {
    return this.provider !== null;
  }

  isApplicationSet(): boolean {
    return this.application !== null;
  }

  private listeners = new Set<() => void>();

  private notifyListeners() {
    this.listeners.forEach((listener) => listener());
  }

  subscribe(callback: () => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  // Deprecated: kept for backward compatibility if needed, but mapped to subscribe
  onConnectionStateChange(callback: () => void): void {
    this.subscribe(callback);
  }

  offConnectionStateChange(): void {
    this.listeners.clear();
  }

  resetApplication(): void {
    this.application = null;
    this.notifyListeners();
  }

  reset(): void {
    this.application = null;
    this.provider = null;
    this.connectPromise = null;
    this.notifyListeners();
  }
}

// Export singleton instance
export const lineraAdapter = LineraAdapter.getInstance();