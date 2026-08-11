# DietTrack

DietTrack is a full-stack web app for a fitness trainer to manage clients' diet
plans. The trainer (admin) manages client accounts, tracks their weight over
time, and builds month-long diet plans broken into individual days. Clients
log in to their own dashboard to see today's plan, browse the full month,
update their profile, and log new weight entries. Each day's plan is
delivered automatically at a per-client scheduled time via email and/or
WhatsApp, in addition to always being visible in-app.

## What it does

- **Trainer (ADMIN) dashboard** (`/admin`)
  - Client list: name, email, mobile, height, age, latest weight, last updated.
  - Add clients, reset any client's password directly.
  - Client detail page: profile, weight history (chart + table), per-client
    notification settings (delivery time + email/WhatsApp toggles), and a
    diet plan editor (pick a month, generate the days, edit
    breakfast/lunch/dinner/snacks/notes per day, save).
- **Client (USER) dashboard** (`/dashboard`)
  - Today's diet plan card.
  - Editable profile (name, email, mobile, height, age).
  - Weight log entry form + history (chart + table).
  - Month view of the full diet plan.
- **Auth**
  - Email + password login (JWT).
  - Trainer can reset a client's password directly, no OTP needed.
  - Clients can self-service reset via an **email-based OTP** (a 6-digit code
    emailed to them, valid for 10 minutes) — no SMS provider required.
- **Scheduled delivery**
  - A `node-cron` job runs every minute in the backend process. For every
    user whose `notifyTime` (`HH:mm`, server local time) matches the current
    minute and who has a diet plan day for today, the day's plan is sent via
    whichever channels they've enabled (email via SMTP / WhatsApp via
    Twilio), and a `SendLog` audit row is written per channel attempted.
  - Sending is best-effort and never crashes the server: if SMTP or Twilio
    credentials are missing, the app logs `[Email not configured, skipping]`
    or `[WhatsApp not configured, skipping]` instead of throwing.

## Folder layout

```
diet-track/
├── README.md
├── backend/
│   ├── package.json
│   ├── .env.example
│   ├── prisma/
│   │   ├── schema.prisma      # User, WeightLog, DietPlan, DietPlanDay,
│   │   │                      # PasswordResetOtp, SendLog
│   │   └── seed.js            # seeds the admin + demo client
│   └── src/
│       ├── index.js           # entrypoint, starts server + scheduler
│       ├── app.js              # express app + routes
│       ├── config/prisma.js    # shared Prisma client
│       ├── middleware/auth.js  # JWT auth + admin-only guard
│       ├── routes/
│       │   ├── auth.js         # /api/auth/*
│       │   ├── users.js        # /api/users/* (self-service)
│       │   └── admin.js        # /api/admin/* (trainer only)
│       ├── scheduler/cron.js   # every-minute diet plan delivery job
│       └── utils/
│           ├── mailer.js       # nodemailer, guarded
│           ├── whatsapp.js     # twilio WhatsApp, guarded
│           ├── otp.js          # OTP generation/hashing
│           └── dates.js        # date helpers (UTC-midnight days, HH:mm)
└── frontend/
    ├── package.json
    ├── vite.config.js
    ├── tailwind.config.js
    ├── index.html
    └── src/
        ├── main.jsx, App.jsx
        ├── api/client.js       # axios instance + interceptors
        ├── context/AuthContext.jsx
        ├── components/         # Nav, ProtectedRoute, WeightChart (inline SVG)
        └── pages/
            ├── Login.jsx, ForgotPassword.jsx, ResetPassword.jsx
            ├── AdminDashboard.jsx, AdminClientDetail.jsx
            └── ClientDashboard.jsx
```

## Prerequisites

- Node.js 18+ and npm
- No external database needed for local dev — SQLite is used out of the box.

## Setup

From the `diet-track` folder:

```bash
# 1. Backend
cd backend
npm install
cp .env.example .env        # then edit .env if you want real SMTP/Twilio creds
npx prisma migrate dev --name init
node prisma/seed.js
npm run dev                 # starts the API on http://localhost:4000

# 2. Frontend (in a second terminal)
cd frontend
npm install
cp .env.example .env        # defaults to http://localhost:4000/api, edit if needed
npm run dev                 # starts the app on http://localhost:5173
```

Open http://localhost:5173 and log in with one of the seeded accounts below.

## Seeded login credentials

| Role    | Email                      | Password       |
|---------|-----------------------------|----------------|
| Trainer (ADMIN) | carefood4u@gmail.com       | Trainer123!    |
| Client (USER)   | demo.client@example.com    | Client123!     |

The demo client is seeded with a height/age, ~6 weeks of sample weight log
entries, and a diet plan for the current month with the first few days
pre-filled with sample meals, so the app is testable immediately after
seeding.

## Environment variables (`backend/.env`)

See `backend/.env.example` for the full template.

| Var | Purpose |
|---|---|
| `DATABASE_URL` | Prisma connection string. Defaults to `file:./dev.db` (SQLite). |
| `JWT_SECRET` | Secret used to sign auth tokens. Change this for any real deployment. |
| `PORT` | Port the API listens on (default `4000`). |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` | SMTP credentials for sending OTP emails and daily plan emails. |
| `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_WHATSAPP_FROM` | Twilio credentials for WhatsApp delivery, following Twilio's WhatsApp Business API pattern. |

**Note:** WhatsApp and email sending require you to supply your own SMTP and
Twilio credentials — the app will run and the rest of the product (login,
profile, weight tracking, diet plan editing, in-app "today's plan" viewing)
works completely fine without them. If they're left blank, the backend logs
`[Email not configured, skipping]` / `[WhatsApp not configured, skipping]`
instead of crashing. For WhatsApp setup reference, see
https://www.twilio.com/docs/whatsapp (not required to run the app locally).

## Switching from SQLite to Postgres later

1. In `backend/prisma/schema.prisma`, change the datasource provider from
   `sqlite` to `postgresql`.
2. Set `DATABASE_URL` in `backend/.env` to a Postgres connection string, e.g.
   `postgresql://user:password@host:5432/diettrack`.
3. Run `npx prisma migrate dev` again to (re)create the schema against
   Postgres.

No application code changes are required — all queries go through Prisma.

## Deployment guidance

- **Render / Railway**: deploy `backend` as a Node web service (build:
  `npm install && npx prisma generate`, start: `npm start`) and `frontend`
  as a static site (build: `npm run build`, publish dir: `dist`). Add a
  managed Postgres addon and point `DATABASE_URL` at it (see above), and set
  the SMTP/Twilio env vars in the service's dashboard. Set `VITE_API_URL` on
  the frontend build to your deployed backend's URL.
- **VPS**: install Node 18+, clone the repo, run the same install/migrate
  steps, and run the backend under a process manager (e.g. `pm2` or a
  systemd unit) so the cron scheduler keeps running continuously. Serve the
  built frontend (`npm run build` output in `frontend/dist`) via nginx or
  any static file host, reverse-proxying `/api` to the backend process.
- In all cases, keep `JWT_SECRET` secret and unique per environment, and use
  a real Postgres database rather than SQLite once you have concurrent
  writers.
