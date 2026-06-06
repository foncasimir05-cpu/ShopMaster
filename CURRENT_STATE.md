# ShopMaster — Current State

**Last updated:** 2026-06-06  
**Git branch:** master  
**GitHub remote:** https://github.com/foncasimir05-cpu/ShopMaster.git

---

## What Is Built and Working

### Mobile App (React Native / Expo SDK 51)

| Feature | Status |
|---|---|
| Shop registration (owner creates shop + account) | ✅ |
| Login with email + password + shopId | ✅ |
| JWT auto-refresh on 401 (silent token renewal) | ✅ |
| Startup token expiry check (stale tokens cleared) | ✅ |
| POS screen — add items by barcode or product list | ✅ |
| Cash / payment checkout flow | ✅ |
| Barcode camera scanner (expo-camera, torch toggle) | ✅ |
| USB barcode scanner fallback on web | ✅ |
| Products screen — list, add, edit, delete | ✅ |
| Inventory screen — stock levels, low-stock filter, manual adjust | ✅ |
| Sales history with void/refund | ✅ |
| Daily / weekly / monthly sales reports | ✅ |
| Invoice PDF preview and print | ✅ |
| Settings screen — shop name, address, tax, currency | ✅ |
| User management — add/edit/deactivate staff | ✅ |
| Currency: Cameroon Francs (XAF) throughout | ✅ |
| App icon: navy #1a2e4a with gold "SM" initials | ✅ |
| EAS build config (eas.json) for APK generation | ✅ |

### Backend (Node.js / Express)

| Feature | Status |
|---|---|
| REST API on port 3001 | ✅ |
| SQLite via sql.js (pure JS, no native compilation) | ✅ |
| Multi-tenant architecture (each shop is isolated) | ✅ |
| JWT access tokens (8h default, 30d in .env) | ✅ |
| Refresh token rotation (30-day TTL) | ✅ |
| Products CRUD | ✅ |
| Sales creation with FK-ordered transaction | ✅ |
| Stock movements tracking | ✅ |
| Sales void + stock restore | ✅ |
| Inventory adjustment (admin only) | ✅ |
| Shop settings CRUD | ✅ |
| Staff / user management | ✅ |
| Invoice PDF generation (pdfmake, XAF currency) | ✅ |
| `/health` endpoint for Railway health checks | ✅ |
| Railway deployment config (Procfile, railway.json) | ✅ |

---

## Railway Deployment Status

**Status:** Config committed, awaiting successful deploy.

**Blocker history:**
1. Node 18 default had no C++ build tools → `better-sqlite3` failed to compile
2. `nixpacks.toml` pinning Node 22 was ignored by Railway
3. **Resolution:** Replaced `better-sqlite3` with `sql.js` (pure JS/WebAssembly) — no compilation required

**To deploy:**
```
git push origin master
```
Then in Railway dashboard → Redeploy (or it triggers automatically on push).

**Railway environment variables to set:**
```
JWT_SECRET=<random 64-char string>
JWT_EXPIRES_IN=30d
DB_PATH=/data/shopmaster.db   ← only if using a Railway Volume
```

**Important:** Railway's default filesystem is ephemeral — the SQLite database file is wiped on each redeploy. To persist data, add a Railway Volume mounted at `/data` and set `DB_PATH=/data/shopmaster.db`.

**After deploy:** Update `mobile/src/services/api.js` fallback URL and `mobile/.env.production` with the Railway public URL (e.g. `https://shopmaster-xxxx.railway.app`).

---

## Pending Tasks

- [ ] Push to GitHub and confirm Railway deploy succeeds
- [ ] Add Railway Volume for persistent SQLite storage
- [ ] Update mobile API URL to Railway public URL
- [ ] Build and distribute APK via `cd mobile && eas build --platform android --profile preview`
- [ ] Test end-to-end on physical Android device against Railway backend

---

## Important File Paths

### Mobile
```
mobile/
  src/
    components/
      BarcodeScanner.js          # expo-camera scanner (Android/iOS)
      BarcodeScanner.web.js      # USB keyboard scanner fallback (web)
      InvoicePreview.js          # PDF print component
    context/
      AuthContext.js             # JWT storage, login/logout, startup expiry check
    navigation/
      AppNavigator.js            # React Navigation stack
    screens/
      auth/LoginScreen.js
      auth/RegisterShopScreen.js
      pos/POSScreen.js           # Main POS / checkout
      pos/PaymentModal.js
      pos/CartItem.js
      HomeScreen.js              # Dashboard
      ProductsScreen.js
      SalesScreen.js
      InventoryScreen.js
      sales/SalesHistoryScreen.js
      settings/SettingsScreen.js
      settings/UserManagementScreen.js
    services/
      api.js                     # Axios instance + 401 refresh interceptor
      storage.js                 # AsyncStorage wrapper (static import)
  assets/
    icon.png                     # 1024x1024 SM initials (navy/gold)
    adaptive-icon.png            # 1024x1024
    splash.png                   # 1024x1024
    favicon.png                  # 48x48
  scripts/
    generateIcon.js              # Regenerate icons: node mobile/scripts/generateIcon.js
  app.json                       # Expo config (expo-camera plugin, Android permissions)
  .env.production                # EXPO_PUBLIC_API_URL=http://10.67.115.93:3001/api/v1
  eas.json                       # EAS build profiles
```

### Backend
```
backend/
  src/
    auth/
      authRoutes.js              # register-shop, login, refresh, /me
    config/
      database.js                # sql.js init, _save(), createTables()
      dbHelpers.js               # dbGet / dbAll / dbRun / dbTransaction
    middleware/
      authenticateToken.js       # JWT verify → req.user + req.shopId
      auth.js                    # (legacy, unused — requireAuth/signToken)
      tenantIsolation.js         # Cross-tenant guard (unused in current routes)
    routes/
      products.js
      sales.js                   # Includes report routes + invoice endpoint
      inventory.js
      settings.js                # settingsRouter + usersRouter
    services/
      pdf.js                     # pdfmake invoice generator (XAF currency)
      sync.js                    # (unused)
    index.js                     # Express app entry point
  .env                           # JWT_SECRET, JWT_EXPIRES_IN=30d (gitignored)
  .env.example                   # Safe-to-commit template
  Procfile                       # web: node src/index.js
  railway.json                   # Nixpacks builder + healthcheck config
  package.json
```

### Shared
```
shared/
  utils/index.js                 # formatCurrency (XAF), timeAgo, computeCartTotals
  types/index.js
  index.js
```

---

## Key Configuration Values

| Setting | Value |
|---|---|
| Local backend URL | `http://10.67.115.93:3001` |
| Expo SDK | 51 |
| React Native | 0.74.1 |
| Database | SQLite via sql.js 1.10.3 |
| Token expiry (dev) | 30 days |
| Token expiry (default) | 8 hours |
| Currency | XAF (Cameroon Francs) |
| Android package | `com.shopmaster.app` |
| iOS bundle ID | `com.shopmaster.app` |
| EAS project ID | `bdbc962f-b11c-4ba7-92f3-d14ae53cc895` |
