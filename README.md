# 💧⛽ POS Air & Gas

> **Point of Sale web app** for a Micro/Small/Medium Enterprise (MSMe) selling bottled water and cylinder gas.

---

## 📖 Overview

POS Air & Gas is a **mobile-first PWA** built to manage the daily operations of a small water & gas shop. It supports three user roles — Owner, Kurir (courier), and Kasir (clerk) — each with a tailored experience for their responsibilities.

---

## ✨ Features

| Module | Description |
|---|---|
| 🔐 **Authentication** | JWT-based login with role-aware routing (owner / kurir / kasir) |
| 📊 **Dashboard** | Daily revenue summary, weekly bar chart, stock snapshot, and debt overview with date filter |
| 📦 **Stock Management** | Receive stock, transfer between locations, vendor exchange runs, defect write-off |
| 🗺️ **Locations** | Manage warehouse and vehicle/truck locations with stock per location |
| 🛒 **Transactions** | Delivery (kurir), counter sale (kasir), and vendor-direct pass-through transactions |
| 👥 **Customers** | Customer list with per-customer custom pricing |
| 💸 **Debt & Payments** | Partial payment support, customer debt tracking, and standalone debt settlement |
| 🧴 **Container Loans** | Track owner-owned containers borrowed by customers |
| 🧑‍💼 **Users** | Owner-only user management (create, activate/deactivate) |
| ⚙️ **Settings / Profile** | All roles can update their own name and password; settings hub for owner |

---

## 🗂️ Product Categories

- **Simple** — no container; standard in/out stock (e.g. karton air cup)
- **Refillable** — filled/empty container state tracked per location (e.g. galon air, tabung gas)

---

## 👤 User Roles

| Role | Access |
|---|---|
| **Owner** | Full access to all modules |
| **Kurir** | Truck loading/return, vendor exchange, delivery transactions |
| **Kasir** | Counter sales, payment collection |

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Framework | React 19 + TypeScript |
| Build Tool | Vite |
| Styling | SCSS (CSS Modules per component) |
| Routing | React Router v7 |
| HTTP Client | Axios |
| PWA | Vite PWA plugin + Web App Manifest |

---

## 🚀 Getting Started

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

---

## 📁 Project Structure

```
src/
├── components/     # Reusable UI components (Button, Modal, Badge, …)
├── pages/          # Page-level components per route
├── services/       # API service modules per domain
├── hooks/          # Custom React hooks (useAuth, useApi, usePolling)
├── context/        # React context (AuthContext)
├── types/          # Shared TypeScript types
├── styles/         # Global SCSS variables, mixins, reset
└── utils/          # Helper utilities (formatCurrency, constants)
```
