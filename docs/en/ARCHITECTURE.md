# Architecture conventions

[Español](../ARQUITECTURA.md) · **English** · [Русский](../ru/ARCHITECTURE.md)

Reservet starts as a modular monolith: one HTTP process and PostgreSQL. The worker
arrives in the queue exercise. Add services only for needs you can explain and verify.

## Responsibilities

| Part                               | Responsibility                              |
| ---------------------------------- | ------------------------------------------- |
| `src/server.ts`                    | Start HTTP and close resources on signals   |
| `src/app.ts`                       | Middleware, routes and HTTP errors          |
| `src/shared/config.ts`             | Load and validate configuration at startup  |
| `src/shared/database.ts`           | Pool and connection/query limits            |
| `src/modules/<module>/*.routes.ts` | Validate HTTP input and translate results   |
| `*.service.ts`                     | Business rules and transaction coordination |
| `*.repository.ts`                  | Parameterized SQL and row mapping           |
| `public/`                          | Presentation and HTTP consumption           |
| `migrations/`                      | Versioned schema evolution                  |

Dependencies go from routes to services and repositories. The three files are a
guide for the first exercise, not a reason to create empty layers. Services should
not depend on Express Request/Response.

## Data and errors

- Validate incoming JSON on the server: TypeScript does not validate external data.
- Use PostgreSQL constraints alongside application validation.
- Use SQL parameters; never concatenate user input.
- Map expected errors to 400, 404 or 409 rather than 500.
- For new business errors return `{ code, message, requestId }`, for example
  `TABLE_NAME_CONFLICT`. The interface can translate `code` independently of the
  language of `message`. Table endpoints remain the junior's task.
- Do not expose stack traces, queries, passwords or complete Error objects.
- Do not log request bodies, credentials or unnecessary personal data.

A transaction must use the same client from BEGIN through COMMIT/ROLLBACK and
release it in `finally`. Do not run its steps with `pool.query`: they could use
different connections. Test concurrency when implementing reservations.

Migrations run explicitly, with a transaction per file and a lock between runners.
They do not run on HTTP startup. This educational runner has no automatic rollback
or checksum: applied migrations are immutable by convention and code review.

## Interface and languages

`public/app.js` coordinates one screen; `public/i18n.js` holds translations and
language preferences. Split modules by feature when adding screens. HTTP contract
values such as `available` stay the same in every language.

External data is inserted with `textContent`; HTML templates contain constants
only. Demo mode is explicit and never hides API errors. Requests have a timeout;
repeated submissions are prevented while waiting. Fonts have local fallbacks and
do not require third-party requests.

## Scope and verification

The server defaults to localhost. In Docker it listens on container interfaces,
with its host port published only on localhost. See [environments and pipeline](DEPLOYMENT.md).
Example credentials are local. Helmet sets
headers and CSP; local HTTP does not enforce HTTPS/HSTS. On deployment, review
HTTPS, origins, secrets and permissions. See the
[official Express recommendations](https://expressjs.com/advanced/best-practice-security/).

Authentication and authorization are the junior's tasks; this is a local practice
environment. SQS, outbox, roles, rate limiting and full observability come with
their exercises. Current tests do not verify migrations against real PostgreSQL
and do not replace visual browser checks.
