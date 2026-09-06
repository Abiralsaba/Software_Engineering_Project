<div align="center">

# 🇧🇩 NationX

### Bangladesh, Connected.

**A unified digital portal for citizen services, government administration, and public information.**

![React](https://img.shields.io/badge/React-19-149ECA?style=for-the-badge&logo=react&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-8-646CFF?style=for-the-badge&logo=vite&logoColor=white)
![Express](https://img.shields.io/badge/Express-5-111827?style=for-the-badge&logo=express&logoColor=white)
![MySQL](https://img.shields.io/badge/MySQL-Database-4479A1?style=for-the-badge&logo=mysql&logoColor=white)
![Status](https://img.shields.io/badge/Scope-Academic_Demo-006A4E?style=for-the-badge)

[Features](#features) · [Architecture](#architecture) · [Quick start](#quick-start) · [Testing](#testing) · [Limitations](#demonstration-scope-and-limitations)

</div>

---

## About NationX

NationX is a full-stack academic software-engineering and DBMS project inspired by Bangladesh's digital public-service ecosystem. It combines citizen identity, health, education, land, agriculture, water, tax, community, shopping, admissions, and administrative workflows in one application.

The active frontend is being migrated to **React + Vite** while preserving all original `.html` URLs. The backend remains **Node.js + Express**, and application data is stored in a substantial **MySQL/MariaDB** schema containing domain tables, views, triggers, and stored procedures. The original frontend under `public/` remains available as a rollback reference.

> **Academic demonstration:** NationX is not an official Bangladesh government service. It must not be deployed publicly or used with real citizen information.

## Features

### Citizen portal

- Citizen registration, login, password recovery, profile, and document vault
- Unified dashboard, notifications, service history, and to-do management
- NID applications, corrections, reissue, appointments, and tracking
- Passport application, document submission, fees, offices, and tracking
- Health cards, vaccination records, appointments, ambulance requests, and medicine identification
- Water connections, billing, complaints, and quality reports
- TIN, returns, VAT, challans, tax notices, and payments
- Land records, mutation applications, ownership transfer, and land-tax demonstration
- Agricultural crop reports, subsidies, marketplace, training, and expert questions
- Education results, stipends, university admissions, and applications
- Community groups, posts, comments, reactions, notices, contact, market, and store

### Administration

- Separate JWT-based administrator authentication
- Domain dashboards for NID, passport, health, and water
- Scoped approval and rejection workflows
- Cross-domain reports, status filtering, pagination, notifications, and audit records
- Trigger-authoritative land ownership transfer with transactional approval behavior

### Database coursework

- Large normalized multi-domain relational schema
- Versioned installation and compatibility migrations
- Synthetic demonstration identities and clearly marked demo geography
- Views, analytical queries, triggers, audit logging, and stored-routine definitions
- Isolated `central_govt_db_test` regression baseline

## Architecture

```text
React 19 + React Router + Vite
              │
              │ same-origin JSON / multipart requests
              ▼
Node.js + Express 5 REST API
              │
      JWT citizen/admin guards
      validation · uploads · transactions
              │
              ▼
MySQL/MariaDB
tables · views · triggers · procedures · audit
```

The React application never accesses the database directly. It calls relative `/api/*` endpoints, while Express owns authentication, authorization, input validation, record ownership, transactions, uploads, and SQL execution.

## Technology

| Layer | Technology |
|---|---|
| Frontend | React 19, React Router, Vite, SweetAlert2, Font Awesome, Three.js |
| Backend | Node.js, Express 5, CommonJS REST routes |
| Database | MySQL/MariaDB through `mysql2/promise` |
| Authentication | JWT and bcrypt/bcryptjs |
| Uploads | Multer with local demo storage |
| Payments | SSLCommerz sandbox plus clearly labeled local simulation |
| External data | Open-Meteo, NASA POWER, optional medicine-identification provider |
| Testing | Node test runner, Vitest, Testing Library, Playwright, Python unittest |

## Project structure

```text
Software_Engineering_Project/
├── client/                       # React + Vite application
│   ├── src/
│   │   ├── components/           # Shared dialogs, loaders, demo payment panel
│   │   ├── context/              # Authentication state
│   │   ├── features/             # Citizen, service, admission, and admin pages
│   │   ├── layouts/              # Citizen and authentication shells
│   │   ├── services/             # Shared API client
│   │   └── styles/               # React design system
│   └── vite.config.js
├── public/                       # Original HTML/CSS/JS and rollback frontend
├── src/
│   ├── app.js                    # Express entry point and frontend cutover
│   ├── config/                   # Database pool
│   ├── controllers/              # Authentication, dashboard, and user logic
│   ├── middleware/               # Citizen/admin JWT and upload middleware
│   ├── routes/                   # Domain REST APIs
│   ├── services/                 # Medicine-identification services
│   └── database/                 # Schemas, migrations, seeds, triggers, views
├── scripts/                      # Database and medicine-data utilities
├── dataset/                      # Medicine reference datasets
├── test/                         # API, database, browser, and pipeline tests
├── start.sh                      # Local React/Express launcher
└── package.json
```

## Requirements

- macOS or Linux shell environment
- Node.js 20 or newer and npm
- MySQL or MariaDB running locally
- A local `.env` created from `.env.example`
- The initialized `central_govt_db` database

Do not commit `.env`, passwords, tokens, API keys, uploaded identity files, or real citizen data.

## Quick start

### 1. Install dependencies

```bash
npm install
npm run client:install
```

### 2. Configure the local environment

```bash
cp .env.example .env
```

Edit `.env` locally with your MySQL connection and a strong local JWT secret. Never place database credentials in the React client or any `VITE_*` variable.

### 3. Initialize the database

Initialize the isolated test database first:

```bash
npm run db:install:test
npm run test:baseline
```

After that baseline succeeds, initialize the local development database:

```bash
npm run db:install:dev
```

The installer is restricted to `central_govt_db` and `central_govt_db_test`. Automated resets are permitted only for the test database:

```bash
npm run db:reset:test
```

### 4. Start NationX

```bash
chmod +x start.sh
./start.sh
```

The launcher installs missing dependencies, builds React, starts Express in React mode, and opens:

**http://localhost:3000/index.html**

Use `./start.sh --no-browser` to suppress automatic browser opening. Press **Ctrl+C** to stop the server. The script does not start or modify MySQL; the database service must already be available.

### Manual development commands

```bash
npm start                  # Express with default frontend behavior
npm run start:react        # Express serving the React production build
npm run client:dev         # Vite development server
npm run client:build       # Production React build
```

## Preserved URL contracts

React Router keeps the original addresses such as:

```text
/dashboard.html
/nid.html
/passport.html
/health.html
/water.html
/tax.html
/land.html
/agriculture.html
/education.html
/admission.html
/apply.html
/reports.html
```

This preserves browser refreshes, existing bookmarks, department links, query parameters, and payment return paths. Citizen routes redirect unauthenticated visitors to `/index.html`; admin routes redirect to `/index.html#admin`.

## Testing

```bash
npm test                  # backend/API regression suite
npm run test:baseline     # isolated database baseline
npm run client:test       # React component and contract tests
npm run client:build      # production build verification
npm run test:browser      # Playwright browser journeys
npm run medicine:test     # medicine pipeline tests
```

Tests that write data must use `central_govt_db_test`. A successful build, component test, or HTTP 200 response alone does not prove complete workflow compatibility; important journeys require real browser verification against the backend and synthetic database records.

## Payment behavior

NationX retains its local SSLCommerz sandbox integration for course demonstration. When the sandbox cannot support a presentation, the React interface can display an isolated payment simulation.

The simulation is explicitly labeled and does **not**:

- contact a real gateway;
- create a verified receipt;
- change a database payment status;
- represent a gateway-confirmed payment.

Use Cash on Delivery for a real database-backed shop demonstration. Production-grade callback verification is deferred.

## Demonstration scope and limitations

NationX is intended for a controlled local presentation using synthetic accounts and demo data. It is **not production-ready**. Before any public deployment, the project still requires work on:

- payment callback verification;
- upload validation, private storage, and access control;
- CORS restrictions and deployment-aware rate limiting;
- identity-data privacy and authorization review;
- remaining identity foreign-key normalization;
- stored-routine compatibility;
- secrets management, monitoring, backups, and dependency review.

Legacy files and uploads are retained for rollback and must not be deleted without an explicit cleanup review.

---

<div align="center">

### Rooted in Bangladesh. Connected by possibility.

**Team: `SELECT * FROM WINNERS`**

<sub>NationX · Academic software-engineering and DBMS project</sub>

</div>
