# Reservet: learning and implementation guide

[Español](../GUIA_JUNIOR.md) · **English** · [Русский](../ru/JUNIOR_GUIDE.md)

**Technical assessment:** follow the [main README](../../README.en.md) for scope,
local setup without Docker and submission to your GitHub. This is an extended
learning path: Docker, reservations and SQS below are not assessment requirements.
Login is required by the assessment README.

Also read the [contribution guide](../../CONTRIBUTING.en.md) and
[architecture conventions](ARCHITECTURE.md). Run `npm run check` before each delivery.

## 1. What we are building

An application for restaurant staff to manage tables, reservations and customer
notifications. Start with an API, connect a screen, then move notifications into
a separate worker using SQS. The initial stages do not require an AWS account.

The first goal is to understand an entire request from HTTP to PostgreSQL. The
final goal is to explain concurrency, duplicate messages and external service
failures. Work in small deliveries: describe the desired behavior before coding,
then demonstrate success and failure cases. Move on when you can explain the
previous stage; there is no fixed schedule.

## 2. Tools and prerequisites

We use TypeScript for type checking, Express for HTTP, PostgreSQL for persistence
and Docker Compose for a reproducible development database.

Practice variables, functions, objects, arrays, promises, `async/await`, `try/catch`,
modules and TypeScript types. Learn GET, POST, PATCH, JSON and HTTP statuses 200,
201, 400, 404, 409 and 500. With Git, practice `status`, `diff`, branches and small
commits. Never commit `.env`.

## 3. Prepare your computer

1. Install compatible Node.js (at least 22.13), Git and an editor such as VS Code.
2. Install [Docker Desktop for Windows](https://docs.docker.com/desktop/setup/install/windows-install/).
   Follow its WSL 2/virtualization requirements; administrator access and a Windows
   restart may be required. Open Docker Desktop and select Linux containers.
3. Open PowerShell in the project folder and check:

```powershell
node --version
npm --version
git --version
docker --version
docker compose version
docker info
```

Docker Desktop includes Compose. If a newly installed command is missing, open a
new terminal. `docker info` must connect to the engine.

## 4. Install and start for the first time

Run these commands in order from the project root:

```powershell
cd E:\reservet
npm ci
# Copy only if .env does not exist yet:
Copy-Item .env.example .env
npm run db:up
npm run db:migrate
npm run dev
```

`npm ci` installs lockfile versions. `.env` configures the server and connection.
`db:up` downloads PostgreSQL 17 and waits until it is ready. `db:migrate` creates
the schema. `dev` keeps the server running and reloads it after edits. The local
database port is **5433** (the container uses 5432).

In another terminal:

```powershell
Invoke-RestMethod http://localhost:3000/health
Invoke-RestMethod http://localhost:3000/health/db
```

The first returns `status: ok`; the second should return `database: connected`.
These check the process and database connection, not the existence of every table.
Check migrations separately:

```powershell
docker compose exec db psql -U reservet -d reservet -c "SELECT * FROM schema_migrations;"
docker compose exec db psql -U reservet -d reservet -c "SELECT * FROM restaurant_tables;"
```

Expect `001_create_restaurant_tables.sql` and an empty table list. Run
`npm run db:migrate` again: it should report the migration is already applied.

For later sessions, use `npm run db:up` and `npm run dev`; run migrations when new
files appear. Stop the API with Ctrl+C and PostgreSQL with `npm run db:down`.
The volume preserves data. Do not use `docker compose down -v` unless you intend
to erase the entire local database.

If you already have PostgreSQL, create your own database/user, set `DATABASE_URL`
in `.env` and skip Docker commands. The migrations are the same.

## 5. Project structure

```text
src/
  server.ts                 Process startup and shutdown
  app.ts                    Express and health routes
  shared/config.ts          Startup configuration validation
  shared/database.ts        Connection pool
  modules/tables/           Implement the table module here
public/                     Interface and translations
scripts/migrate.ts          Pending SQL migration runner
migrations/                 Versioned schema changes
compose.yaml                Local PostgreSQL with persistent storage
```

We start with a modular monolith: one application organized by business capability.
Use this flow for tables:

```text
Request → route/controller → service → repository → PostgreSQL
```

Routes interpret HTTP and return status codes. Services express business rules.
Repositories execute SQL with parameters (`$1`, `$2`), never concatenated user data.
Avoid extra interfaces or layers without a clear need.

## 6. Migrations: changing the database

A migration is a versioned schema change. The first creates `restaurant_tables`
with an identifier, unique name, capacity from 1 to 20, status and creation time.
Constraints also protect data when another program writes invalid values.

To add a field later, create a new file such as
`migrations/002_add_table_location.sql` containing the appropriate `ALTER TABLE`.
Run `npm run db:migrate` and inspect the result with `psql`. Never edit an applied
migration: the runner records its name and does not run it again. Use ordered,
zero-padded filenames.

Each file runs in a transaction: on failure, that file is rolled back and not
recorded. Earlier migrations stay applied. A lock prevents simultaneous runners.
Do not include your own `BEGIN`/`COMMIT` or statements incompatible with transactions,
such as `CREATE INDEX CONCURRENTLY`. There is no automatic reverse migration;
correct the schema with a new migration. Production also needs backups and a
compatible deployment strategy.

## 7. First task: table API

**Learn:** routes, runtime validation, SQL, errors and separation of responsibilities.

1. Read `src/app.ts`, `database.ts` and the migration; explain how they connect.
2. Create `tables.repository.ts` to list and insert tables using parameterized SQL.
3. Create `tables.service.ts` to validate a nonblank name of up to 80 characters,
   an integer capacity from 1 to 20 and allowed statuses. TypeScript does not
   validate incoming JSON.
4. Create `tables.routes.ts`, export a Router and mount it in `app.ts` **before**
   the 404 handler.
5. Implement `GET /api/tables` and `POST /api/tables`.
6. Add `PATCH /api/tables/:id/status` to change a table's status.

Contract: GET returns an array with 200. POST receives
`{ "name": "Table 1", "capacity": 4 }` and returns the table with 201 and status
`available`. PATCH receives `{ "status": "occupied" }` and returns the updated
table with 200. Statuses: `available`, `occupied`, `out_of_service`.
Invalid data: 400; nonexistent table: 404; duplicate name: 409. Map PostgreSQL
error `23505` to a conflict and do not expose internal SQL messages. Validate IDs too.

Test after implementing the endpoints:

```powershell
Invoke-RestMethod http://localhost:3000/api/tables
$body = @{ name = 'Table 1'; capacity = 4 } | ConvertTo-Json
Invoke-RestMethod http://localhost:3000/api/tables -Method Post -ContentType 'application/json' -Body $body
```

**Acceptance:** listing, creation and status changes work; data survives restarts;
duplicates return 409; capacities 0 and 21 and blank names are rejected;
nonexistent tables return 404. Add contract and persistence tests and run `npm run check`.

## 8. Second delivery: connect the staff interface

**Learn:** HTML, CSS, forms, events, `fetch` and loading/error states.

The interface is already in `public/index.html`, `public/styles.css` and
`public/app.js`, served by Express at http://localhost:3000. It needs no additional
build. Run `npm run dev` to explore the demo even before PostgreSQL is ready.
The frontend uses browser JavaScript; the backend uses TypeScript. Select English
in the header to follow the labels below.

1. In **Demo**, create tables, change statuses, search and filter. Data lives in
   memory and resets on reload; this does not verify the backend.
2. Open browser developer tools, the Network tab, and choose **My local API**.
   Observe `GET /api/tables`; it initially returns 404 because it is your first task.
3. Implement GET from section 7 and click **Refresh**. Expect real data, or an
   empty dining room if you have not created tables yet.
4. Implement POST and try **New table**. It must return a table object with integer
   `id`, `name`, integer `capacity` and `status`.
5. Implement PATCH and try the status selectors. Return the entire updated table,
   not just a message or a 204 response.
6. Reload, select API mode again and verify persistence, including directly in PostgreSQL.
7. Read `request`, `load`, `render` and `changeStatus` in `public/app.js`. Explain
   browser validation versus mandatory server validation.

API mode shows connection failures, HTTP codes and incompatible responses. It
never hides them with sample tables. The interface does not access the database
directly. Login and server route protection remain the junior's tasks; this
practice screen has no authentication.

**Acceptance:** useful error messages, no repeated submissions while waiting,
keyboard support and refreshed data after saving. Tables persist after reload in API mode.

## 9. Third delivery: reservations and concurrency

**Learn:** relational modeling, foreign keys, dates, transactions and indexes.

Define rules first: a reservation has a table, customer name, party size, start,
end and confirmed/cancelled status. Store instants as `timestamptz` and display
times in `America/Cancun`. End must be after start, capacity must not be exceeded,
and active reservations must not overlap. Intervals overlap if `startA < endB`
and `endA > startB`; touching boundaries are allowed.

Add a migration and endpoints to create, list and cancel. Simulate two simultaneous
requests for one table. A query followed by an unprotected INSERT lets both see availability.

An initial solution is a transaction that locks the table row using
`SELECT ... FOR UPDATE`, checks availability and inserts. Every operation affecting
availability must follow the same discipline. Read
[PostgreSQL locking documentation](https://www.postgresql.org/docs/17/explicit-locking.html).
Later compare this with a database exclusion constraint.

**Acceptance:** cancellation frees the interval; two concurrent overlapping
reservations cannot both be confirmed. Include a concurrent integration test.
`occupied` describes current operations, not the future reservation calendar.

## 10. Fourth delivery: SQS notifications

**Learn:** producers, consumers, queues, messages and separate processes.

Start with a simulated notification written to the console. Add delays and
failures to see what happens when sending inside the HTTP request. Then create
an independent worker and development queue using a local emulator or an AWS
account agreed with the mentor. Never put credentials in code.

The API confirms the reservation and prepares an event with `eventId`, `type`,
`version`, `occurredAt` and `reservationId`. The worker consumes it, performs the
action and deletes the message only after success. Set the visibility timeout
to allow sufficient processing time. Verify behavior in the
[official SQS documentation](https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/welcome.html).

**Acceptance:** reservations can be created while the worker is stopped; it
processes pending work after restarting. The API does not wait for sending.
Initially simulate notifications without contacting real customers.

## 11. Fifth delivery: failures, duplicates and outbox

**Learn:** at-least-once delivery, idempotency, retries, DLQ and eventual consistency.

1. Process an event twice: use `eventId` and persistent records to control duplicates.
   Discuss a crash between sending and recording: stronger guarantees require an
   external provider that supports idempotency keys.
2. Simulate temporary failures and verify retries.
3. Configure a dead-letter queue with an attempt limit. Trigger a permanent
   failure, inspect the message and recover it after fixing the problem.
4. Simulate a crash between saving the reservation and publishing to SQS. Add an
   outbox table: save reservation and event in one transaction; a publisher sends
   events and marks them sent. A crash after publishing can cause duplicates,
   so idempotency is still required.

**Acceptance:** the intent to notify a confirmed reservation is not lost;
duplicates are handled; failed messages can be traced and recovered.

## 12. Later stages

Waiting list: react to cancellations without inconsistently notifying multiple
people. Roles: staff and administrator, with server-side authorization. Audit:
who changed reservations. Observability: request/event IDs, error metrics and
queue age. CI: types, build and tests on every change. Deployment: environment
configuration, secrets, controlled migrations and backups.

Extract a service only when you can explain benefits and costs in operations,
networking and consistency. The notification worker is the first candidate.

## 13. Working with your mentor

For each task provide a problem statement, design decision, small change,
demonstration and verification evidence. The mentor reviews business rules, SQL,
error handling and clarity. The junior must be able to explain the code.

Useful questions: what if two requests arrive together? What if PostgreSQL stops
responding? What if a message arrives twice? Which data should never enter a log?

## 14. Troubleshooting

| Symptom                         | Action                                                                                                 |
| ------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `docker` not found              | Install Docker Desktop and open a new terminal.                                                        |
| Docker cannot connect           | Open Desktop and check `docker info`.                                                                  |
| Port 5433 occupied              | Publish `5434:5432` instead and change DATABASE_URL to port 5434.                                      |
| Missing DATABASE_URL            | Copy `.env.example` to `.env` in the root.                                                             |
| Connection refused              | Run `db:up`, inspect `docker compose ps` and `docker compose logs db`.                                 |
| Changed credentials do not work | Compose variables initialize only new volumes; retain original credentials or change the user via SQL. |
| Table missing                   | Run `db:migrate` with the server's DATABASE_URL.                                                       |
| Port 3000 occupied              | Change PORT in `.env` and restart.                                                                     |
| `/api/tables` returns 404       | This is the first exercise and is not implemented yet.                                                 |

## 15. Starting point status

Prepared: dependencies, development configuration, health server, Compose,
migration runner, table schema and demo/API interface. Quality tools and automated
tests are included. Junior tasks: table API, verified integration, login,
reservations, business tests and all SQS stages.

Configure your own database and set DATABASE_URL for your installation. Verify
migrations against that local database. For the assessment, follow the README's
scope and setup without Docker; reservations and SQS are optional later training.
