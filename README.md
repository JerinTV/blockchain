<div align="center">

<h1>🔐 FAKE-PRODUCT</h1>

<h3>NFC + Blockchain Product Authenticity & Lifecycle Tracking</h3>

<img src="https://img.shields.io/badge/React-Vite-61DAFB?style=for-the-badge&logo=react&logoColor=black" />
<img src="https://img.shields.io/badge/Node.js-Express-339933?style=for-the-badge&logo=node.js&logoColor=white" />
<img src="https://img.shields.io/badge/Solidity-Contract-363636?style=for-the-badge&logo=solidity&logoColor=white" />
<img src="https://img.shields.io/badge/Prisma-ORM-2D3748?style=for-the-badge&logo=prisma&logoColor=white" />
<img src="https://img.shields.io/badge/PostgreSQL-Database-4169E1?style=for-the-badge&logo=postgresql&logoColor=white" />
<img src="https://img.shields.io/badge/Hardhat-Local%20Chain-F7DC6F?style=for-the-badge&logo=ethereum&logoColor=black" />

<br/><br/>

> **Stop counterfeits before they reach customers.**
> Every product is registered on-chain, NFC-signed, and verifiable in seconds.

</div>

---

## 🧭 Overview

| Layer | Stack |
|-------|-------|
| 🖥️ Frontend | React + Vite — Admin, Manufacturer, Retailer, User dashboards |
| ⚙️ Backend | Node.js / Express + Prisma + PostgreSQL |
| ⛓️ Blockchain | Solidity `TrustChain.sol` on Hardhat (local / EVM) |
| 📡 NFC | Challenge-response verification flow for end-user authenticity checks |

---

## 🔄 Product Lifecycle Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                   │
│  1. 🏭 Manufacturer calls /prepare-batch  →  gets signed token   │
│  2. ⛓️  Frontend sends registerBatchProducts(...) on-chain       │
│  3. ✅  Frontend calls /finalize-batch (draftToken + txHash)     │
│  4. 💾  Backend verifies tx → writes Box/Product rows to DB      │
│  5. 🚚  Ship / Verify / Sold — chain first, then DB sync         │
│  6. 📱  User scans NFC → /challenge → /verify → result shown     │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## ✨ Key Features

- 🔐 **2-step safe registration** — `prepare-batch` + `finalize-batch` with on-chain verification
- 🛡️ **NFC challenge-response** — cryptographic product authenticity for end users
- 🏪 **Retailer verification** — box-wise verify with dynamic UI
- 🧑‍💼 **Admin dashboard** — manufacturer overview, box-id filtering, status styling
- 📦 **Shipping address tracking** — captured at ship time, stored on Box record
- 💰 **Single-tx box sale** — `saleBox(string boxId)` on-chain
- 🎨 **Semantic status UI** — `success / info / warning / error` message types

---

## 📁 Project Structure

```
FAKE-PRODUCT/
├── 🔧 backend/
│   ├── server.js
│   ├── routes/
│   ├── middleware/
│   ├── prisma/
│   │   ├── schema.prisma
│   │   └── migrations/
│   ├── nfc_emulator/
│   └── abi.json
│
├── ⛓️  contracts/
│   └── TrustChain.sol
│
├── 📜 scripts/
│   └── deploy.cjs
│
├── 🖥️  src/
│   ├── pages/Dashboards/
│   │   ├── AdminDashboard.jsx
│   │   ├── ManufacturerDashboard.jsx
│   │   ├── RetailerDashboard.jsx
│   │   └── UserDashboard.jsx
│   ├── services/api.js
│   ├── trustChain.js
│   ├── TrustChainAbi.json
│   └── index2.css
│
├── hardhat.config.cjs
└── package.json
```

---

## 🚀 Setup & Installation

> **Requires:** Node.js, PostgreSQL running locally

### Step 1 — Start Hardhat local chain

```bash
npx hardhat node
```

### Step 2 — Compile & deploy contract

```bash
npx hardhat compile
npx hardhat run scripts/deploy.cjs --network localhost
```

> 📋 Copy the deployed contract address — you'll need it for env config.

### Step 3 — Configure environment variables

**Frontend** (`.env` in project root):
```env
VITE_CONTRACT_ADDRESS=0x...
```

**Backend** (`backend/.env`):
```env
RPC_URL=http://127.0.0.1:8545
CONTRACT_ADDRESS=0x...
PRIVATE_KEY=0x...
JWT_SECRET=...
```

### Step 4 — Run database migrations

```bash
cd backend
npx prisma migrate dev
```

### Step 5 — Start backend & frontend

```bash
# Terminal 1 — Backend
cd backend
node server.js

# Terminal 2 — Frontend
npm run dev
```

🌐 Frontend: **[Live](https://supply-chain-1-0rut.onrender.com)**

---

## 📡 API Endpoints

### 🔑 Auth
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/auth/register` | Register user |
| `POST` | `/api/auth/login` | Login & get JWT |

### 📦 Batch Registration
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/prepare-batch` | Step 1 — get signed draft token |
| `POST` | `/finalize-batch` | Step 2 — verify tx & write to DB |

### 🔍 Admin Queries
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/admin/manufacturers` | List manufacturers |
| `GET` | `/api/admin/batches` | List batches |
| `GET` | `/api/admin/boxes` | List boxes |
| `GET` | `/api/admin/products` | List products |

### 🔄 Chain Sync
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/db/box/:boxId/ship` | Sync ship status |
| `POST` | `/api/db/box/:boxId/verify` | Sync retailer verification |
| `POST` | `/api/db/box/:boxId/sold` | Sync sold status |
| `POST` | `/api/db/product/:productId/verify` | Product-level verify |
| `POST` | `/api/db/product/:productId/sold` | Product-level sold |

### 📱 Authenticity (User)
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/challenge` | Request NFC challenge |
| `POST` | `/verify` | Submit signed response, get result |

---

## ⚠️ Known Constraints

> Keep these in mind when developing or debugging:

- 🆔 `boxId` is unique **per manufacturer**, not globally — provide `manufacturerId` when IDs are ambiguous across manufacturers
- 🔗 Chain and DB must both point to the **same contract address**
- 🔄 If contract ABI or deployment changes → restart both backend and frontend
- 💼 Full custody transfer model (manufacturer → retailer → customer wallets) is **not yet enforced** at contract level
- 🛠️ If on-chain tx succeeds but DB is stale → re-run finalize or sync flow, avoid manual DB edits

---

<div align="center">

**Built with ❤️ to fight counterfeits**

`NFC` • `Blockchain` • `React` • `Node.js` • `Solidity` • `Prisma`

</div>
