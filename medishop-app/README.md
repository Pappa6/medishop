# MediShop inventory — starter app (v1)

This is a real, runnable React Native (Expo) app implementing the core
counter workflow from the product requirements document: shop
registration/login (multi-tenant), quick dispense, simulated scan,
quantity + live pricing with discounts, stock deduction, a bill preview,
and an owner dashboard with sales history and a void / reversal flow.

## What works right now

- **Any shop can create its own account** (shop name, email, password) or
  log into an existing one — this is the same app build for every shop,
  each shop's data kept completely separate (multi-tenant, see
  "Architecture" below)
- Quick dispense buttons by symptom (fever, cough and cold, loose motions,
  minor injury)
- A "scan" button that simulates picking up a medicine (see "Next steps"
  below for real barcode scanning)
- Quantity stepper with live price, including per-item discounts
- Confirm sale: deducts stock, saves a timestamped log entry, shows a bill
  preview with batch number and expiry auto-filled
- Owner dashboard: current stock levels, full sales history, and a
  "void this sale" flow that restores stock and adds a linked reversal
  entry instead of silently editing the original record
- All data is stored in Firebase (cloud), scoped to the logged-in shop, so
  it survives closing the app, switching phones, or reinstalling

## Firebase setup (do this once, before running the app)

This app needs its own free Firebase project to store data. This is all
done by clicking on a website — no coding.

1. Go to [https://console.firebase.google.com](https://console.firebase.google.com)
   and sign in with any Google account
2. Click **Add project**, give it any name (e.g. "medishop-inventory"),
   finish the setup wizard (you can turn off Google Analytics, it isn't
   needed)
3. Inside your new project, click **Build > Authentication > Get started**,
   then enable the **Email/Password** sign-in method
4. Click **Build > Firestore Database > Create database**, choose
   **Start in test mode** for now (see the security note below), pick any
   location
5. Click the gear icon near "Project Overview" > **Project settings**,
   scroll to "Your apps", click the **</>** (web) icon to register a new
   web app (any nickname is fine)
6. Firebase will show you a `firebaseConfig` object with keys like
   `apiKey`, `authDomain`, etc. Create a file named `.env` in the project
   root — copy `.env.example`, rename the copy to `.env`, and fill in
   each value from the Firebase config. This keeps your real keys out of
   GitHub; `.env` is already listed in `.gitignore`, `.env.example` is
   not (it has no real values, so it's safe to share)

**Important security note:** "test mode" Firestore rules allow anyone to
read or write any data for about 30 days, then lock everyone out. Before
real shops start using this, replace the rules (Firestore Database >
Rules tab) with something like:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /shops/{shopId} {
      allow read, write: if request.auth != null && request.auth.uid == shopId;
      match /{document=**} {
        allow read, write: if request.auth != null && request.auth.uid == shopId;
      }
    }
  }
}
```

This ensures a shop can only ever read or write its own data, never
another shop's — this is what actually makes the multi-tenant isolation
real, not just a convention in the code.

## Testing right now without billing (recommended if billing is stuck)

If enabling billing on the Firebase console is giving trouble, you don't
need to solve that before testing the app. Firebase's **Local Emulator
Suite** runs Auth and Firestore entirely on your own computer — no
billing, no card, no UPI needed at all.

1. You'll need [Java](https://www.java.com/download) installed too (the
   emulator needs it) — install it if you don't have it already
2. In a terminal, install the Firebase command-line tool once:
   ```
   npm install -g firebase-tools
   firebase login
   ```
   This just asks you to log into the same Google account — no billing
   involved in this step at all.
3. Inside this project folder, run:
   ```
   firebase init emulators
   ```
   When it asks which emulators to set up, select **Authentication** and
   **Firestore** (use spacebar to select, then Enter). Accept the default
   ports it suggests.
4. Start the emulators:
   ```
   firebase emulators:start
   ```
   Leave this running in its own terminal window.
5. Find your computer's local network IP address (so your phone can
   reach it): on Windows, open a new terminal and run `ipconfig`, look for
   "IPv4 Address" (something like `192.168.1.5`). Make sure your phone is
   on the **same Wi-Fi network** as your computer.
6. Open `src/firebaseConfig.js` and replace the placeholder IP in the
   `HOST` constant with your real one from step 5. `USE_EMULATOR` is
   already set to `true`.
7. Now run the app as usual (`npx expo start`) — it will talk to the
   emulator on your computer instead of the real cloud. Sign-up, login,
   stock, and sales log will all work exactly the same way.

When billing is eventually sorted out on the real Firebase project, just
set `USE_EMULATOR` back to `false` in `src/firebaseConfig.js` — nothing
else changes.

## How to run this on your own phone (no coding needed for this step)

1. Install [Node.js](https://nodejs.org) on a computer (any recent LTS
   version)
2. Install the Expo Go app on your phone from the Play Store (Android) or
   App Store (iPhone)
3. Complete the Firebase setup above first
4. Open a terminal in this folder and run:
   ```
   npm install
   npx expo start
   ```
5. A QR code will appear in the terminal. Scan it with the Expo Go app
   (Android: in-app scanner; iPhone: regular camera app, then tap the
   notification)
6. The app will open live on your phone. Create a shop account on first
   launch — that becomes your shop's private data going forward

## Architecture: how one app serves every shop

- `src/firebaseConfig.js` connects the app to your Firebase project
- `src/auth.js` handles shop sign-up and login. On sign-up, a shop's
  Firebase user id (`uid`) becomes its permanent shop/tenant id, and a
  starter catalog is seeded for it automatically
- `src/storage.js` reads and writes every shop's stock and sales log under
  `shops/{shopId}/...` in Firestore — every function takes `shopId` as its
  first argument, so data can never leak between shops by accident
- `App.js` shows the login screen (`src/AuthScreen.js`) until a shop is
  logged in, then loads that shop's own data by its `shopId`

## Next steps for a developer (in rough priority order)

1. **Real barcode scanning** — replace `simulateScan()` in `App.js` with
   `expo-camera`'s barcode scanning API. Everything downstream (cart,
   pricing, stock deduction) is already written to accept any item id, so
   this is a self-contained swap.
2. **Staff vs owner roles within a shop** — right now, anyone logged into
   a shop's account sees everything, including the Owner dashboard. Add a
   second, more restricted login type (e.g. a staff PIN tied to the same
   shop) that hides the Owner dashboard button entirely.
3. **Multi-device real-time sync** — this app already reads/writes through
   Firestore, so multiple counter devices logged into the same shop should
   already see each other's changes on refresh. For true real-time
   updates (no manual refresh needed), switch `getDoc`/`setDoc` in
   `storage.js` to Firestore's `onSnapshot` live listeners.
4. **Offline queue** — Firestore has built-in offline support for React
   Native; enabling it in `firebaseConfig.js` lets the app queue writes
   automatically when offline and sync when connectivity returns.
5. **Real printer / WhatsApp bill output** — the bill preview currently
   just displays on-screen. Add `expo-print` for a physical thermal
   printer, or a WhatsApp share link, from the `BillPreview` component.
6. **Bulk CSV import** for medium shops with larger catalogs, replacing
   the seeded `DEFAULT_CATALOG` with a real import screen.
7. **Demand forecasting, prescription OCR, auto reorder, WhatsApp/SMS
   refill reminders** — these are backend/ML features from the PRD that
   sit outside this mobile starter; they'd be built as backend services
   (e.g. Firebase Cloud Functions) this app calls.
8. **Payment gateway for subscriptions** — needed before charging shops,
   e.g. Razorpay or Stripe, gating access by subscription tier per shop.

## Project structure

```
medishop-app/
  App.js                 main screen: login gate + counter view + owner dashboard
  src/firebaseConfig.js   reads your Firebase keys from .env — nothing to edit here
  .env                    your real Firebase keys — never uploaded to GitHub
  .env.example            template showing what .env should contain
  src/auth.js             shop sign-up / login / logout
  src/AuthScreen.js       the login/signup screen shown before entering the app
  src/catalog.js          starter medicine data and pricing helpers
  src/storage.js          all data persistence, scoped per shop — the file
                          to change first for real-time sync or offline queueing
  package.json
  app.json
```
