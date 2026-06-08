# RecChain — Developer Guide

> Renewable Energy Certificate (REC) Platform with AI Auditor, Chainlink Oracle, and ESG Intelligence  
> Stack: Solidity · OpenZeppelin v5 · Chainlink Functions · Hardhat · Truffle · Express.js · ethers.js v6 · React 18 · Vite

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Tech Stack & Dependencies](#2-tech-stack--dependencies)
3. [Project Structure](#3-project-structure)
4. [Environment Variables](#4-environment-variables)
5. [Local Development Setup](#5-local-development-setup)
6. [Smart Contract — RecDapp.sol](#6-smart-contract--recdappsol)
7. [Contract Compilation & Deployment](#7-contract-compilation--deployment)
8. [Backend API](#8-backend-api)
9. [AI Energy Auditor](#9-ai-energy-auditor)
10. [Frontend (React + Vite)](#10-frontend-react--vite)
11. [Demo Mode](#11-demo-mode)
12. [Chainlink Functions Oracle](#12-chainlink-functions-oracle)
13. [Scripts Reference](#13-scripts-reference)
14. [API Reference](#14-api-reference)
15. [Production Deployment](#15-production-deployment)

---

## 1. Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                     React Frontend                       │
│  Portfolio · Marketplace · AI Auditor · Carbon Passport  │
│               (Vite · ethers.js v6)                     │
└────────────────────────┬────────────────────────────────┘
                         │  HTTP /api/*  (or demo data)
┌────────────────────────▼────────────────────────────────┐
│                  Express.js REST API                     │
│   /recs  ·  /listings  ·  /audit  ·  /iot               │
│          server/lib/auditor.js  (AI engine)              │
└────────────────────────┬────────────────────────────────┘
                         │  ethers.js v6  JsonRpcProvider
┌────────────────────────▼────────────────────────────────┐
│              RecDapp.sol  (EVM Smart Contract)           │
│  ERC-1155 · AccessControl · ReentrancyGuard             │
│  FunctionsClient (Chainlink)                            │
└──────────────────────┬──────────────────────────────────┘
                       │  Chainlink Functions v1_0_0
┌──────────────────────▼──────────────────────────────────┐
│          Chainlink DON (Decentralised Oracle Network)    │
│  Fetches IoT meter reading → runs JS anomaly check      │
│  → calls fulfillRequest() back on-chain                 │
└──────────────────────┬──────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────┐
│              IoT Smart Meters  (HTTP REST)               │
│  METER_GR_001 … METER_GR_005                            │
└─────────────────────────────────────────────────────────┘
```

### Data flow — REC issuance

```
Mode A (Manual):
  Issuer → issueRec() → ERC-1155 mint → RecIssued event

Mode B (Oracle):
  Issuer → requestAutoIssuance()
        → Chainlink DON fetches meter data
        → JS source: 3-sigma anomaly check
        → fulfillRequest() called on-chain
        → if kWh ≥ 1 000 → _issueRec() → ERC-1155 mint
```

### Token model

| Unit | Value | Industry meaning |
|------|-------|-----------------|
| 1 token | 1 kWh | Smallest tradeable unit |
| 1 000 tokens | 1 MWh | 1 REC (industry minimum) |
| `kwh` field | total batch size | e.g. 35 000 = 35 MWh |

---

## 2. Tech Stack & Dependencies

### Root (server + scripts)

| Package | Version | Purpose |
|---------|---------|---------|
| `ethers` | ^6.16.0 | Blockchain interaction (JsonRpcProvider, Wallet, NonceManager) |
| `express` | ^5.2.1 | REST API server |
| `cors` | ^2.8.6 | Cross-origin requests (Vercel → Render) |
| `dotenv` | ^17.4.2 | Environment variable loading |
| `pdfkit` | ^0.18.0 | Carbon Passport PDF generation |
| `qrcode` | ^1.5.4 | QR code generation (server-side for PDF) |
| `@openzeppelin/contracts` | ^5.6.1 | ERC-1155, AccessControl, ReentrancyGuard |
| `@chainlink/contracts` | ^1.5.0 | FunctionsClient, FunctionsRequest |
| `@truffle/hdwallet-provider` | ^2.1.15 | Truffle deployment signer |
| `hardhat` | ^2.28.6 | Local Ethereum node (dev only) |

> **Node.js requirement:** v20+ recommended, v24 tested. Ganache is **not compatible** with Node v24 (missing `µWS` binary) — use Hardhat node instead.

### Client

| Package | Purpose |
|---------|---------|
| `react` + `react-dom` 18 | UI framework |
| `react-router-dom` v6 | Client-side routing |
| `ethers` v6 | Wallet connection, contract calls |
| `recharts` | Portfolio charts (BarChart, AreaChart) |
| `qrcode` | Client-side QR canvas rendering in Carbon Passport |
| `vite` v5 | Build tool, dev server |
| `@vitejs/plugin-react` | JSX transform |

---

## 3. Project Structure

```
REC_Dapp_Ethereum/
│
├── contracts/
│   ├── RecDapp.sol          # Main contract (ERC-1155 + Chainlink)
│   └── Migrations.sol       # Truffle migrations helper
│
├── migrations/
│   └── 2_deploy_recdapp.js  # Truffle migration script
│
├── build/contracts/         # Truffle compile output (gitignored)
│   └── RecDapp.json         # Full artifact (ABI + bytecode + networks)
│
├── scripts/
│   ├── seed.js              # Demo data seeder (14 RECs, 6 listings)
│   ├── post-deploy.js       # Updates .env + client/.env.local after deploy
│   └── grant-issuer.js      # Grants ISSUER_ROLE to a new address
│
├── server/
│   ├── index.js             # Express app entry point
│   ├── routes/
│   │   ├── recs.js          # GET /recs/:id, GET /recs/:id/passport, POST /recs/issue
│   │   ├── listings.js      # GET /listings, GET /listings/portfolio/:address
│   │   ├── audit.js         # GET /audit/summary, GET /audit/meter/:id
│   │   └── iot.js           # GET /iot/meters (mock sensor data)
│   └── lib/
│       ├── contract.js      # ethers.js provider + contract singleton
│       ├── auditor.js       # AI Auditor engine (anomaly + maintenance)
│       └── passport.js      # PDFKit Carbon Passport generator
│
├── client/
│   ├── src/
│   │   ├── App.jsx          # Router root
│   │   ├── context/
│   │   │   └── Web3Context.jsx   # MetaMask connection + contract instance
│   │   ├── components/
│   │   │   ├── LandingPage.jsx
│   │   │   ├── Marketplace.jsx
│   │   │   ├── Portfolio.jsx
│   │   │   ├── AIAuditor.jsx
│   │   │   ├── PassportPage.jsx
│   │   │   ├── VerifyPage.jsx
│   │   │   ├── EmbedBadge.jsx
│   │   │   ├── IssueRec.jsx
│   │   │   └── Navbar.jsx
│   │   ├── lib/
│   │   │   ├── config.js    # Contract address, chain IDs, DEMO_MODE flag
│   │   │   ├── api.js       # Unified data layer (demo or real API)
│   │   │   └── demo.js      # Static demo data (14 RECs, audit, listings)
│   │   └── styles/
│   │       └── global.css   # All styles + responsive media queries
│   ├── src/contracts/
│   │   └── RecDapp.json     # ABI-only artifact (committed, used by Vite)
│   ├── .env.local           # Local dev env vars (gitignored)
│   ├── .env.production      # Production env vars (committed, no secrets)
│   ├── vercel.json          # Vercel rewrites: /api/* proxy + SPA catch-all
│   └── vite.config.js       # @contracts alias, /api proxy for dev
│
├── hardhat.config.js        # Hardhat local node config (chainId 1337, cancun)
├── truffle-config.js        # Truffle: development, sepolia, amoy, polygon
├── .env                     # Secrets (gitignored)
└── DEVELOPER_GUIDE.md       # This file
```

---

## 4. Environment Variables

### Root `.env` (never commit)

```bash
# ── Wallet ──────────────────────────────────────────────────────
MNEMONIC="word1 word2 word3 ... word12"
ISSUER_PRIVATE_KEY=0xabc123...

# ── RPC ─────────────────────────────────────────────────────────
ALCHEMY_API_KEY=your_alchemy_key
RPC_URL=http://127.0.0.1:8545          # override: use local Hardhat node

# ── Contract ─────────────────────────────────────────────────────
CONTRACT_ADDRESS=0x016C4bf...

# ── Server ───────────────────────────────────────────────────────
PORT=3001
FRONTEND_URL=https://your-app.vercel.app   # optional custom domain CORS
APP_BASE_URL=http://localhost:5173          # used in PDF QR codes

# ── Chainlink (Sepolia) ──────────────────────────────────────────
CHAINLINK_SUBSCRIPTION_ID=123
CHAINLINK_DON_ID=fun-ethereum-sepolia-1
```

### `client/.env.local` (local dev, gitignored)

```bash
VITE_CONTRACT_ADDRESS=0x016C4bf...
VITE_CHAIN_ID=0x539                    # 1337 = Hardhat local
VITE_NETWORK_NAME=Hardhat Local
VITE_RPC_URL=http://127.0.0.1:8545
VITE_DEMO_MODE=true
```

### `client/.env.production` (committed, no secrets)

```bash
VITE_DEMO_MODE=true
VITE_CHAIN_ID=0xaa36a7                 # Sepolia
VITE_NETWORK_NAME=Sepolia
```

### Variable reference

| Variable | Used by | Purpose |
|----------|---------|---------|
| `MNEMONIC` | Truffle, Hardhat, seed.js | 12-word BIP-39 mnemonic for deployer wallet |
| `ISSUER_PRIVATE_KEY` | seed.js, server | 0x-prefixed private key with ISSUER_ROLE |
| `ALCHEMY_API_KEY` | Truffle, server | Alchemy RPC key (Sepolia / Polygon) |
| `RPC_URL` | server, seed.js | Override default Alchemy RPC (e.g. local node) |
| `CONTRACT_ADDRESS` | server, seed.js | Deployed contract address |
| `VITE_CONTRACT_ADDRESS` | client | Same address, injected at build time |
| `VITE_CHAIN_ID` | client | Hex chain ID (0x539=1337, 0xaa36a7=Sepolia) |
| `VITE_DEMO_MODE` | client | `true` → no API calls, use static data |
| `VITE_API_URL` | client | API base URL (empty = relative, uses vercel.json proxy) |

---

## 5. Local Development Setup

### Prerequisites

```bash
node --version    # v20+
npm --version     # v9+
```

### 1. Install dependencies

```bash
# Root (server + scripts)
npm install

# Frontend
npm run client:install
# equivalent: cd client && npm install
```

### 2. Configure `.env`

Copy from the template above. Minimum for local dev:

```bash
MNEMONIC="test test test test test test test test test test test junk"
ISSUER_PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
CONTRACT_ADDRESS=                  # filled after deploy
RPC_URL=http://127.0.0.1:8545
```

> The private key above is Hardhat account[0] — safe for local dev only.

### 3. Start the local blockchain

```bash
npx hardhat node --port 8545
```

Keep this terminal open. Hardhat:
- Uses `cancun` hardfork (required by OpenZeppelin v5 `mcopy` opcode)
- chainId 1337
- Auto-mines every transaction
- Provides 20 pre-funded accounts (10 000 ETH each)

### 4. Deploy the contract

```bash
npm run truffle -- migrate --network development --reset
```

On success, update `.env`:

```bash
CONTRACT_ADDRESS=0x<address from output>
```

Or run the post-deploy script automatically:

```bash
node scripts/post-deploy.js 0x<address>
# Updates CONTRACT_ADDRESS in .env and VITE_CONTRACT_ADDRESS in client/.env.local
```

### 5. Grant ISSUER_ROLE (if needed)

```bash
node scripts/grant-issuer.js
```

This grants `ISSUER_ROLE` to the address derived from `ISSUER_PRIVATE_KEY`. Safe to run multiple times — checks before granting.

### 6. Seed demo data

```bash
# Preview without sending transactions
node scripts/seed.js --dry-run

# Send all 14 issuances + listings + retirements
node scripts/seed.js
```

### 7. Start backend API

```bash
npm run server
# Server starts on http://localhost:3001
# Health check: curl http://localhost:3001/api/health
```

### 8. Start frontend dev server

```bash
npm run client:dev
# Vite dev server on http://localhost:5173
# /api/* requests proxied to http://localhost:3001
```

---

## 6. Smart Contract — RecDapp.sol

### Inheritance chain

```
RecDapp
  ├── ERC1155          (OpenZeppelin v5) — multi-token standard
  ├── ERC1155Holder    (OpenZeppelin v5) — allows contract to hold tokens (marketplace escrow)
  ├── AccessControl    (OpenZeppelin v5) — role-based permissions
  ├── ReentrancyGuard  (OpenZeppelin v5) — prevents re-entrancy on buyRec
  └── FunctionsClient  (Chainlink v1_0_0) — oracle request/response
```

### Roles

| Role | keccak256 | Permissions |
|------|-----------|-------------|
| `DEFAULT_ADMIN_ROLE` | `0x00` | Grant/revoke roles, set oracle config, set contract URI |
| `ISSUER_ROLE` | `keccak256("ISSUER_ROLE")` | Call `issueRec()` and `requestAutoIssuance()` |

Both roles are granted to `msg.sender` (deployer) in the constructor.

### Key data structures

```solidity
enum EnergySource { Solar, Wind, Hydro, Biomass, Geothermal, Other }
// index:             0      1     2      3         4           5

struct RecMetadata {
    address      issuer;       // who issued (EOA or this contract for oracle)
    address      producer;     // energy producer wallet (receives tokens)
    EnergySource source;       // energy type
    uint256      kwh;          // total batch size in kWh
    string       location;     // ISO 3166-2, e.g. "GR-AT"
    uint256      issuedAt;     // block.timestamp at issuance
    uint256      expiresAt;    // issuedAt + 365 days
    bool         fullyRetired; // true when all kWh retired
    string       dataHash;     // "ipfs://Qm..." or "oracle://METER_GR_001"
}

struct Listing {
    address seller;
    uint256 tokenId;
    uint256 amount;       // kWh units currently in escrow
    uint256 pricePerKwh;  // wei per kWh
    bool    active;
}

struct PendingIssuance {
    address      producer;
    EnergySource source;
    string       location;
    string       meterId;   // stored to build "oracle://meterId" dataHash
}
```

### State variables

```solidity
uint256 private _nextTokenId = 1;   // auto-increment, starts at 1
uint256 public  listingCount;       // total listings ever created

mapping(uint256 => RecMetadata) public recMetadata;
mapping(uint256 => Listing)     public listings;
mapping(uint256 => uint256)     public totalRetiredKwh;
mapping(address => mapping(uint256 => uint256)) public retiredBy;

// Oracle
bytes32 public donId;
uint64  public subscriptionId;
uint32  public callbackGasLimit = 300_000;
string  public functionsSource;
mapping(bytes32 => PendingIssuance) private _pendingIssuances;
```

### Function reference

#### `issueRec(producer, source, kwh, location, dataHash)` → `tokenId`
- Requires: `ISSUER_ROLE`, `kwh >= 1000`
- Mints `kwh` tokens to `producer`
- Stores `RecMetadata`, sets `expiresAt = now + 365 days`
- Emits: `RecIssued`

#### `requestAutoIssuance(producer, source, location, meterId)` → `requestId`
- Requires: `ISSUER_ROLE`, `functionsSource` set, `subscriptionId` set
- Builds a Chainlink Functions request with `meterId` as argument
- Stores `PendingIssuance` mapped by `requestId`
- Emits: `OracleRequestSent`

#### `fulfillRequest(requestId, response, err)` (internal, called by Chainlink)
- Decodes `response` as `uint256 kwh`
- If `kwh >= 1000` → calls `_issueRec()` → mints tokens
- `dataHash` set to `"oracle://meterId"`
- Emits: `OracleRequestFulfilled` or `OracleFulfillmentError`

#### `retireRec(tokenId, amount)`
- Requires: token exists, not fully retired, not expired, caller has balance
- Burns `amount` tokens from caller
- Increments `totalRetiredKwh[tokenId]` and `retiredBy[msg.sender][tokenId]`
- If `totalRetiredKwh >= kwh` → sets `fullyRetired = true`
- Emits: `RecRetired`

#### `listRec(tokenId, amount, pricePerKwh)` → `listingId`
- Transfers `amount` tokens from caller to contract (escrow)
- Creates `Listing` record
- Emits: `RecListed`

#### `buyRec(listingId, amount)` payable
- Requires: `msg.value == amount * listing.pricePerKwh`
- Protected by `nonReentrant`
- Transfers tokens from contract to buyer
- Forwards ETH to seller via `call{value: ...}`
- Emits: `RecSold`

#### `cancelListing(listingId)`
- Returns escrowed tokens to seller
- Emits: `ListingCancelled`

#### `verifyRec(tokenId)` → `(valid, metadata)`
- `valid = producer != 0x0 && !fullyRetired && now <= expiresAt`
- Read-only, used by the API and frontend

#### `remainingKwh(tokenId)` → `uint256`
- Returns `kwh - totalRetiredKwh[tokenId]`

### Critical compiler requirement

```javascript
// truffle-config.js + hardhat.config.js
evmVersion: 'cancun'
```

OpenZeppelin v5 uses the `mcopy` opcode (EIP-5656), introduced in the Cancun hardfork. Compiling with `paris` or earlier will fail with `invalid opcode` at runtime.

---

## 7. Contract Compilation & Deployment

### Compile

```bash
npm run truffle -- compile
# Output: build/contracts/RecDapp.json (full artifact with ABI + bytecode)
```

### Deploy to local Hardhat node

```bash
# Terminal 1: start node
npx hardhat node --port 8545

# Terminal 2: deploy
npm run truffle -- migrate --network development --reset
```

### Deploy to Sepolia testnet

```bash
# Requires: MNEMONIC, ALCHEMY_API_KEY, Sepolia ETH in account[0]
npm run truffle -- migrate --network sepolia --reset
```

### Deploy to Polygon Amoy (low-cost testnet)

```bash
npm run truffle -- migrate --network amoy --reset
```

### Migration script (`migrations/2_deploy_recdapp.js`)

```javascript
const RecDapp = artifacts.require('RecDapp');

module.exports = async function(deployer, network) {
  // Chainlink Functions Router addresses
  const ROUTERS = {
    sepolia:     '0xb83E47C2bC239B3bf370bc41e1459A34b41238D0',
    amoy:        '0xC22a79eBA640940ABB6dF0f7982cc119578E11De',
    development: '0x0000000000000000000000000000000000000001', // placeholder
    polygon:     '0x6E2dc0F9DB014aE19888F539E59285D2Ea04244C',
  };

  const router = ROUTERS[network] || ROUTERS.development;
  await deployer.deploy(RecDapp, 'https://recchain.io/api/metadata/{id}.json', router);
};
```

### Post-deployment

After deployment, run:

```bash
node scripts/post-deploy.js 0x<contract_address>
```

This script:
1. Updates `CONTRACT_ADDRESS` in `.env`
2. Creates/updates `client/.env.local` with `VITE_CONTRACT_ADDRESS`

---

## 8. Backend API

### Entry point: `server/index.js`

```javascript
const ALLOWED_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:4173',
  /^https:\/\/.*\.vercel\.app$/,          // all Vercel preview URLs
  process.env.FRONTEND_URL,               // custom domain
];
```

CORS is configured to allow all `*.vercel.app` subdomains via regex, which means every Vercel preview deployment automatically has API access.

### Contract singleton: `server/lib/contract.js`

```javascript
// Provider is lazy-initialized on first call
function getProvider() {
  const rpc = process.env.RPC_URL ||
    `https://eth-sepolia.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`;
  return new ethers.JsonRpcProvider(rpc);
}
```

Two contract instances:
- `getContract()` — read-only (provider only)
- `getSignerContract()` — write (ISSUER_PRIVATE_KEY wallet)

`serializeMeta()` converts all `BigInt` fields to strings for JSON serialization.

### Routes

#### `GET /api/recs/:tokenId`

Calls `contract.verifyRec(id)` + `contract.remainingKwh(id)`.

Response:
```json
{
  "tokenId": "7",
  "valid": true,
  "remaining": "20000",
  "metadata": {
    "issuer": "0xF1B1...",
    "producer": "0xF1B1...",
    "source": 1,
    "kwh": "35000",
    "location": "GR-MA",
    "issuedAt": "1735689600",
    "expiresAt": "1830384000",
    "fullyRetired": false,
    "dataHash": "ipfs://QmMakedonia..."
  }
}
```

#### `GET /api/recs/:tokenId/passport`

Generates a PDF Carbon Passport via `PDFKit`. Query param `?download=1` adds `Content-Disposition: attachment` header for file download.

#### `POST /api/recs/issue`

Body: `{ producer, source, kwh, location, dataHash }`  
Calls `getSignerContract().issueRec(...)`. Returns `txHash`, `tokenId`, `gasUsed`.

#### `GET /api/listings`

Iterates `listing 0 … listingCount-1`, returns all active ones enriched with REC metadata.

#### `GET /api/listings/portfolio/:address`

Uses `contract.queryFilter(RecIssued)` to discover all token IDs, then checks `balanceOf` and `retiredBy` for the given address. Returns holdings with balance > 0 or retired > 0.

#### `GET /api/audit/summary`

Runs `auditAllMeters()` — returns lightweight summary for all 5 meters (healthScore, opStatus, fraudStatus, maintStatus, alerts array).

#### `GET /api/audit/meter/:meterId`

Returns full audit report for one meter: operational, fraud, maintenance nested objects.

---

## 9. AI Energy Auditor

The auditor is a pure JavaScript engine in `server/lib/auditor.js`. It simulates IoT sensor data using a **deterministic seeded pseudo-random generator** and applies three independent analysis modules.

### Meter configuration

```javascript
const METERS = {
  'METER_GR_001': { name: 'Kalamata Solar Farm', source: 'Solar',
                    peakKwh: 2000, noiseStd: 150, degradationRate: 0.0025 },
  'METER_GR_002': { name: 'Makedonia Wind Park', source: 'Wind',
                    peakKwh: 3500, noiseStd: 400, degradationRate: 0.0010 },
  // ... 3 more meters
};
```

Each meter has a `degradationRate` (fraction per day) representing the expected natural output decline.

### Production simulation

```javascript
// Deterministic: same date always produces same "reading"
function seededRnd(seed) {
  const x = Math.sin(seed + 1) * 10000;
  return x - Math.floor(x);             // [0, 1)
}

// Solar follows a Gaussian bell curve centered at solar noon (13:00 UTC)
// Wind/Hydro: approximately flat with sinusoidal variation
function productionCurve(source, hourUTC) {
  if (source === 'Solar') {
    if (hourUTC < 5 || hourUTC > 21) return 0;
    const h = (hourUTC - 13) / 5;
    return Math.exp(-0.5 * h * h);      // standard Gaussian
  }
  return 0.7 + 0.3 * Math.sin(hourUTC / 3);
}
```

30-day history is generated deterministically from today's date index (`Math.floor(Date.now() / 86400000)`), so the same day always returns the same history.

### Module 1 — Operational Insights

```javascript
// Expected = historical mean over 30 days
const expected    = mean;
const deviationPct = ((current - expected) / expected) * 100;

let opStatus = 'ok';
if (Math.abs(deviationPct) > 40) opStatus = 'critical';
else if (Math.abs(deviationPct) > 15) opStatus = 'warning';

// Confidence based on coefficient of variation (signal consistency)
const cv         = std / mean;
const confidence = cv < 0.2 ? 90 : cv < 0.4 ? 78 : cv < 0.6 ? 62 : 48;
```

Possible causes are source-specific: solar has cloud cover / inverter causes, wind has turbine mechanical / curtailment.

### Module 2 — Fraud Detection

Statistical anomaly scoring using z-score and the standard normal CDF:

```javascript
function zScore(value, mean, std) {
  return std > 0 ? (value - mean) / std : 0;
}

// Abramowitz & Stegun polynomial approximation to Φ(z)
function normalCDF(z) {
  const t    = 1 / (1 + 0.2316419 * Math.abs(z));
  const poly = t * (0.319381530 + t * (-0.356563782
             + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  const cdf  = 1 - 0.3989422803 * Math.exp(-0.5 * z * z) * poly;
  return z >= 0 ? cdf : 1 - cdf;
}

// Two-tailed probability of observing this extreme a value
function extremeProbability(z) {
  return 2 * (1 - normalCDF(Math.abs(z)));
}
```

Classification:

| |z| | fraudStatus | Interpretation |
|------|-------------|----------------|
| > 4 | `flagged` | < 0.006% probability — highly anomalous |
| > 2.5 | `suspicious` | < 1.2% probability — investigate |
| ≤ 2.5 | `normal` | Within expected range |

### Module 3 — Predictive Maintenance

```javascript
function linearSlope(arr) {
  // Ordinary least squares on 30-day history
  // Returns kWh/day trend (negative = declining)
}

function maintenanceAnalysis(meter, history) {
  const slope        = linearSlope(history);
  const avgOutput    = mean(history);
  const observedPct  = Math.abs(slope / avgOutput) * 100;  // % decline per day
  const expectedPct  = meter.degradationRate * 100;         // spec degradation
  const ratio        = observedPct / expectedPct;           // >1 = worse than expected

  if (ratio > 8)  → 'urgent'   (immediate inspection)
  if (ratio > 4)  → 'inspect'  (within 14 days)
  if (ratio > 2)  → 'monitor'  (within 30 days)
  else            → 'ok'
}
```

### Health score formula

```javascript
function healthScore(opStatus, fraudStatus, maintStatus) {
  let score = 100;
  if (opStatus   === 'warning')    score -= 20;
  if (opStatus   === 'critical')   score -= 40;
  if (fraudStatus=== 'suspicious') score -= 20;
  if (fraudStatus=== 'flagged')    score -= 45;
  if (maintStatus=== 'monitor')    score -= 10;
  if (maintStatus=== 'inspect')    score -= 20;
  if (maintStatus=== 'urgent')     score -= 35;
  return Math.max(0, score);       // floor at 0
}
```

---

## 10. Frontend (React + Vite)

### Routing (`App.jsx`)

```
/                → LandingPage
/marketplace     → Marketplace
/portfolio       → Portfolio
/auditor         → AIAuditor
/passport        → PassportPage
/verify/:tokenId → VerifyPage
/embed/:tokenId  → EmbedBadge   (no navbar, for <iframe>)
/issue           → IssueRec     (visible only when isIssuer)
```

All routes except `/embed/*` are wrapped in `Web3Provider`.

### Web3Context

`client/src/context/Web3Context.jsx` manages MetaMask connection:

```javascript
// Network switching sequence:
// 1. wallet_switchEthereumChain(TARGET_CHAIN_ID)
// 2. On error 4902 (chain not added) → wallet_addEthereumChain({
//      chainId: TARGET_CHAIN_ID,
//      rpcUrls: [VITE_RPC_URL],
//      chainName: NETWORK_NAME,
//    })

// Contract instance: ethers.BrowserProvider → getSigner → new ethers.Contract(...)
```

Exposes: `{ account, contract, isIssuer, connecting, error, connect }`

`isIssuer` is determined by checking `contract.hasRole(ISSUER_ROLE, account)` after connection.

### config.js

```javascript
export const DEMO_MODE       = import.meta.env.VITE_DEMO_MODE === 'true';
export const TARGET_CHAIN_ID = import.meta.env.VITE_CHAIN_ID    || '0xaa36a7';
export const NETWORK_NAME    = import.meta.env.VITE_NETWORK_NAME || 'Sepolia';
export const CONTRACT_ADDRESS = import.meta.env.VITE_CONTRACT_ADDRESS || '0x000...';

export const ENERGY_SOURCES = ['Solar', 'Wind', 'Hydro', 'Biomass', 'Geothermal', 'Other'];
export const SOURCE_ICONS   = { Solar: '☀️', Wind: '💨', Hydro: '💧', ... };
export const CO2_PER_MWH    = 0.35;   // EU grid average tCO₂/MWh
```

### api.js — unified data layer

```javascript
// In DEMO_MODE: returns static data from demo.js instantly (no HTTP)
// Otherwise: fetches from VITE_API_URL (default: relative /api)

export async function fetchListings()          // → DEMO_LISTINGS or GET /api/listings
export async function fetchRec(tokenId)        // → DEMO_RECS[id] or GET /api/recs/:id
export async function fetchPortfolio(address)  // → DEMO_HOLDINGS or GET /api/listings/portfolio/:address
export async function fetchAuditSummary()      // → DEMO_AUDIT_SUMMARY or GET /api/audit/summary
export async function fetchAuditDetail(id)     // → DEMO_AUDIT_DETAIL[id] or GET /api/audit/meter/:id
```

All components import from `api.js` — never call `fetch('/api/...')` directly.

### Vite alias

```javascript
// vite.config.js
resolve: {
  alias: {
    '@contracts': path.resolve(__dirname, './src/contracts'),
  }
}
```

`import artifact from '@contracts/RecDapp.json'` resolves to `client/src/contracts/RecDapp.json` — the ABI-only file committed to the repo (18 KB vs 2 MB full Truffle artifact).

### Key component patterns

**Portfolio** — animated counters on stat cards:
```javascript
function useCounter(target, duration = 1200) {
  // ease-out-cubic interpolation: 1 - (1-p)^3
  // Updates at 60fps via setInterval(16ms)
}
```

**PassportPage** — client-side QR code:
```javascript
import('qrcode').then(QRCode => {
  QRCode.toCanvas(canvasRef.current, verifyUrl, { width: 140, margin: 1 });
});
```

**AIAuditor** — health gauge SVG:
```javascript
// Circular progress using SVG strokeDasharray
const circ = 2 * Math.PI * 28;       // r=28
const dash  = (score / 100) * circ;
<circle strokeDasharray={`${dash} ${circ - dash}`}
        transform="rotate(-90 36 36)" />
```

---

## 11. Demo Mode

When `VITE_DEMO_MODE=true`:

- `api.js` returns static data from `demo.js` instantly — no HTTP requests
- Portfolio shows 14 RECs without wallet
- Marketplace shows 6 listings without wallet
- AI Auditor shows full 5-meter analysis without backend
- Carbon Passport shows certificates without blockchain
- MetaMask connection is optional (connect to trade, not to view)
- PDF download buttons are disabled (backend not available)

### demo.js data model

```javascript
DEMO_RECS         // { [tokenId]: { valid, remaining, metadata } }
DEMO_HOLDINGS     // Array<{ tokenId, balance, retired, valid, metadata }>
DEMO_LISTINGS     // Array<{ id, tokenId, amount, pricePerKwh, seller, metadata }>
DEMO_AUDIT_SUMMARY // Array<{ meterId, siteName, healthScore, opStatus, ... }>
DEMO_AUDIT_DETAIL  // { [meterId]: { operational:{}, fraud:{}, maintenance:{} } }
DEMO_MONTHLY      // Array<{ month, production, retired, co2 }> (6 months)
```

---

## 12. Chainlink Functions Oracle

### How it works

1. Admin calls `setFunctionsSource(jsSourceCode)` — stores the JavaScript that will run in the DON
2. Admin calls `setDonConfig(donId, subscriptionId, callbackGasLimit)`
3. Issuer calls `requestAutoIssuance(producer, source, location, meterId)`
4. Chainlink DON executes the JS off-chain, passing `meterId` as argument
5. DON calls `fulfillRequest(requestId, encodedKwh, err)` on-chain
6. If `kwh >= 1000` → tokens minted

### Chainlink Functions JS source (runs in DON)

```javascript
// Example source stored via setFunctionsSource()
const meterId = args[0];
const response = await Functions.makeHttpRequest({
  url: `https://your-iot-api.com/meter/${meterId}/reading`,
  method: 'GET',
});

if (response.error) throw Error('IoT API error');

const kwh = response.data.kwh;

// 3-sigma anomaly check
const historical = response.data.historical_mean;
const std        = response.data.historical_std;
const zScore     = (kwh - historical) / std;

if (Math.abs(zScore) > 4) throw Error('Anomaly detected — issuance rejected');

// Return abi-encoded uint256
return Functions.encodeUint256(Math.floor(kwh));
```

### Configuration on Sepolia

```
Functions Router: 0xb83E47C2bC239B3bf370bc41e1459A34b41238D0
DON ID:           fun-ethereum-sepolia-1
```

Subscription management: [functions.chain.link](https://functions.chain.link)

### Oracle vs Manual issuance

| Aspect | Manual | Oracle |
|--------|--------|--------|
| Who triggers | Human (ISSUER_ROLE) | ISSUER_ROLE + IoT data |
| `dataHash` | `ipfs://Qm...` | `oracle://METER_GR_001` |
| Fraud check | None (human judgment) | 3-sigma in JS source |
| Verifiability | PDF + IPFS | On-chain request ID + DON logs |

---

## 13. Scripts Reference

### `seed.js`

Creates 14 RECs across 5 Greek sites with realistic demo data.

```bash
node scripts/seed.js             # send all transactions
node scripts/seed.js --dry-run   # preview without transactions
```

Uses `ethers.NonceManager` to prevent nonce conflicts when transactions are sent in rapid sequence to a Hardhat automining node.

### `post-deploy.js`

```bash
node scripts/post-deploy.js 0x<contract_address>
```

1. Reads `.env`
2. Replaces/adds `CONTRACT_ADDRESS=0x...`
3. Writes/overwrites `client/.env.local` with `VITE_CONTRACT_ADDRESS`

### `grant-issuer.js`

```bash
node scripts/grant-issuer.js
```

Grants `ISSUER_ROLE` to the address derived from `ISSUER_PRIVATE_KEY`. Checks `hasRole` first — idempotent.

### npm scripts (root)

| Command | Action |
|---------|--------|
| `npm run server` | Start Express API on port 3001 |
| `npm run client:dev` | Start Vite dev server on port 5173 |
| `npm run client:build` | Build frontend to `client/dist/` |
| `npm run seed` | Run seed.js |
| `npm run seed:dry` | Run seed.js --dry-run |
| `npm run post-deploy` | Run post-deploy.js |
| `npm run grant-issuer` | Run grant-issuer.js |

---

## 14. API Reference

Base URL (local): `http://localhost:3001`  
Base URL (production): proxied via Vercel `/api/*` → Render

### Health

```
GET /api/health
→ { status: "ok", timestamp: 1234567890 }
```

### RECs

```
GET  /api/recs/:tokenId
→ { tokenId, valid, remaining, metadata: { issuer, producer, source,
    kwh, location, issuedAt, expiresAt, fullyRetired, dataHash } }

GET  /api/recs/:tokenId/passport
GET  /api/recs/:tokenId/passport?download=1
→ application/pdf

POST /api/recs/issue
Body: { producer, source (0-5), kwh, location, dataHash }
→ { txHash, tokenId, gasUsed }
```

### Listings

```
GET /api/listings
→ Array<{ id, seller, tokenId, amount, pricePerKwh, active, valid, metadata }>

GET /api/listings/:listingId
→ { id, seller, tokenId, amount, pricePerKwh, active, valid, metadata }

GET /api/listings/portfolio/:address
→ Array<{ tokenId, balance, retired, valid, metadata }>
```

### Audit

```
GET /api/audit/meters
→ Array<{ id, name, source, region }>

GET /api/audit/summary
→ Array<{
    meterId, siteName, source, region, healthScore,
    opStatus,    // "ok" | "warning" | "critical"
    fraudStatus, // "normal" | "suspicious" | "flagged"
    maintStatus, // "ok" | "monitor" | "inspect" | "urgent"
    alerts       // string[]
  }>

GET /api/audit/meter/:meterId
→ {
    meterId, siteName, source, region, timestamp, healthScore,
    operational: {
      expected, actual, deviationPct, status,
      possibleCauses: [{ cause, probability }],
      confidence
    },
    fraud: {
      zScore, historicalProbability, status, spikePct, message
    },
    maintenance: {
      component, expectedDegradationPct, observedDegradationPct,
      ratio, status, recommendation, daysUntil
    }
  }
```

---

## 15. Production Deployment

### Architecture

```
Vercel (frontend)  ←→  Render (backend API)  ←→  Alchemy (Ethereum RPC)
```

### Frontend — Vercel

```bash
# From repo root
cd client
vercel build --prod          # builds to .vercel/output/
vercel deploy --prebuilt --prod
```

`client/vercel.json` configures:
1. `/api/:path*` → proxied to `https://recchain-api.onrender.com/api/*`
2. `/(.*)`       → `/index.html` (SPA catch-all for React Router)

Environment variables set automatically from `client/.env.production`:
```
VITE_DEMO_MODE=true
VITE_CHAIN_ID=0xaa36a7
VITE_NETWORK_NAME=Sepolia
```

### Backend — Render

`render.yaml` at repo root:

```yaml
services:
  - type: web
    name: recchain-api
    env: node
    buildCommand: npm install
    startCommand: node server/index.js
    envVars:
      - key: CONTRACT_ADDRESS
      - key: ALCHEMY_API_KEY
      - key: ISSUER_PRIVATE_KEY
      - key: RPC_URL
      - key: FRONTEND_URL
        value: https://your-app.vercel.app
```

### Re-deploy after code changes

```bash
cd client
vercel build --prod && vercel deploy --prebuilt --prod
```

> **Why `--prebuilt`?** The first time Vercel was deployed, it failed to build remotely because untracked files (`api.js`, `demo.js`, `src/contracts/`) were not in git. Building locally and uploading the pre-built output bypasses this issue. After `git add` + `git commit` of all new files, standard `vercel --prod` will work.

### CORS for custom domain

Add to `.env` on Render:
```bash
FRONTEND_URL=https://recchain.yourdomain.com
```

---

## Appendix — Known Issues & Decisions

| Issue | Cause | Resolution |
|-------|-------|------------|
| Ganache incompatible with Node v24 | Missing `µWS` binary for ARM/Node24 | Use `npx hardhat node` instead |
| Hardhat v3 requires ESM | Project uses CommonJS (`require()`) | Install Hardhat v2 (`hardhat@^2`) |
| `invalid opcode` on Truffle migrate | OpenZeppelin v5 uses `mcopy` (Cancun only) | Add `evmVersion: 'cancun'` to both Hardhat and Truffle configs |
| Nonce conflicts on seed script | ethers.js caches nonces; Hardhat automines | Wrap wallet in `new ethers.NonceManager(wallet)` |
| `@contracts` alias fails on Vercel | Truffle artifact in `../build/` not uploaded | Created ABI-only `client/src/contracts/RecDapp.json` (18KB) |
| Web3Context forced Sepolia switch | Hardcoded chain ID | Read `TARGET_CHAIN_ID` from `VITE_CHAIN_ID` env var |
| AIAuditor white screen | `/api/audit/summary` returns flat `opStatus`, detail returns nested | Use `??` fallback: `report.opStatus ?? report.operational?.status` |
