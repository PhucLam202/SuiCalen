<div align="center">
  <img src="./image.png" alt="Calendefi banner" width="1200" />
</div>

## Calendefi

**Calendefi** is a Sui dApp for **calendar-based autopay**: you schedule SUI payments for a future time, funds are **escrowed on-chain**, and a relayer can execute the payment when it becomes due (earning a relayer fee).

This repository contains:

- **Frontend (Vite + React)**: scheduling UI, task list/history/analytics, and a “Yield” panel.
- **Move smart contract**: `contracts/autopay` – on-chain escrowed scheduled payments.
- **Relayer/executor**:
  - A **task executor loop** (`scripts/relayer.ts`) that scans events and executes due tasks.
  - A **relayer API** (`relayer/src/index.ts`) exposing health/metrics and yield endpoints used by the UI.

## How it works (high level)

- **Create task**: the user calls `autopay::create_task` with a `Coin<SUI>`, recipient, `execute_at` (ms), `fee_amount`, and optional metadata.
- **Escrow**: the contract splits the relayer fee, locks funds inside a shared `ScheduledTask`, and emits `TaskCreated`.
- **Execute**: when due, a relayer calls `autopay::execute_task`, transferring:
  - the escrowed amount to the recipient
  - the relayer fee to the executor
- **Cancel**: the sender can cancel a pending task and receive a refund (amount + fee).

## Run locally

### Prerequisites

- **Node.js** (recommended: \(>=\) 18)
- **npm**
- **Sui wallet** in your browser (or zkLogin flow via `@mysten/dapp-kit`)
- **Sui CLI** (only needed if you want to publish the Move contract)

### Install

```bash
npm install
```

### Configure environment

Create a root `.env` (you can start from `.env.example` if present) and set the required variables below.

### Start the app (UI + task executor)

This runs:

- Vite dev server at `http://localhost:3000`
- A background executor loop that scans for due tasks and calls `execute_task`

```bash
npm run dev
```

### (Optional) Start the relayer API (Yield + health/metrics)

The UI proxies `/api`, `/health`, and `/metrics` to `http://localhost:3001`. To enable those endpoints, start the API server:

```bash
npx tsx relayer/src/index.ts
```

## Environment variables

Do **not** hard-code secrets. Put them in `.env` and keep that file out of git.

### Required (app + executor)

- **`VITE_AUTOPAY_PACKAGE_ID`**: the published Move package ID for `autopay`
- **`VITE_REGISTRY_ID`**: the shared `TaskRegistry` object ID created by `init()`

### Required for on-chain execution (executor / relayer)

- **`RELAYER_PRIVATE_KEY`**: Base64-encoded Ed25519 secret key (used to sign execution transactions)

### Optional (execution / network / logging)

- **`SUI_NETWORK`**: `mainnet` | `testnet` | `devnet` (default: `testnet`)
- **`SUI_RPC_URL`**: custom fullnode RPC URL (falls back to Mysten default for the selected network)
- **`GAS_STATION_PRIVATE_KEY`**: Base64 Ed25519 secret key for a separate gas-paying account (enables sponsored execution in some scripts)
- **`GAS_BUDGET_LIMIT`**: gas budget in MIST for sponsored transactions (default: `20000000`)
- **`LOG_LEVEL`**: logging verbosity (example: `debug`, default varies by component)

### Optional (relayer API server)

- **`PORT`**: relayer API port (default: `3001`)
- **`MONGODB_URI`**: MongoDB connection string (enables DB-backed features; when unset the API still runs with DB disabled)
- **`MONGODB_DB_NAME`**: MongoDB database name (default: `calendefi`)

### Optional (Yield / AI strategy selection)

- **`YIELD_NETWORK`**: `mainnet` | `testnet` | `devnet` (default: `mainnet` for fetching real APRs)
- **`OPENAI_API_KEY`**: enables AI-based protocol selection for `POST /api/yield/optimize` (falls back to a heuristic strategy when unset)

Provider-specific configuration used by yield aggregation:

- **`SCALLOP_ADDRESS_ID`**
- **`SUILEND_LENDING_MARKET_ID`**
- **`SUILEND_LENDING_MARKET_TYPE`**

Walrus client configuration (if you use the Walrus integration):

- **`WALRUS_PUBLISHER_URL`** (default: `https://publisher.walrus.gg`)
- **`WALRUS_AGGREGATOR_URL`** (default: `https://aggregator.walrus.gg`)
- **`WALRUS_EPOCHS`** (default: `1`)

## Smart contract (Move)

The Move package is in `contracts/autopay`.

### Publish (example flow)

- Build/publish with the Sui CLI.
- Record:
  - the **package ID** (for `VITE_AUTOPAY_PACKAGE_ID`)
  - the shared **registry object ID** from the `RegistryCreated` event (for `VITE_REGISTRY_ID`)

## Useful scripts

### Convert mnemonic → Base64 private key

```bash
npm run mnemonic-to-key "word1 word2 ... word12"
```

### Execute a single task by ID (manual)

```bash
npm run execute-task <TASK_OBJECT_ID>
```

## Relayer API endpoints

When the API server is running (default `http://localhost:3001`):

- **`GET /health`**: health check
- **`GET /metrics`**: metrics
- **`GET /api/yield/apr/all`**: fetch APRs across protocols
- **`GET /api/yield/apr/:token`**: fetch APRs for a token
- **`POST /api/yield/optimize`**: recommend a protocol for a given amount/token/target date (AI when configured, heuristic fallback otherwise)

## Security notes

- **Never commit** `.env`, mnemonics, private keys, or API keys.
- Treat `RELAYER_PRIVATE_KEY` / `GAS_STATION_PRIVATE_KEY` as production secrets.
- Use minimal funded accounts for testnet development.
