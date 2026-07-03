# ITAB Property Services

Uganda's premier property brokerage and management PWA — built with React + TypeScript + Tailwind CSS + Node.js + PostgreSQL.

---

## 🚀 Quick Start (Local Development)

### 1. Frontend

```bash
cd itab-frontend
npm install
npm run dev
```

Opens at **http://localhost:5173** (or 5174 if 5173 is busy)

### 2. Backend (optional for full functionality)

```bash
cd itab-backend
cp .env.example .env
# Edit .env with your database URL and secrets
npm run dev
```

Runs at **http://localhost:5000**

---

## 🔑 Demo Login Accounts

| Role             | Email                | Password    |
|------------------|----------------------|-------------|
| Admin            | admin@itab.ug        | password123 |
| Property Manager | manager@itab.ug      | password123 |
| Landlord         | landlord@itab.ug     | password123 |
| Tenant           | tenant@itab.ug       | password123 |
| Agent            | agent@itab.ug        | password123 |

## 🌐 Live URLs

| Service  | URL |
|----------|-----|
| Frontend | https://itabproperties.com |
| Backend  | https://itab-tdrp.onrender.com |

---

## 📱 PWA Installation

- **Android/Chrome**: Tap the "Add to Home Screen" banner or use the browser menu → Install App
- **iOS/Safari**: Tap Share → Add to Home Screen
- **Desktop/Chrome**: Click the install icon in the address bar

---

## 🏗️ Project Structure

```
itab-frontend/          # React + TypeScript PWA
├── src/
│   ├── components/     # Reusable UI components
│   │   ├── layout/     # Sidebar, Header, AppLayout
│   │   └── ui/         # Button, Modal, Card, Badge, Input, Avatar
│   ├── pages/          # All page components
│   │   ├── auth/       # Login, Register
│   │   ├── DashboardPage.tsx
│   │   ├── PropertiesPage.tsx
│   │   ├── PropertyDetailPage.tsx
│   │   ├── SearchPage.tsx
│   │   ├── InspectionsPage.tsx
│   │   ├── PaymentsPage.tsx
│   │   ├── MaintenancePage.tsx
│   │   ├── PayoutsPage.tsx
│   │   ├── MessagesPage.tsx
│   │   ├── AnalyticsPage.tsx
│   │   ├── UsersPage.tsx
│   │   ├── NotificationsPage.tsx
│   │   └── SettingsPage.tsx
│   ├── store/          # Zustand state management
│   ├── lib/            # API client, IndexedDB, sync, utils, mock data
│   └── types/          # TypeScript type definitions
├── public/
│   ├── manifest.json   # PWA manifest
│   └── sw.js           # Service worker (offline + push notifications)

itab-backend/           # Node.js + Express + PostgreSQL
├── server.js           # Main server with all API routes
└── .env.example        # Environment variables template
```

---

## 🌐 Deploying to GitHub + Render

### Frontend (GitHub Pages or Render Static Site)

1. Push to GitHub:
```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/YOUR_USERNAME/itab-property.git
git push -u origin main
```

2. On Render.com → New Static Site:
   - Build command: `cd itab-frontend && npm install && npm run build`
   - Publish directory: `itab-frontend/dist`
   - Add env var: `VITE_API_URL=https://your-backend.onrender.com/api`

### Backend (Render Web Service)

1. On Render.com → New Web Service:
   - Root directory: `itab-backend`
   - Build command: `npm install`
   - Start command: `node server.js`
   - Add env vars from `.env.example`

2. Add a PostgreSQL database on Render → copy the connection string to `DATABASE_URL`

---

## 💳 Payment Integration

### MTN MoMo
1. Register at https://momodeveloper.mtn.com
2. Subscribe to Collections and Disbursements products
3. Get your Subscription Key, API User, and API Key
4. Add to `.env`: `MTN_SUBSCRIPTION_KEY`, `MTN_API_USER`, `MTN_API_KEY`

### Airtel Money
1. Register at https://developers.airtel.ug
2. Create an application and get Client ID + Secret
3. Add to `.env`: `AIRTEL_CLIENT_ID`, `AIRTEL_CLIENT_SECRET`

---

## 🗺️ Maps
Uses **OpenStreetMap** via **Leaflet** (free, no API key needed).
Google Maps can be added later by replacing the `<MapContainer>` with `@react-google-maps/api`.

---

## ✨ Features

- ✅ Role-based access (Admin, Property Manager, Landlord, Tenant, Agent)
- ✅ Guest browsing (no sign-up required)
- ✅ Property listings with photos, amenities, map
- ✅ Inspection booking with 100,000 UGX fee + rent credit
- ✅ MTN MoMo + Airtel Money + Card payments
- ✅ Maintenance request management
- ✅ Automated payout system
- ✅ Real-time messaging
- ✅ Push notifications
- ✅ Offline-first with IndexedDB + background sync
- ✅ Light/Dark/System theme
- ✅ Fully responsive (mobile + desktop)
- ✅ PWA installable on iOS, Android, Windows, macOS, Linux
- ✅ Analytics dashboard
- ✅ Document management
