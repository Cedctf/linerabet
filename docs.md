# LineraBet — Developer Guide & Documentation

> A comprehensive guide to understanding Linera, building smart contracts, and integrating them with modern frontends. This guide covers everything from the basic "Counter" example to the full "Blackjack" DApp with Dynamic Wallet integration.

---

## Table of Contents

1.  [What is Linera?](#what-is-linera)
2.  [Core Concepts](#core-concepts)
3.  [Setting Up](#setting-up-testnet-vs-local-net)
4.  [CLI Reference](#cli-reference-common-tasks)
5.  [Example 1: The Counter (Basic Smart Contract)](#example-1-the-counter-basic-smart-contract)
6.  [Example 2: Blackjack (Full DApp with Frontend)](#example-2-blackjack-full-dapp-with-frontend)
7.  [Dynamic Wallet Integration](#dynamic-wallet-integration)
8.  [Deployment & Workflow](#deployment--workflow)
9.  [Troubleshooting & FAQ](#troubleshooting--faq)

---

## What is Linera?

Linera is a Web3 protocol that scales by splitting state and execution across many **microchains** that all share the same validator set and security. Instead of a single global blockchain, Linera lets you create chains on demand—often one per user or per app—which can exchange messages asynchronously. Applications run as WebAssembly (Wasm) modules, typically authored in **Rust** (backend) and **TypeScript** (frontend), and are queried via **GraphQL**.

### Key properties

*   **Microchains**: Lightweight chains of blocks, each owned by one or more users or made public. Creating a new microchain costs one transaction on an existing chain.
*   **Shared security**: All microchains are secured by the same validators.
*   **Asynchronous cross-chain messaging**: Chains exchange messages via per‑pair inboxes with preserved order.
*   **Wallet-driven blocks**: Wallets don’t just sign transactions; they **propose blocks** to extend their chains.
*   **Two-part apps**: A gas‑metered **contract** that mutates state and a non‑metered **service** that answers read‑only GraphQL queries.

---

## Core Concepts

### Microchains at a glance

A **microchain** is a sequence of blocks that modifies shared state. There can be arbitrarily many microchains in one network.

*   **Single‑owner**: One super-owner can propose fast‑round blocks with very low latency.
*   **Multi‑owner**: Several owners can propose blocks (multi‑leader rounds).
*   **Public**: Anyone may be able to propose blocks depending on configuration.

### Cross-chain messaging

Apps running on different microchains communicate via **asynchronous messages**:

*   Messages are delivered to the target chain’s **inbox**.
*   Ordering between any two chains is preserved.
*   Messages can carry **authentication** that propagates from the original block signer.

### Wallets

*   A developer wallet stores keys and the tracked subset of chains, and runs a local node that exposes **GraphQL**.
*   Default files: `wallet.json` (private wallet state), `keystore.json` (keys), `wallet.db` (storage).

### Node service

Running `linera service` starts a local node that:

*   Executes blocks for owned chains.
*   Exposes a **GraphQL API** + GraphiQL IDE at `http://localhost:8080`.
*   Serves per‑application endpoints: `/chains/<chain-id>/applications/<application-id>`.

---

## Setting Up: Testnet vs Local Net

### Latest public Testnet ("Conway")

```bash
linera wallet init --faucet https://faucet.testnet-conway.linera.net
linera wallet request-chain --faucet https://faucet.testnet-conway.linera.net
```

### Local development network

Start a single‑validator local net with a faucet:

```bash
linera net up --with-faucet --faucet-port 8080
```

Create a developer wallet and a chain using the faucet:

```bash
linera wallet init --faucet http://localhost:8080
linera wallet request-chain --faucet http://localhost:8080
```

---

## CLI Reference (Common Tasks)

### Inspect & manage chains

```bash
# List chains in the current wallet (default chain is green)
linera wallet show

# Set default chain
linera wallet set-default <chain-id>

# Open a new chain for yourself
linera open-chain
```

### Run the node service (GraphQL)

```bash
linera service --port 8080
# Open http://localhost:8080 for GraphiQL
```

---

## Example 1: The Counter (Basic Smart Contract)

This example demonstrates the fundamental structure of a Linera application using a simple Counter. It focuses on the **Rust** implementation.

### 1. Scaffold a project

```bash
linera project new my-counter
```

This creates `src/lib.rs` (ABI), `src/state.rs` (State), `src/contract.rs` (Logic), and `src/service.rs` (API).

### 2. Model the state (`src/state.rs`)

We use `RegisterView` to store a single value.

```rust
#[derive(RootView, async_graphql::SimpleObject)]
#[view(context = ViewStorageContext)]
pub struct Counter {
    pub value: RegisterView<u64>,
}
```

### 3. Define the ABI (`src/lib.rs`)

The ABI defines the operations (mutations) and queries available.

```rust
pub struct CounterAbi;

impl ContractAbi for CounterAbi {
    type Operation = u64;      // The operation is just a number (the increment amount)
    type Response  = u64;      // Returns the new value
}

impl ServiceAbi for CounterAbi {
    type Query         = async_graphql::Request;
    type QueryResponse = async_graphql::Response;
}
```

### 4. Implement the contract (`src/contract.rs`)

The contract handles the **write** logic. It is gas-metered and deterministic.

```rust
linera_sdk::contract!(CounterContract);

// ... struct definition ...

#[async_trait]
impl Contract for CounterContract {
    type Message = ();
    type InstantiationArgument = u64; // Initial value

    async fn instantiate(&mut self, value: u64) {
        self.state.value.set(value);
    }

    async fn execute_operation(&mut self, inc: u64) -> u64 {
        let new_value = self.state.value.get() + inc;
        self.state.value.set(new_value);
        new_value
    }
    
    // ... other required methods (load, store, etc.) ...
}
```

### 5. Implement the service (`src/service.rs`)

The service handles the **read** logic via GraphQL.

```rust
linera_sdk::service!(CounterService);

#[async_trait]
impl Service for CounterService {
    async fn handle_query(&self, req: async_graphql::Request) -> async_graphql::Response {
        let schema = Schema::build(
            QueryRoot { value: *self.state.value.get() },
            MutationRoot { runtime: self.runtime.clone() },
            EmptySubscription,
        ).finish();
        schema.execute(req).await
    }
}

// Map GraphQL mutations to operations
#[async_graphql::Object]
impl MutationRoot {
    async fn increment(&self, value: u64) -> Vec<u8> {
        // This schedules the operation to be signed and included in a block
        self.runtime.schedule_operation(&value);
        vec![]
    }
}
```

---

## Example 2: Blackjack (Full DApp with Frontend)

This example demonstrates a production-ready DApp with a **React frontend**, **Dynamic Wallet** integration, and complex state management.

### Architecture Overview

*   **Frontend**: React + TypeScript + Tailwind CSS.
*   **Wallet**: Dynamic (Ethereum) -> Linera Adapter -> Linera Network.
*   **Contract**: Rust (Blackjack logic).
*   **Communication**: GraphQL (Queries for state, Mutations for actions).

### Smart Contract Highlights

Unlike the Counter, Blackjack has complex state and operations.

**Operations (`src/lib.rs`):**
```rust
#[derive(Debug, Deserialize, Serialize, GraphQLMutationRoot)]
pub enum Operation {
    Reset,
    StartGame { bet: u64 },
    Hit,
    Stand,
    RequestChips,
}
```

**Execution (`src/contract.rs`):**
The contract validates the signer and updates the player's specific game state.
```rust
async fn execute_operation(&mut self, operation: Self::Operation) -> Self::Response {
    let signer = self.runtime.authenticated_signer().expect("Signer required");
    let mut player = self.state.players.load_entry_mut(&signer).await.expect("Failed to load player");

    match operation {
        Operation::Hit => {
            if let Err(e) = Self::hit(player, &mut self.runtime) { panic!("{}", e); }
        }
        // ... other operations
    }
    Self::Response::default()
}
```

---

## Dynamic Wallet Integration

LineraBet uses a custom adapter to bridge Ethereum wallets (via Dynamic) to the Linera network.

### 1. The `DynamicSigner` (`src/lib/dynamic-signer.ts`)

This class implements the Linera `Signer` interface. It intercepts the signing request and uses the Ethereum wallet's `personal_sign` method.

**Critical Implementation Detail:**
Linera passes *already hashed* bytes to the signer. Standard `signMessage` functions often hash the input again, causing a "double hash" mismatch. We must use `personal_sign` directly or ensure we are signing raw bytes.

```typescript
async sign(owner: string, value: Uint8Array): Promise<string> {
    const msgHex: `0x${string}` = `0x${uint8ArrayToHex(value)}`;
    
    // Use personal_sign to avoid double-hashing issues
    const walletClient = await this.dynamicWallet.getWalletClient();
    return await walletClient.request({
        method: "personal_sign",
        params: [msgHex, address],
    });
}
```

### 2. The `LineraAdapter` (`src/lib/linera-adapter.ts`)

This singleton manages the lifecycle of the Linera client.

*   **Connect**: Initializes WASM, connects to Faucet, creates a Wallet, and attaches the `DynamicSigner`.
*   **Query**: Sends GraphQL queries to the application.
*   **Persist**: Maintains connection state across the app.

```typescript
// Connecting
const signer = await new DynamicSigner(dynamicWallet);
const client = await new Client(wallet, signer);

// Querying
const result = await this.application.query(JSON.stringify({ query }));
```

---

## Deployment & Workflow

### 1. Build the Contract

```bash
cd contracts/blackjack
cargo build --release --target wasm32-unknown-unknown
```

### 2. Deploy to Testnet

```bash
# Ensure you are in the root directory
linera publish-and-create \
  contracts/blackjack/target/wasm32-unknown-unknown/release/contracts_contract.wasm \
  contracts/blackjack/target/wasm32-unknown-unknown/release/contracts_service.wasm \
  --json-argument '{"starting_balance": 100, "random_seed": 0}'
```

### 3. Connect Frontend

1.  Copy the **Application ID** from the deployment output.
2.  Update `BLACKJACK_APP_ID` in `src/pages/blackjack.tsx`.
3.  Reload the frontend.

---

## Troubleshooting & FAQ

### "Blob not found"
*   **Cause**: The validator hasn't received the contract bytecode yet, or you are connected to the wrong network.
*   **Fix**: Run `linera sync --chain <CHAIN_ID>` or wait a few seconds. Ensure your `.env` points to the correct Faucet URL.

### "The block timestamp is in the future"
*   **Cause**: System clock drift.
*   **Fix**: Sync your system time (Settings -> Date & Time -> Sync Now).

### "Signature Invalid" / "Invalid Signer"
*   **Cause**: Double-hashing in the signer or mismatch between the wallet address and the signer address.
*   **Fix**: Ensure `DynamicSigner` uses `personal_sign` and that the `owner` matches the connected wallet.

### "Unknown type 'Owner'" in GraphQL
*   **Cause**: Using `Owner` type directly in GraphQL queries where `AccountOwner` is expected by the generated schema.
*   **Fix**: Check the schema (GraphiQL) and use the correct type (usually `AccountOwner` for Linera 0.12+).

---

*Happy shipping on Linera!*
