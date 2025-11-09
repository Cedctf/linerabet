# Linera — Quickstart & Developer Guide

> A compact, practical guide to understanding Linera, how it works, and how to build, run, and deploy your first Linera application (smart contract + service) using the CLI.

---

## What is Linera?

Linera is a Web3 protocol that scales by splitting state and execution across many **microchains** that all share the same validator set and security. Instead of a single global blockchain, Linera lets you create chains on demand—often one per user or per app—which can exchange messages asynchronously. Applications run as WebAssembly (Wasm) modules, typically authored in **Rust** (backend) and **TypeScript** (frontend), and are queried via **GraphQL**.

### Key properties

* **Microchains**: Lightweight chains of blocks, each owned by one or more users or made public. Creating a new microchain costs one transaction on an existing chain.
* **Shared security**: All microchains are secured by the same validators.
* **Asynchronous cross-chain messaging**: Chains exchange messages via per‑pair inboxes with preserved order (no reordering; messages may be skipped or rejected if invalid).
* **Wallet-driven blocks**: Wallets don’t just sign transactions; they **propose blocks** to extend their chains.
* **Two-part apps**: A gas‑metered **contract** that mutates state and a non‑metered **service** that answers read‑only GraphQL queries.

---

## Core Concepts

### Microchains at a glance

A **microchain** is a sequence of blocks that modifies shared state. There can be arbitrarily many microchains in one network. Ownership models:

* **Single‑owner**: One super-owner can propose fast‑round blocks with very low latency.
* **Multi‑owner**: Several owners can propose blocks (multi‑leader rounds) and optionally fall back to single‑leader rounds under contention.
* **Public**: Anyone may be able to propose blocks depending on configuration.

**Liveness** (new blocks are produced) depends on owners proposing blocks; **safety** (no forks at a given height) is guaranteed by validators.

### Cross-chain messaging

Apps running on different microchains communicate via **asynchronous messages**:

* Messages are delivered to the target chain’s **inbox** and later selected into a block by the target’s owner(s).
* Ordering between any two chains is preserved; a failing message is auto‑rejected.
* Messages can carry **authentication** that propagates from the original block signer, enabling safe actions on chains a user doesn’t own (e.g., claiming tokens held on an app chain).

### Wallets

* A developer wallet stores keys and the tracked subset of chains, and runs a local node that exposes **GraphQL**.
* Default files: `wallet.json` (private wallet state), `keystore.json` (or `keystore.db`, keys), `wallet.db` (node storage via RocksDB).
* You can run multiple wallets by pointing the CLI to different files or using environment variables (`LINERA_WALLET`, `LINERA_KEYSTORE`, `LINERA_STORAGE`).

### Node service

Running `linera service` starts a local node that:

* Executes blocks for owned chains
* Exposes a **GraphQL API** + GraphiQL IDE at `http://localhost:8080`
* Serves per‑application endpoints: `/chains/<chain-id>/applications/<application-id>`

---

## Setting Up: Testnet vs Local Net

### Latest public Testnet ("Conway" example)

```bash
linera wallet init --faucet https://faucet.testnet-conway.linera.net
linera wallet request-chain --faucet https://faucet.testnet-conway.linera.net
```

If version or compatibility errors occur, install a Linera toolchain compatible with the active Testnet.

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

> **Note:** Local net wallets are tied to the lifetime of the network. If you restart `linera net`, delete and recreate the wallet.

### Working with multiple wallets/networks

```bash
DIR=$HOME/my_directory
mkdir -p $DIR
export LINERA_WALLET="$DIR/wallet.json"
export LINERA_KEYSTORE="$DIR/keystore.json"
export LINERA_STORAGE="rocksdb:$DIR/wallet.db"
```

You can also define numbered sets and switch with `linera --with-wallet <N>` if `LINERA_*_<N>` variables are set.

### Verifying connectivity

```bash
linera sync
linera query-balance
```

You should see a token balance (e.g., `10`).

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

# Open a chain for another wallet (multi-step)
linera --wallet wallet2.json --storage rocksdb:linera2.db wallet init --faucet $FAUCET_URL
linera --wallet wallet2.json keygen  # prints an unassigned public key
linera open-chain --to-public-key <pubkey-from-wallet2>
# prints <message-id> and <new-chain-id>
linera --wallet wallet2.json assign --key <pubkey> --message-id <message-id>
```

### Multi-owner chains

Fine‑grained control via `open-multi-owner-chain`:

```bash
linera open-multi-owner-chain \
  --chain-id <existing-chain-id> \
  --owner-public-keys <pubkey1> <pubkey2> \
  --multi-leader-rounds 2
```

Use `change-ownership` to update owners/round settings later.

### Run the node service (GraphQL)

```bash
linera service --port 8080
# Open http://localhost:8080 for GraphiQL
```

---

## Building Your First App (Counter)

Linera apps compile to **Wasm**. The canonical example is a counter that can be initialized and incremented.

### 1) Scaffold a project

```bash
linera project new my-counter
```

This creates:

* `Cargo.toml` — dependencies & build targets
* `src/lib.rs` — ABI definitions (contract/service types)
* `src/state.rs` — persistent state (Views)
* `src/contract.rs` — contract (metered, mutates state)
* `src/service.rs` — service (read‑only GraphQL)

### 2) Model the state with Views (`src/state.rs`)

```rust
#[derive(RootView, async_graphql::SimpleObject)]
#[view(context = ViewStorageContext)]
pub struct Counter {
    pub value: RegisterView<u64>,
}
```

Views let you stage and persist changes efficiently. Common views include `RegisterView`, `LogView`, `QueueView`, `MapView`, and `CollectionView`.

### 3) Define the ABI (`src/lib.rs`)

Your ABI wires the app’s types for both contract and service.

```rust
pub struct CounterAbi;

impl ContractAbi for CounterAbi {
    type Operation = u64;      // increment by this amount
    type Response  = u64;      // new value
}

impl ServiceAbi for CounterAbi {
    type Query         = async_graphql::Request;
    type QueryResponse = async_graphql::Response;
}
```

### 4) Implement the contract (`src/contract.rs`)

The contract is the **write** side (gas‑metered).

```rust
linera_sdk::contract!(CounterContract);

pub struct CounterContract {
    state: CounterState,
    runtime: ContractRuntime<Self>,
}

#[async_trait]
impl Contract for CounterContract {
    type Message = ();          // none for this example
    type Parameters = ();       // global params (unused)
    type InstantiationArgument = u64; // initial value
    type EventValue = ();

    async fn load(runtime: ContractRuntime<Self>) -> Self {
        let state = CounterState::load(runtime.root_view_storage_context()).await.expect("load");
        Self { state, runtime }
    }

    async fn instantiate(&mut self, value: u64) {
        // Validate parameters if you use them
        self.runtime.application_parameters();
        self.state.value.set(value);
    }

    async fn execute_operation(&mut self, inc: u64) -> u64 {
        let new_value = self.state.value.get() + inc;
        self.state.value.set(new_value);
        new_value
    }

    async fn execute_message(&mut self, _msg: Self::Message) {}

    async fn process_streams(&mut self, _updates: Vec<StreamUpdate>) {}

    async fn store(self) {
        self.state.save().await.expect("save");
    }
}

impl WithContractAbi for CounterContract { type Abi = CounterAbi; }
```

### 5) Implement the service (`src/service.rs`)

The service is the **read** side (non‑metered, GraphQL endpoint).

```rust
linera_sdk::service!(CounterService);

pub struct CounterService {
    state: CounterState,
    runtime: std::sync::Arc<ServiceRuntime<Self>>,
}

#[async_trait]
impl Service for CounterService {
    type Parameters = ();

    async fn new(runtime: ServiceRuntime<Self>) -> Self {
        let state = CounterState::load(runtime.root_view_storage_context()).await.expect("load");
        Self { state, runtime: std::sync::Arc::new(runtime) }
    }

    async fn handle_query(&self, req: async_graphql::Request) -> async_graphql::Response {
        use async_graphql::{EmptySubscription, Schema};
        let schema = Schema::build(
            QueryRoot { value: *self.state.value.get() },
            MutationRoot { runtime: self.runtime.clone() },
            EmptySubscription,
        ).finish();
        schema.execute(req).await
    }
}

impl WithServiceAbi for CounterService { type Abi = CounterAbi; }

#[derive(Clone)]
struct QueryRoot { value: u64 }
#[async_graphql::Object]
impl QueryRoot { async fn value(&self) -> &u64 { &self.value } }

struct MutationRoot { runtime: std::sync::Arc<ServiceRuntime<CounterService>> }
#[async_graphql::Object]
impl MutationRoot {
    async fn increment(&self, value: u64) -> [u8; 0] {
        self.runtime.schedule_operation(&value);
        []
    }
}
```

### 6) Build to Wasm

```bash
# From your app root
cargo build --release --target wasm32-unknown-unknown
# Or build the example counter in the Linera repo
cd examples/counter && cargo build --release --target wasm32-unknown-unknown
```

This produces two Wasm artifacts: `*_contract.wasm` and `*_service.wasm`.

---

## Deploying

You can deploy to a **local net** or the **public testnet/devnet** using `publish-and-create`, which both publishes the bytecode and instantiates an application.

### Local net deployment

Ensure your `LINERA_WALLET`, `LINERA_STORAGE`, `LINERA_KEYSTORE` env vars point to the local wallet.

```bash
linera publish-and-create \
  target/wasm32-unknown-unknown/release/my_counter_{contract,service}.wasm \
  --json-argument "42"     # instantiation arg (initial value)
```

### Testnet/Devnet deployment

Initialize wallet & chain via faucet, then deploy:

```bash
linera wallet init --faucet https://faucet.testnet-conway.linera.net
linera wallet request-chain --faucet https://faucet.testnet-conway.linera.net

linera publish-and-create \
  target/wasm32-unknown-unknown/release/my_counter_{contract,service}.wasm \
  --json-argument "42"
```

---

## Interacting via GraphQL

Run the node service for your wallet:

```bash
linera service --port 8080
```

Open **GraphiQL** at `http://localhost:8080` and list applications on your default chain (replace `...` with your chain ID from `linera wallet show`):

```graphql
query {
  applications(chainId: "...") {
    id
    description
    link
  }
}
```

Follow the returned `link` to the app’s GraphQL endpoint, then:

```graphql
# Read the counter value
query { value }

# Prepare an increment operation (schedules an op to be included in your next block)
mutation { increment(value: 5) }
```

---

## Design Patterns (Quick Tour)

* **User-only apps**: All logic/state lives on user chains (e.g., fungible tokens). Scales horizontally.
* **Client/server**: A dedicated app chain acts as a shared service while user chains issue requests.
* **Personal chains as accelerators**: Offload heavy or non‑deterministic work (ZK proofs, oracle/API fetches, DA downloads) to user chains, then send authenticated results to app chains.
* **Temporary chains**: Spawn per‑session/per‑game chains for unbounded concurrency (e.g., tournaments).
* **Just‑in‑time oracles**: On‑chain apps query trusted off‑chain clients (e.g., TEE‑hosted AI) and receive authenticated responses.

---

## Troubleshooting & Tips

* If the faucet or network calls fail, ensure your **CLI version** matches the active network.
* After restarting a **local net**, recreate your wallet (it’s tied to that network’s lifetime).
* Use environment variables to juggle multiple wallets and networks cleanly.
* Remember: services are **read‑only**; state changes happen in contracts via operations/messages.

---

## One‑Page Checklist

1. **Choose network**: Local (`linera net up ...`) or Testnet (use faucet URL).
2. **Create wallet & chain**: `wallet init` → `request-chain`.
3. **Run service**: `linera service --port 8080`.
4. **Create app**: `linera project new <name>` → implement state, ABI, contract, service.
5. **Build**: `cargo build --target wasm32-unknown-unknown --release`.
6. **Deploy**: `linera publish-and-create <contract.wasm> <service.wasm> --json-argument "..."`.
7. **Query**: Open GraphiQL → read state (`query`) and schedule ops (`mutation`).

---

## Useful Commands (Copy/Paste)

```bash
# Faucet + chain (Testnet)
linera wallet init --faucet https://faucet.testnet-conway.linera.net
linera wallet request-chain --faucet https://faucet.testnet-conway.linera.net

# Local net + faucet
linera net up --with-faucet --faucet-port 8080
linera wallet init --faucet http://localhost:8080
linera wallet request-chain --faucet http://localhost:8080

# Inspect
linera wallet show
linera sync && linera query-balance

# Build example counter
cd examples/counter && cargo build --release --target wasm32-unknown-unknown

# Deploy (local or testnet depending on wallet)
linera publish-and-create \
  target/wasm32-unknown-unknown/release/my_counter_{contract,service}.wasm \
  --json-argument "42"

# Run service
linera service --port 8080
```

---

*Happy shipping on microchains!*
