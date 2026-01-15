import * as lineraPkg from "@linera/client";
import type { Wallet as DynamicWallet } from "@dynamic-labs/sdk-react-core";
import { DynamicSigner } from "./dynamic-signer";

// Handle different export structures (default vs named initialize)
const initLinera = (lineraPkg as any).default || (lineraPkg as any).initialize;
const { Faucet, Client } = lineraPkg;

// Helper types inferred from usage since constructors might be private
type LineraClient = InstanceType<typeof lineraPkg.Client>;
type LineraFaucet = InstanceType<typeof lineraPkg.Faucet>;
type LineraWallet = Awaited<ReturnType<LineraFaucet["createWallet"]>>;
// Note: client.application() returns a Promise<Application>
// Using 'any' to handle dynamic API changes in @linera/client
type LineraApplication = any;

export interface LineraProvider {
  client: LineraClient;
  wallet: LineraWallet;
  faucet: LineraFaucet;
  address: string;
  chainId: string;
}

export class LineraAdapter {
  private static instance: LineraAdapter | null = null;
  private provider: LineraProvider | null = null;
  private application: LineraApplication | null = null;
  private appId: string | null = null;
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
        // Defensive check: ensure dynamicWallet has required properties
        if (!dynamicWallet || typeof dynamicWallet.address !== 'string') {
          throw new Error("Dynamic wallet is not properly initialized - missing address");
        }

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
        console.log("✅ Chain claimed:", chainId);

        // Wait for chain creation to propagate
        await new Promise(resolve => setTimeout(resolve, 5000));

        // Note: DynamicSigner constructor is synchronous, no await needed
        const signer = new DynamicSigner(dynamicWallet);
        const client = await new (Client as any)(wallet, signer, false);
        console.log("✅ Linera wallet created successfully!");

        // Debug logging
        try {
          console.log("🔍 Client keys:", Object.keys(client));
          console.log("🔍 Client prototype:", Object.getPrototypeOf(client));
        } catch (e) {
          console.warn("Could not inspect client:", e);
        }

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

    // Use client.application(appId) directly (v0.15.x API)
    const application = await (this.provider.client as any).application(appId);

    if (!application) throw new Error("Failed to get application");
    console.log("✅ Linera application set successfully!");

    // Debug logging
    try {
      console.log("🔍 Application keys:", Object.keys(application));
      console.log("🔍 Application prototype:", Object.getPrototypeOf(application));
    } catch (e) {
      console.warn("Could not inspect application:", e);
    }

    this.application = application;
    this.appId = appId;
    this.notifyListeners();
  }

  getAppId(): string | null {
    return this.appId;
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

  async mutate(mutation: string, variables?: Record<string, any>): Promise<any> {
    if (!this.application) throw new Error("Application not set");

    console.log("🚀 Sending mutation:", mutation);
    if (variables) console.log("📦 Variables:", variables);

    const payload = variables ? { query: mutation, variables } : { query: mutation };
    const result = await this.application.query(JSON.stringify(payload));
    const response = JSON.parse(result);

    if (response.errors) {
      console.error("GraphQL Errors:", response.errors);
      throw new Error(response.errors[0].message);
    }

    console.log("✅ Mutation executed successfully!", response.data);
    return response.data;
  }

  getProvider(): LineraProvider {
    if (!this.provider) throw new Error("Provider not set");
    return this.provider;
  }

  getFaucet(): LineraFaucet {
    if (!this.provider?.faucet) throw new Error("Faucet not set");
    return this.provider.faucet;
  }

  getWallet(): LineraWallet {
    if (!this.provider?.wallet) throw new Error("Wallet not set");
    return this.provider.wallet;
  }

  getApplication(): LineraApplication {
    if (!this.application) throw new Error("Application not set");
    return this.application;
  }

  get client(): LineraClient {
    if (!this.provider?.client) throw new Error("Client not set");
    return this.provider.client;
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
    this.appId = null;
    this.notifyListeners();
  }

  reset(): void {
    this.application = null;
    this.appId = null;
    this.provider = null;
    this.connectPromise = null;
    this.notifyListeners();
  }
}

// Export singleton instance
export const lineraAdapter = LineraAdapter.getInstance();