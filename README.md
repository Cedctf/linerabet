# 🎰 Linera Casino

A decentralized casino application built on the Linera blockchain, featuring Roulette, Blackjack, and Baccarat games with **cross-chain architecture**.

## 🌐 Live Demo

**Try it now: [https://linera.click](https://linera.click)**

> This live demo runs on the **Linera Conway Testnet**. Connect your wallet and get free testnet tokens to play!

---

## 🎮 Features

- **Roulette** - Full European roulette with all bet types (straights, splits, corners, dozens, colors, etc.)
- **Blackjack** - Classic card game against the dealer
- **Baccarat** - Player vs Banker betting
- **Cross-chain architecture** - Bank chain manages game logic and payouts
- **Dynamic wallet integration** - Connect with MetaMask, WalletConnect, and more

---

## 🚀 Quick Start

### Option 1: Local Devnet (Recommended - Fastest)

This runs a complete local Linera network in Docker. **Faster than testnet** because all validators run locally with no network latency.

```bash
# Clone the repository
git clone https://github.com/Cedctf/linerabet.git
cd linerabet

# Build and run (first time may take a few minutes)
docker compose -f docker/compose.yaml up --build -d

# View logs - wait for "Casino is running!"
docker compose -f docker/compose.yaml logs -f
```

**Services available at:**
| Service | URL |
|---------|-----|
| Frontend | http://localhost:5173 |
| Faucet | http://localhost:8080 |
| Linera Service | http://localhost:8081 |
| GraphiQL IDE | http://localhost:8080 |

**Using pre-built DockerHub image (even faster startup):**
1. Edit `docker/compose.yaml`
2. Comment out `build: .`
3. Uncomment `image: ilovetofu/linera-casino:latest`
4. Run `docker compose up -d`

**Alternative: Run without Docker using deploy.sh:**

> ⚠️ This will wipe your Linera wallet! Back up first if needed.

```bash
# Clone the repository
git clone https://github.com/Cedctf/linerabet.git
cd linerabet

# Make script executable and run
chmod +x deploy.sh
./deploy.sh

# When prompted, type: Yes I Understand
```

This script will:
1. Start a local devnet
2. Build and deploy contracts
3. Update constants.ts automatically
4. Start linera service and frontend

---

### Option 2: Testnet Mode (For Remote Deployment)

This connects to the public **Linera Conway Testnet**. Used for the live demo at [linera.click](https://linera.click).

> **Why testnet for the live demo?** The Linera client SDK (`@linera/client`) runs in the browser and expects validators to be accessible from `localhost`. For remote deployments, we use the public testnet validators which have proper public URLs.

```bash
# Clone the repository
git clone https://github.com/Cedctf/linerabet.git
cd linerabet/docker

# Run testnet mode
docker compose -f compose.testnet.yaml up --build -d

# View logs
docker compose -f compose.testnet.yaml logs -f
```

---

### Option 3: Local Development (Without Docker)

For developing the frontend without Docker:

```bash
# Clone the repository
git clone https://github.com/Cedctf/linerabet.git
cd linerabet

# Install dependencies
npm install

# Run frontend (connects to network in constants.ts)
npm run dev
```

**Building & Deploying Contracts:**

#### Deploy to Local Devnet

```bash
# Build contracts
cd contracts
cargo build --release --target wasm32-unknown-unknown
cd ..

# Start local devnet with faucet
linera net up --with-faucet --faucet-port 8080 --testing-prng-seed 37 &

# Wait for network to start, then initialize wallet
sleep 5
linera wallet init --faucet http://localhost:8080
linera wallet request-chain --faucet http://localhost:8080

# Get your chain ID
CHAIN_ID=$(linera wallet show | grep "Chain ID:" | head -n 1 | awk '{print $3}')

# Deploy application
linera publish-and-create \
  contracts/target/wasm32-unknown-unknown/release/contracts_contract.wasm \
  contracts/target/wasm32-unknown-unknown/release/contracts_service.wasm \
  --json-parameters '{"bank_chain_id": "'$CHAIN_ID'"}' \
  --json-argument '{"starting_balance": 100, "random_seed": 12345}'

# Start linera service (processes cross-chain messages)
linera service --port 8081
```

#### Deploy to Conway Testnet

```bash
# Build contracts
cd contracts
cargo build --release --target wasm32-unknown-unknown
cd ..

# Initialize wallet with testnet faucet
linera wallet init --faucet https://faucet.testnet-conway.linera.net
linera wallet request-chain --faucet https://faucet.testnet-conway.linera.net

# Get your chain ID
CHAIN_ID=$(linera wallet show | grep "Chain ID:" | head -n 1 | awk '{print $3}')

# Deploy application
linera publish-and-create \
  contracts/target/wasm32-unknown-unknown/release/contracts_contract.wasm \
  contracts/target/wasm32-unknown-unknown/release/contracts_service.wasm \
  --json-parameters '{"bank_chain_id": "'$CHAIN_ID'"}' \
  --json-argument '{"starting_balance": 100, "random_seed": 12345}'

# Start linera service (processes cross-chain messages)
linera service --port 8081
```

**Update `src/constants.ts` manually or use the helper script:**

```bash
# For devnet (localhost URLs)
node docker/update-constants.mjs "$APP_ID" "$CHAIN_ID" "devnet"

# For testnet (Conway testnet URLs)
node docker/update-constants.mjs "$APP_ID" "$CHAIN_ID" "testnet"
```

> **Manual Configuration:** If not using the script, edit `.env.local` and set:
> - `VITE_NETWORK_MODE` - Set to `devnet` (localhost URLs) or `testnet` (Conway testnet URLs)
>
> Then edit `src/constants.ts` and set:
> - `APP_ID` - Your deployed application ID
> - `BANK_CHAIN_ID` - Your bank chain ID

---

## 🏗️ Cross-Chain Architecture

Linera Casino uses a **dual-chain architecture** where users interact on their own microchains, while the Bank manages all game logic on a central chain.

---

### 💰 Request Chips Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                      REQUEST CHIPS FLOW                              │
└─────────────────────────────────────────────────────────────────────┘

  ┌──────────────────────┐                    ┌──────────────────────┐
  │     USER CHAIN       │                    │     BANK CHAIN       │
  │                      │                    │                      │
  │  1. User calls:      │   RequestChips     │                      │
  │  mutation {          │ ─────────────────▶ │  2. Bank receives:   │
  │    requestChips      │                    │  bank_handle_        │
  │  }                   │                    │    request_chips()   │
  │                      │                    │                      │
  │  handle_request_     │                    │  Mints casino chips  │
  │    chips()           │                    │  for the player      │
  │                      │                    │                      │
  │  4. User receives:   │   ChipsGranted     │  3. Sends message:   │
  │  player_handle_      │ ◀───────────────── │  ChipsGranted {      │
  │    chips_granted()   │                    │    amount: 100       │
  │                      │                    │  }                   │
  │  Balance: +100 chips │                    │                      │
  └──────────────────────┘                    └──────────────────────┘
```

---

### 🎲 Roulette Game Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                      ROULETTE GAME FLOW                              │
└─────────────────────────────────────────────────────────────────────┘

  ┌──────────────────────┐                    ┌──────────────────────┐
  │     USER CHAIN       │                    │     BANK CHAIN       │
  │                      │                    │                      │
  │  1. User calls:      │  RequestRoulette   │                      │
  │  mutation {          │ ─────────────────▶ │  2. Bank receives:   │
  │    playRoulette(     │   (bets, player)   │  bank_handle_        │
  │      bets: [...]     │                    │    request_roulette()│
  │    )                 │                    │                      │
  │  }                   │                    │  Generates seed,     │
  │                      │                    │  stores pending game │
  │  handle_play_        │                    │                      │
  │    roulette()        │   RouletteReady    │  3. Sends seed:      │
  │  Deducts bet amount  │ ◀───────────────── │  RouletteReady {     │
  │                      │   (game_id, seed)  │    game_id, seed     │
  │  4. User receives:   │                    │  }                   │
  │  player_handle_      │                    │                      │
  │    roulette_ready()  │                    │                      │
  │                      │                    │                      │
  │  Calculates outcome  │ ReportRouletteRes  │  5. Bank receives:   │
  │  locally using seed  │ ─────────────────▶ │  bank_handle_report_ │
  │  outcome = seed % 37 │   (outcome)        │    roulette_result() │
  │                      │                    │                      │
  │                      │                    │  Verifies outcome,   │
  │                      │                    │  calculates payout   │
  │                      │                    │                      │
  │  7. User receives:   │  RouletteSettled   │  6. Sends result:    │
  │  player_handle_      │ ◀───────────────── │  RouletteSettled {   │
  │    roulette_settled()│   (outcome,payout) │    outcome, payout   │
  │                      │                    │  }                   │
  │  Balance: +payout    │                    │                      │
  └──────────────────────┘                    └──────────────────────┘
```

---

###   Blackjack Game Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                      BLACKJACK GAME FLOW                             │
└─────────────────────────────────────────────────────────────────────┘

  ┌──────────────────────┐                    ┌──────────────────────┐
  │     USER CHAIN       │                    │     BANK CHAIN       │
  │                      │                    │                      │
  │  1. User calls:      │   RequestGame      │                      │
  │  mutation {          │ ─────────────────▶ │  2. Bank receives:   │
  │    startBlackjack(   │   (BLACKJACK, bet) │  bank_handle_        │
  │      bet: 25         │                    │    request_game()    │
  │    )                 │                    │                      │
  │  }                   │                    │  Generates seed,     │
  │                      │                    │  stores pending game │
  │  handle_play_        │                    │                      │
  │    blackjack()       │    GameReady       │  3. Sends seed:      │
  │  Deducts bet amount  │ ◀───────────────── │  GameReady {         │
  │                      │   (game_id, seed)  │    game_id, seed     │
  │  4. User receives:   │                    │  }                   │
  │  player_handle_      │                    │                      │
  │    game_ready()      │                    │                      │
  │                      │                    │                      │
  │  Deals cards locally │                    │                      │
  │  using seed to       │                    │                      │
  │  shuffle deck        │                    │                      │
  │                      │                    │                      │
  │  ╔═══════════════════╧════════════════════╧════════════════════╗ │
  │  ║              PLAYER ACTIONS (Local)                         ║ │
  │  ╠═════════════════════════════════════════════════════════════╣ │
  │  ║  mutation { blackjackHit }    → handle_hit()                ║ │
  │  ║  mutation { blackjackStand }  → handle_stand()              ║ │
  │  ║  mutation { blackjackDouble } → handle_double_down()        ║ │
  │  ╚═════════════════════════════════════════════════════════════╝ │
  │                      │                    │                      │
  │  5. On Stand/Bust:   │   ReportResult     │  6. Bank receives:   │
  │  Sends player        │ ─────────────────▶ │  bank_handle_        │
  │  actions to Bank     │   (actions)        │    report_result()   │
  │                      │                    │                      │
  │                      │                    │  replay_and_verify() │
  │                      │                    │  Replays game with   │
  │                      │                    │  same seed, verifies │
  │                      │                    │  actions match       │
  │                      │                    │                      │
  │  8. User receives:   │   GameSettled      │  7. Sends result:    │
  │  player_handle_      │ ◀───────────────── │  GameSettled {       │
  │    game_settled()    │   (result, payout) │    result, payout,   │
  │                      │                    │    dealer_hand       │
  │  Records to history  │                    │  }                   │
  │  Balance: +payout    │                    │                      │
  └──────────────────────┘                    └──────────────────────┘
```

---

### 🎴 Baccarat Game Flow (Bank-Authoritative)

```
┌─────────────────────────────────────────────────────────────────────┐
│                    BACCARAT GAME FLOW                                │
│              (Bank-Authoritative - Single Round)                     │
└─────────────────────────────────────────────────────────────────────┘

  ┌──────────────────────┐                    ┌──────────────────────┐
  │     USER CHAIN       │                    │     BANK CHAIN       │
  │                      │                    │                      │
  │  1. User calls:      │ RequestBaccarat    │                      │
  │  mutation {          │ ─────────────────▶ │  2. Bank receives:   │
  │    playBaccarat(     │  (amount,bet_type) │  bank_handle_        │
  │      bets: [         │                    │    request_baccarat()│
  │        {type:PLAYER, │                    │                      │
  │         amount:20}   │                    │  ┌─────────────────┐ │
  │      ]               │                    │  │ GAME EXECUTION  │ │
  │    )                 │                    │  │                 │ │
  │  }                   │                    │  │ generate_seed() │ │
  │                      │                    │  │ run_baccarat_   │ │
  │  handle_play_        │                    │  │   game()        │ │
  │    baccarat()        │                    │  │ Deal cards,     │ │
  │  Deducts bet amount  │                    │  │ apply rules,    │ │
  │                      │                    │  │ determine winner│ │
  │                      │                    │  │ calculate_      │ │
  │                      │                    │  │   baccarat_     │ │
  │                      │                    │  │   score()       │ │
  │                      │                    │  └─────────────────┘ │
  │                      │                    │                      │
  │  4. User receives:   │  BaccaratSettled   │  3. Sends result:    │
  │  player_handle_      │ ◀───────────────── │  BaccaratSettled {   │
  │    baccarat_settled()│                    │    winner,           │
  │                      │                    │    payout,           │
  │  Records to history  │                    │    player_hand,      │
  │  Balance: +payout    │                    │    banker_hand,      │
  │                      │                    │    scores            │
  │                      │                    │  }                   │
  └──────────────────────┘                    └──────────────────────┘

  ┌───────────────────────────────────────────────────────────────────┐
  │                     PAYOUT RULES                                   │
  ├───────────────────────────────────────────────────────────────────┤
  │  Player wins:   1:1 payout (bet $20 → win $40)                    │
  │  Banker wins:   0.95:1 payout (5% commission)                     │
  │  Tie wins:      8:1 payout (bet $5 → win $45)                     │
  └───────────────────────────────────────────────────────────────────┘
```

---

## 📁 Project Structure

```
linerabet/
├── contracts/              # Rust smart contracts
│   ├── src/
│   │   ├── lib.rs          # Message types, Operations, enums
│   │   ├── state.rs        # On-chain state (balances, games)
│   │   ├── contract.rs     # Core game logic & message handlers
│   │   └── service.rs      # GraphQL query layer
│   └── Cargo.toml
├── src/                    # React frontend
│   ├── pages/
│   │   ├── roulette.tsx    # Roulette game UI
│   │   ├── blackjack.tsx   # Blackjack game UI
│   │   └── baccarat.tsx    # Baccarat game UI
│   ├── components/         # Reusable UI components
│   ├── lib/
│   │   ├── linera-adapter.ts   # Linera SDK wrapper
│   │   └── dynamic-signer.ts   # Wallet signing adapter
│   └── constants.ts        # Network configuration
├── docker/
│   ├── Dockerfile
│   ├── compose.yaml        # Local devnet
│   ├── compose.testnet.yaml # Testnet deployment
│   ├── entrypoint.sh       # Local devnet startup
│   └── entrypoint-testnet.sh # Testnet startup
└── public/                 # Static assets (images, sounds)
```

---

## 📋 Commands Reference

| Command | Description |
|---------|-------------|
| `docker compose up -d` | Start local devnet |
| `docker compose down` | Stop containers |
| `docker compose logs -f` | View container logs |
| `docker compose -f compose.testnet.yaml up -d` | Start testnet mode |
| `npm run dev` | Run frontend locally |
| `npm run build` | Build production bundle |
| `cargo build --release --target wasm32-unknown-unknown` | Build contracts |

---

## 🎯 For Buildathon Judges

For evaluation, we recommend using the **local devnet** for the best experience:

```bash
git clone https://github.com/Cedctf/linerabet.git
cd linerabet/docker
docker compose up -d
docker compose logs -f  # Wait for "Casino is running!"
# Open http://localhost:5173
```

Or try the live demo at **[https://linera.click](https://linera.click)** (Conway Testnet)

---

## 📜 License

MIT License
