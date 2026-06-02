# ShopMaster

A full-stack, cross-platform shop management application for small and medium businesses. Runs on Android (via Expo) and desktop/web browsers, works **offline-first** with local SQLite storage and an optional backend sync layer.

## Features

- **Multi-tenant auth** — each shop is an isolated tenant with JWT-based login
- **Product & inventory management** — CRUD operations with stock tracking
- **Point-of-sale (POS)** — barcode scanning (camera on mobile, USB HID on desktop), cart, and checkout
- **Invoicing** — auto-generated PDF invoices per transaction
- **Offline-first** — SQLite (via `better-sqlite3`) stores all data locally; syncs with the Express backend when online
- **Cross-platform** — single Expo codebase targets Android and web/PC

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React Native + Expo (Android & Web) |
| Backend | Node.js + Express |
| Database | SQLite via `better-sqlite3`; `lowdb` fallback |
| Barcode | `expo-barcode-scanner` (mobile), `node-hid` / `usb` (desktop) |
| Auth | JWT multi-tenant |
| PDF | `pdfmake` (backend), `react-native-html-to-pdf` (mobile) |

## Monorepo Structure

```
shopmaster/
  ├── backend/      # Express REST API
  ├── mobile/       # Expo React Native app (Android + Web)
  ├── shared/       # Shared types and utility helpers
  └── README.md
```

## Getting Started

### Prerequisites

- Node.js >= 18
- npm >= 9 (workspaces support)
- Expo CLI: `npm install -g expo-cli`

### Install dependencies

```bash
npm install
```

### Run the backend

```bash
npm run dev:backend
```

The API starts on `http://localhost:3001` by default.

### Run the mobile / web app

```bash
npm run dev:mobile
```

Press `w` to open the web build, or scan the QR code with Expo Go on Android.

## Environment Variables

Create `backend/.env` (copy from `backend/.env.example`):

```
PORT=3001
JWT_SECRET=change_me_in_production
DB_PATH=./data/shopmaster.db
```

## License

MIT
