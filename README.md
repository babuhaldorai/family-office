# Family Office — Financial Management Portal

A private, role-based web app for managing Tea Plantation and Rental Home finances.
Built with **React + Firebase (Auth + Firestore)**, deployed on **Netlify**.

---

## Features

| Module | What it does |
|---|---|
| **Overview → Dashboard** | Consolidated KPIs and monthly income/expense chart across Tea, Rentals and Homes |
| **Overview → Reports** | Consolidated P&L Statement, Operating Statement and By Segment view, by month and year |
| **Overview → YOY** | Year-over-year revenue, expense and net comparison, charts + table |
| **Tea Plantation** | Harvest log (bags, deductions, net kg), agent rates & payments, worker wages (per kg or daily wage), advances, settlements, maintenance, inventory, lease, weather, analytics and Tea YOY |
| **Rental Homes** | Properties, tenants, lease alerts, rental income/expense ledger and Rental YOY |
| **Homes & Expenses** | Home maintenance and expense ledger with Home YOY |
| **Insights** | Rule-based flags, forecasts and AI recommendations (Netlify function) |
| **User Management** | Invite users, assign Admin/Viewer roles (max 10 users) — admin only |

### Worker pay

Each harvest session pays its worker either **per kg** (net kg × ₹6) or a **daily wage** (days × daily rate).
Set a worker's default under Tea → People; it can be changed per session on the harvest form.
Sessions saved before this option existed are treated as per kg.

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
