# GitOp

منصة لإدارة المستودعات والحسابات، بواجهة عربية/إنجليزية وخلفية حقيقية: لا يوجد مستخدم وهمي ولا تسجيل دخول تجريبي.

A repository and account management platform with a bilingual (Arabic/English) console and a real backend — no mock users, no fake login.

## Architecture

| Layer | Technology | Port | Responsibility |
| --- | --- | --- | --- |
| Console | React 19 + TypeScript + Vite + Tailwind | 5173 | UI, routing, route guards, i18n (ar/en, RTL/LTR) |
| Gateway | Go | 8081 | CORS, per-IP rate limiting on auth routes, request auditing, reverse proxy |
| Core API | Rust + Axum + SQLx | 8080 | Auth, sessions, repositories, activity, stats |
| Storage | PostgreSQL | 5432 | Users, sessions, repositories, activity and gateway audit tables |
| Tooling | Node.js scripts | — | `scripts/seed.js`, `scripts/smoke-test.js` |

Requests flow `browser → Vite proxy → Go gateway → Rust API → PostgreSQL`.

## Authentication model

- Passwords are hashed with **Argon2**; plaintext is never stored or logged.
- A session is a random 32-byte token; only its **SHA-256 hash** is stored, with a 7-day expiry.
- Every login attempt (success or failure) is recorded; more than 8 failures from one IP in 15 minutes is rejected with `429`.
- Sessions are listable and revocable from Settings → Sessions; changing the password revokes every other session.
- The frontend has **no offline fallback**: if the API is unreachable the user sees an error, never a signed-in state.

## Running locally

### With Docker

```bash
docker compose up --build
npm install && npm run dev      # console on http://localhost:5173
```

### Without Docker

```bash
# 1. PostgreSQL
createdb gitop   # or: psql -c "CREATE DATABASE gitop"

# 2. Rust API (migrations run automatically on boot)
cd backend
DATABASE_URL=postgres://gitop:gitop@localhost:5432/gitop cargo run

# 3. Go gateway
cd gateway
DATABASE_URL='postgres://gitop:gitop@localhost:5432/gitop?sslmode=disable' go run .

# 4. Console
npm install
npm run dev
```

Copy `.env.example` for the full list of environment variables.

## npm scripts

| Script | Purpose |
| --- | --- |
| `npm run dev` | Vite dev server, proxying `/api` and `/gw` to the gateway |
| `npm run build` | Production build |
| `npm run lint` | TypeScript type check (`tsc --noEmit`) |
| `npm run api` | Run the Rust API |
| `npm run gateway` | Run the Go gateway |
| `npm run seed` | Create a demo account and sample repositories over HTTP |
| `npm run smoke` | End-to-end checks against gateway + API + database |

## HTTP API

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/api/health` | API and database health |
| `POST` | `/api/auth/register` | Create an account, returns a session token |
| `POST` | `/api/auth/login` | Sign in |
| `POST` | `/api/auth/logout` | Revoke the current session |
| `GET` | `/api/auth/me` | Current user |
| `PATCH` | `/api/users/me` | Update profile |
| `POST` | `/api/users/me/password` | Change password, revoke other sessions |
| `GET` / `DELETE` | `/api/sessions`, `/api/sessions/:id` | List / revoke sessions |
| `GET` / `POST` | `/api/repos` | List / create repositories |
| `GET` / `PATCH` / `DELETE` | `/api/repos/:owner/:name` | Read / update / delete a repository |
| `GET` | `/api/activity` | Activity log |
| `GET` | `/api/stats` | Account statistics |
| `GET` | `/gw/health` | Gateway, upstream and database health |
| `GET` | `/gw/traffic` | Gateway traffic summary (last hour, errors, average latency) |

## Console structure

```
src/
  components/layout/   app shell (sidebar + topbar) and auth layout
  components/ui/       Button, Tabs, Card, Field, Badge, Feedback primitives
  context/             AuthContext (real sessions), LanguageContext (ar/en)
  lib/                 api client, i18n dictionary, error mapping
  pages/               Login, Register, Overview, Repositories, Repository, Activity, Settings
```
