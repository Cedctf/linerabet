import type { Signer } from "@linera/client";
import type { Wallet as DynamicWallet } from "@dynamic-labs/sdk-react-core";
import { isEthereumWallet } from "@dynamic-labs/ethereum";

/**
 * DynamicSigner - Implements the Linera Signer interface using Dynamic Labs wallet.
 * 
 * IMPORTANT: Methods are bound in constructor to ensure correct `this` context
 * when called from WASM modules (they pass methods as callbacks).
 */
export class DynamicSigner implements Signer {
  private dynamicWallet: DynamicWallet;

  constructor(dynamicWallet: DynamicWallet) {
    if (!dynamicWallet) {
      throw new Error("DynamicSigner: dynamicWallet is required");
    }
    if (typeof dynamicWallet.address !== 'string') {
      throw new Error("DynamicSigner: dynamicWallet.address must be a string");
    }

    this.dynamicWallet = dynamicWallet;

    // CRITICAL: Bind all methods to this instance
    // WASM modules call these methods as callbacks, losing `this` context
    this.address = this.address.bind(this);
    this.containsKey = this.containsKey.bind(this);
    this.sign = this.sign.bind(this);

    console.log("✅ DynamicSigner initialized for address:", dynamicWallet.address);
  }

  async address(): Promise<string> {
    const addr = this.dynamicWallet.address;
    if (!addr) {
      throw new Error("DynamicSigner.address: wallet address is undefined");
    }
    return addr;
  }

  async containsKey(owner: string): Promise<boolean> {
    if (!owner || typeof owner !== 'string') {
      console.warn("DynamicSigner.containsKey: invalid owner parameter", owner);
      return false;
    }
    const walletAddress = this.dynamicWallet.address;
    if (!walletAddress) {
      return false;
    }
    return owner.toLowerCase() === walletAddress.toLowerCase();
  }

  async sign(owner: string, value: Uint8Array): Promise<string> {
    const address: `0x${string}` = owner as `0x${string}`;
    const primaryWallet = this.dynamicWallet.address;

    if (!primaryWallet) {
      throw new Error("DynamicSigner.sign: No primary wallet address found");
    }

    if (!owner) {
      throw new Error("DynamicSigner.sign: owner parameter is required");
    }

    if (owner.toLowerCase() !== primaryWallet.toLowerCase()) {
      throw new Error(`DynamicSigner.sign: Owner ${owner} does not match wallet ${primaryWallet}`);
    }

    try {
      const msgHex: `0x${string}` = `0x${uint8ArrayToHex(value)}`;

      // IMPORTANT: The value parameter is already pre-hashed, and the standard `signMessage`
      // method would hash it again, resulting in a double-hash. To avoid this, we bypass
      // the standard signing flow and use `personal_sign` directly on the wallet client.
      // DO NOT USE: this.dynamicWallet.signMessage(msgHex) - it would cause double-hashing

      // Note: First cast the wallet to an Ethereum wallet to get the wallet client
      if (!isEthereumWallet(this.dynamicWallet)) {
        throw new Error("DynamicSigner.sign: Wallet is not an Ethereum wallet");
      }

      const walletClient = await this.dynamicWallet.getWalletClient();
      const signature = await walletClient.request({
        method: "personal_sign",
        params: [msgHex, address],
      });

      if (!signature) {
        throw new Error("DynamicSigner.sign: Failed to get signature from wallet");
      }

      return signature;
    } catch (error: any) {
      console.error("DynamicSigner.sign failed:", error);
      throw new Error(
        `Dynamic signature request failed: ${error?.message || error}`
      );
    }
  }
}

function uint8ArrayToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b: number) => b.toString(16).padStart(2, "0"))
    .join("");
}
