# Family Office — Financial Management Portal

A private, role-based web app for managing Tea Plantation and Rental Home finances.
Built with **React + Firebase (Auth + Firestore)**, deployed on **Netlify**.

---

## Features

| Module | What it does |
|---|---|
| **Dashboard** | Consolidated KPIs, monthly revenue/expense chart for both segments |
| **Tea Plantation** | Income & expense ledger with category breakdown. Integration hook ready for your existing app. |
| **Properties** | Property portfolio with occupancy status |
| **Tenants** | Full tenant directory, lease dates, expiry alerts |
| **Rental Transactions** | Income & expense per property |
| **Reports → P&L** | Monthly P&L table + chart, annual summary |
| **Reports → Operating Statement** | Revenue & expense by category |
| **Reports → By Segment** | Side-by-side Tea vs Rentals monthly breakdown |
| **YOY Comparison** | 3-year revenue, expense, net trend — charts + table |
| **Admin → Users** | Invite users, assign Admin/Viewer roles (max 10 users) |

---

## Setup Instructions

### 1. Create a Firebase Project

1. Go to https://console.firebase.google.com
2. Create a new project (e.g. `family-office`)
3. Enable **Authentication → Sign-in method → Email/Password**
4. Enable **Firestore Database → Start in production mode**
5. Go to Project Settings → Your apps → Add a Web app
6. Copy the Firebase config values

### 2. Configure Environment Variables

```bash
cp .env.example .env.local
```

Fill in your Firebase values in `.env.local`.

### 3. Deploy Firestore Security Rules

```bash
npm install -g firebase-tools
firebase login
firebase init firestore
firebase deploy --only firestore:rules,firestore:indexes
```

### 4. Create Your First Admin User

1. Firebase Console → Authentication → Users → Add user (email + password)
2. Firestore → Create collection `users` → Document ID = the user's UID:
```json
{
  "email": "admin@yourfamily.com",
  "displayName": "Your Name",
  "role": "admin",
  "createdAt": "2024-01-01T00:00:00.000Z"
}
```
3. Log in → use Admin → Users page to invite everyone else.

### 5. Run Locally

```bash
npm install
npm start
```

### 6. Deploy to Netlify

**Via GitHub (recommended):**
1. Push repo to GitHub
2. New site from Git in Netlify
3. Build command: `npm run build` | Publish: `build`
4. Add all `REACT_APP_FIREBASE_*` env vars in Site Settings → Environment Variables
5. Deploy

**Via CLI:**
```bash
npm install -g netlify-cli
netlify login && netlify init
netlify deploy --prod
```

---

## Firestore Data Model

```
users/               {uid}  → { email, displayName, role, createdAt }
tea_transactions/    {id}   → { date, type, category, amount, description, year, month }
properties/          {id}   → { name, address, type, monthlyRent, description }
tenants/             {id}   → { name, email, phone, propertyId, leaseStart, leaseEnd, monthlyRent, deposit, status, notes }
leases/              {id}   → { tenantId, propertyId, start, end, rent }
rental_transactions/ {id}   → { date, type, category, amount, description, propertyId, year, month }
```

---

## Tea Plantation Integration (Future)

When your Tea app is ready to sync, two options:

**Option A — Shared Firestore:** Point both apps at the same Firebase project. Tea app writes to `tea_transactions`, this portal reads it automatically.

**Option B — REST API:** Add a sync function in `src/utils/firestoreService.js → teaService`. The integration banner on the Tea page marks exactly where to plug this in.

---

## Roles

| Role | Permissions |
|---|---|
| **Admin** | Full CRUD on all data + user management |
| **Viewer** | Read-only access to all financial data |

---

## Customisation

- **Currency**: Change `'INR'` in `src/utils/finance.js → fmt()`
- **Categories**: Edit `TEA_CATEGORIES` / `RENTAL_CATEGORIES` in `TransactionModal.js`
- **Years shown**: Change `LOAD_YEARS` in each page
- **Theme**: Edit CSS variables in `src/styles/global.css`
