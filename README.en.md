# Reservet · Junior technical assessment

[Español](README.md) · **English** · [Русский](README.ru.md)

Complete an application for restaurant staff: **login, table management and
PostgreSQL persistence**. Work locally, publish the solution on **your own GitHub**
and submit its URL with reproducible instructions.

This README defines the required scope. The evaluator communicates the deadline;
document incomplete tasks. Additional stages in the learning guides are outside
this assessment.

## 1. Starting point and scope

Included: TypeScript/Express, PostgreSQL connection and migrations, table schema,
a Spanish/English/Russian interface with demo/API modes and basic tests.

Implement authentication, protect table endpoints, list/create/change statuses,
connect the interface, add tests and document the solution. Login does not exist
yet: you must build it.

**Docker, AWS/SQS, Cloudflare, runners, domains and deployment are not required.**
Neither are reservations, payments, inventory or password recovery. The original
repository's infrastructure is the evaluator's responsibility, not the candidate's.

## 2. Your repository

Create an empty GitHub repository without generating another README. Preserve the
project history and change the push destination:

```powershell
git clone https://github.com/Eddierh/reservet.git reservet-assessment
cd reservet-assessment
git remote rename origin upstream
git remote add origin https://github.com/YOUR_USERNAME/reservet-technical-assessment.git
git push -u origin main
git switch -c feat/technical-test
```

Replace the username and repository name. Make small commits on your branch.
Do not push or submit PRs to the original repository. If your repository is private,
give the evaluator access before submission.

## 3. Local setup without Docker

Install Git, Node.js **22.13 or later compatible with the dependencies**, and
PostgreSQL **17** directly on your computer. Check `git --version`, `node --version`,
`npm --version` and `psql --version`. If psql is not on PATH, use SQL Shell or
pgAdmin's query tool.

Connect to your local PostgreSQL as an administrator and execute these statements
**separately**, with autocommit enabled; CREATE DATABASE cannot run in a transaction:

```sql
CREATE ROLE reservet_candidate LOGIN PASSWORD 'local_candidate_password';
CREATE DATABASE reservet_candidate OWNER reservet_candidate;
CREATE DATABASE reservet_candidate_test OWNER reservet_candidate;
```

Use different names if they already exist. The app user does not need superuser
permissions. The `_test` database is exclusively for testing. Do not connect to
the original project's dev/pro databases.

```powershell
npm ci
# Only if .env does not exist:
Copy-Item .env.example .env
```

Adjust `.env` to your installation:

```dotenv
PORT=3000
DATABASE_URL=postgresql://reservet_candidate:local_candidate_password@localhost:5432/reservet_candidate
```

The original example uses **5433** for Docker; a direct PostgreSQL installation
usually uses **5432**. Use your actual port and URL-encode special password
characters. Do not commit `.env` or real credentials.

```powershell
npm run db:migrate
npm run dev
```

Open **http://localhost:3000** and check in another terminal:

```powershell
Invoke-RestMethod http://localhost:3000/health
Invoke-RestMethod http://localhost:3000/health/db
```

Expect `status: ok` and `database: connected`. Select **My local API** to test
your backend. Initially `/api/tables` returns 404: you must implement it.
Demo mode only uses memory and does not demonstrate persistence. Do not use
`npm run db:up` or `npm run db:down`: these are Docker commands.

## 4. Required tasks

### A. Authentication

- Add user migrations and a repeatable seed command or procedure for a test user.
  Never commit real passwords.
- Implement login, logout and current-session lookup. Choose sessions or tokens
  and explain expiration and revocation behavior on logout.
- Hash passwords with scrypt, bcrypt or Argon2; never store plaintext or use a
  plain SHA-256 hash. Invalid login: 401 and a generic message.
- Protect **all table endpoints on the server**: unauthenticated requests return 401. Hiding interface buttons is insufficient.
- Build a login screen and logout action; preserve all three languages and the
  selector. Public signup, email and advanced roles are not required.
- Document new variables with examples in `.env.example`. Health routes may stay
  public without exposing secrets.

### B. Table API

| Method and route               | Input                                  | Result                                        |
| ------------------------------ | -------------------------------------- | --------------------------------------------- |
| `GET /api/tables`              | No body                                | 200 and array of tables                       |
| `POST /api/tables`             | `{ "name": "Table 1", "capacity": 4 }` | 201 and created table with status `available` |
| `PATCH /api/tables/:id/status` | `{ "status": "occupied" }`             | 200 and complete updated table                |

Each table includes positive integer `id`, `name`, integer `capacity` and `status`.
Validate nonblank names up to 80 characters, capacity **1–20**, positive IDs and
statuses `available`, `occupied`, `out_of_service`.

Invalid input: **400**; missing table: **404**; duplicate name: **409**;
unauthenticated: **401**. Use parameterized SQL and database constraints. Never
return SQL queries, passwords or stack traces to clients.

### C. Architecture and interface

- Separate routes, services and repositories: HTTP, business rules and SQL have
  different responsibilities.
- Add migrations without editing applied ones. Setup must work from an empty
  database with documented commands and no hidden manual changes.
- Connect the existing list, form, filters and status selectors. Show loading
  and errors, prevent duplicate submissions and render external text safely.
  Validate on the server even if the browser already validates.
- API-mode tables must survive reloads and server restarts. Demo mode must not
  hide backend failures.
- If using cookies, keep the same origin and document their security settings.
- Search must be case-insensitive and the selected language must survive reloads.

### D. Tests and quality

Test valid/invalid login, unauthenticated access, logout for your chosen mechanism,
table creation/listing/status changes, validation, duplicates and missing tables.
Verify persistence against the `_test` database, never by deleting working data.

Included tests use mocks/JSDOM and do not cover your business backend. Document
test database configuration, migrations, commands and what is simulated. If you
need `TEST_DATABASE_URL`, explain it and provision a temporary database for
integration tests in your CI. Do not disable existing checks.

```powershell
npm run format
npm run check
```

`check` runs lint, formatting, types, tests and build. **Verificaciones** must pass
in your GitHub repository. Deployment is restricted to the original repository
and skipped in candidate copies: you do not need a runner.

## 5. Suggested workflow and publication

1. Set up PostgreSQL and check `/health/db`.
2. Implement and test tables on your branch.
3. Add users, seed, login and module protection.
4. Connect the interface, verify all three languages and complete tests.
5. Run all checks and follow your setup instructions from scratch.
6. Push your branch, open a PR **in your own repository**, review it and merge
   into its default branch so the final solution is easy to find.

```powershell
git add <files-you-changed>
git commit -m "feat: describe your implemented change"
git push -u origin feat/technical-test
```

## 6. Evaluation

### AI use and delivery explanation

- **You may use AI to code, research, debug and write tests.** Identify the tools
  used and the parts where they helped.
- You are responsible for understanding, reviewing and verifying all submitted
  code, including generated code. Do not share secrets or personal data with tools.
- Provide a written explanation of login → authenticated request → service →
  PostgreSQL, your decisions and how you verified the result.
- Describe an AI suggestion you corrected or rejected and why. If none occurred,
  explain a decision you checked against documentation or tests.
- Full conversation histories are not required. An explanatory video is optional;
  **there will be no live coding exercises or live changes with the evaluator**.

### Review the starting code

The starter may contain functional defects. Reviewing it and correcting issues
you find is part of the assessment. Included checks do not guarantee every
behavior is correct: extend tests without disabling existing ones.

Do not stop at the happy path: check boundaries, failures and behavior after
reload. For each issue, document **symptom, reproduction, root cause, fix
and regression test**. Explain the evidence rather than merely stating AI fixed it.

### Criteria

| Criterion     | Evidence                                                              |
| ------------- | --------------------------------------------------------------------- |
| Functionality | Login and tables using real PostgreSQL                                |
| Design        | Clear responsibilities and explained decisions                        |
| Security      | Password hashing, server protection, validation and parameterized SQL |
| Tests         | Reproducible success, failure and persistence cases                   |
| Delivery      | Understandable commits, passing CI and complete instructions          |

Be ready to explain your code and any tools or assistance used. Reservations,
SQS, microservices and deployment are not requirements or substitutes for required tasks.

## 7. Submission

Submit through the same channel where you received the assessment:

- **Your repository URL**, accessible to the evaluator, final branch and commit SHA.
- Your repository's PR URL and a successful CI run URL.
- A README covering installation, PostgreSQL, variables, migrations, seed,
  startup and commands for every test suite.
- **Local demo-only credentials**, or instructions to generate them. Never
  share personal keys or secrets from other environments.
- Decisions, incomplete tasks and limitations. Screenshots/video are optional
  and do not replace code and instructions.
- An AI-use section and a log of discovered issues, explanations and added tests.

```text
Repository: https://github.com/YOUR_USERNAME/reservet-technical-assessment
Final branch and commit:
Pull request:
CI:
Run instructions: section in my README
Test user: documented seed procedure
Completed / pending:
```

Before submitting, clone your repository elsewhere and follow your own instructions.
Review must not depend on your `.env`, files outside the repository or access to our PC.

## References and administration

[Architecture](docs/en/ARCHITECTURE.md) · [Contributing](CONTRIBUTING.en.md) ·
[Learning guide](docs/en/JUNIOR_GUIDE.md).
Reservations/SQS stages are future training. Some historical guides use Docker:
follow this README's local setup for the assessment.
The [deployment guide for your projects](docs/en/DEPLOYMENT.md) is optional learning:
use your own resources; it is not part of the assessment delivery.
