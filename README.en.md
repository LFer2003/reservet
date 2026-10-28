# Reservet · Table management

[Español](README.md) · **English** · [Русский](README.ru.md)

Restaurant staff application with authentication, table management and PostgreSQL
persistence. Implementation of the Reservet junior technical assessment.

[Repository](https://github.com/LFer2003/reservet) ·
[GitHub checks](https://github.com/LFer2003/reservet/actions/workflows/ci.yml) ·
[Detailed implementation notes, Spanish](docs/ENTREGA.md) · [Original assessment, Spanish](docs/ENUNCIADO.md)

## Features

- Login, current session and logout with server-side revocation; scrypt passwords.
- Persistent PostgreSQL sessions with an eight-hour expiry.
- Create and list tables; available, occupied and out-of-service statuses.
- Case-insensitive search, summary buttons that filter tables and clear filters.
- Compact cards showing table name, capacity, status and a status selector.
- Available table/seat totals, responsive layout and Spanish/English/Russian UI.
- Persistent API mode and an explicitly temporary in-memory demonstration mode.

## Local setup

Requires Git, Node.js 22.13 or a compatible newer version, npm and PostgreSQL 17.
Docker and deployment are not required.

```powershell
git clone https://github.com/LFer2003/reservet.git
cd reservet
npm ci
# Only if .env does not exist:
Copy-Item .env.example .env
```

As a PostgreSQL administrator, execute each statement separately with autocommit:

```sql
CREATE ROLE reservet_candidate LOGIN PASSWORD 'local_candidate_password';
CREATE DATABASE reservet_candidate OWNER reservet_candidate;
CREATE DATABASE reservet_candidate_test OWNER reservet_candidate;
```

These are local example credentials. Use different names if they already exist;
the application user does not need superuser privileges. Adjust `.env`:

```dotenv
PORT=3000
HOST=127.0.0.1
APP_ENV=dev
DATABASE_URL=postgresql://reservet_candidate:local_candidate_password@localhost:5432/reservet_candidate
TEST_DATABASE_URL=postgresql://reservet_candidate:local_candidate_password@localhost:5432/reservet_candidate_test
```

Use your actual port and credentials, URL-encode special password characters and
keep `.env` out of Git. The test database must differ from the application database
and its name must end in `_test`.

```powershell
npm run db:migrate
$env:SEED_USERNAME = 'demo'
$env:SEED_PASSWORD = Read-Host 'Choose a local password of at least 12 characters'
npm run db:seed-user
Remove-Item Env:SEED_PASSWORD
npm run dev
```

The repeatable seed creates the user or updates its password. There is no public
registration or universal password in the repository.

Open [http://localhost:3000](http://localhost:3000), sign in and choose **My local API**
to verify persistence. Demonstration changes disappear on reload.
`/health` should report `status: ok`, and `/health/db` should report `database: connected`.
For a compiled run, use `npm run build` followed by `npm start`.

## Verification

```powershell
npm run check
npm run test:integration
```

`check` runs lint, formatting, TypeScript, configuration/HTTP/UI tests and the build.
`npm test` uses JSDOM and mocked fetch/health queries, without a real database.
Integration tests require `TEST_DATABASE_URL`; they create an isolated random schema,
apply migrations and remove only that schema. They cover login, protected endpoints,
table operations, validation, conflicts, missing tables, logout, expiry and persistence
after an HTTP server restart, a full Node process restart and through another database connection. Migrations and the user seed are also run twice to verify repeatability. The database
user needs permission to create schemas; no separate test migration command is needed.
GitHub Actions provisions PostgreSQL 17 and runs both suites plus existing checks.

## Design and security

HTTP routes, business services and SQL repositories are separated in
`src/modules/auth/` and `src/modules/tables/`. The UI lives in `public/`.
Random session tokens are stored as hashes in PostgreSQL and sent in an `HttpOnly`,
`SameSite=Lax` cookie lasting eight hours. `Secure` is enabled with `APP_ENV=pro`;
local development uses same-origin HTTP. Logout deletes the server session and cookie.
All table routes require authentication. Inputs are validated server-side; SQL is
parameterized, database constraints apply and external text uses `textContent`.

Compact cards prioritize operating the dining room over decorative table drawings.
Codex assisted with review, debugging, design, tests and documentation. A corrected
AI-assisted decision was hiding the UI after a failed logout: the UI now reports
the error and allows retrying, with regression coverage. See the detailed Spanish
notes for problem reproductions, causes, corrections and tests.

## Scope

The application covers authentication and table management. Reservations, payments,
inventory, advanced roles, password recovery and deployment are outside the assessment.
Expired sessions are rejected; their rows are not removed by a scheduled cleanup job.
See the [delivery verification report, Spanish](docs/VERIFICACION.md) for the
requirements review and recorded validation evidence.
