# Learn to deploy your own projects

[Español](../DEPLOYMENT.md) · **English** · [Русский](../ru/DEPLOYMENT.md)

Optional learning material. **Deployment is not part of the technical assessment**:
work locally and submit your own repository as described in the [README](../../README.en.md).

Every resource used for practice must belong to **your project**: repository,
hosting account, database, secrets, domain and pipeline. This guide provides no
access or operating instructions for the evaluator's infrastructure.

## 1. CI versus deployment

**CI** installs dependencies and checks formatting, types, tests and build. A
GitHub-hosted runner is sufficient; you do not need your own server.
**Deployment** publishes a checked version to your hosting and verifies it works.
It needs your own destination and credentials. Passing CI alone does not publish
an application or verify its real database connection.

## 2. Start with CI in your repository

This project already includes **Verificaciones**. Check it runs in your copy on
pushes and PRs. For another Node project with equivalent scripts, a minimal
`.github/workflows/ci.yml` could be:

```yaml
name: CI
on: [push, pull_request]
permissions:
  contents: read
jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: npm
      - run: npm ci
      - run: npm run check
```

Adapt versions and commands to your project and keep the lockfile. Integration
tests requiring PostgreSQL need a separate temporary CI database. Never run
destructive tests on a published database.

## 3. Prepare a destination you control

Choose your own hosting platform or server. A Node.js hosting service may be
enough: **Docker is optional**. Configure your repository/branch, Node version,
working directory, build commands (`npm ci`, `npm run build` here) and start
command (`npm start` here). Provision your own persistent PostgreSQL database.

Set the application's variables, such as secret `DATABASE_URL`, your hosting's
`PORT`, and `HOST=0.0.0.0` when listening on a network. Store real values in secure
hosting/CI settings, never Git, images, screenshots or logs. Document variable
names and examples in `.env.example`, without real secrets.

## 4. Separate testing and production

| Resource    | Testing              | Production                 |
| ----------- | -------------------- | -------------------------- |
| Application | Your testing service | Your published service     |
| Database    | Fictitious data      | Operational data           |
| Secrets     | Test-only values     | Production-only values     |
| URL         | Your test address    | Your public address        |
| Publication | Validate changes     | Publish a reviewed version |

`develop`/`main` are possible conventions, not requirements. GitHub environments
can separate secrets and restrict branches; feature availability depends on plan
and repository visibility. Protect important branches with PRs and checks and
decide who can publish.

## 5. Design your publication sequence

For **your own** pipeline: run CI and stop on failure; build an artifact tagged
with the commit SHA; retain the previous version and back up your database when
needed; run migrations; start the checked version; verify health and a representative
operation; record the version, result and URL in your repository.

This base runs migrations with `npm run db:migrate`, which uses the development
dependency `tsx`. Use a release phase with those tools installed or prepare a
compiled migration runner. Do not assume it exists in a production-only installation.

Connection and publication commands depend on your hosting. Follow its official
documentation and use minimum-scope credentials. This guide does not include a
ready-to-run job targeting someone else's server. Write a workflow for your own
resources; operational files from the original repository are not your deployment template.

## 6. Verification and recovery

Check `/`, `/health` and `/health/db` on your URL. Review logs without leaking
personal data or secrets. Confirm persistence after restart and separation of
databases. Configure HTTPS and authentication before using real data.

If using a tunnel, create it in your own account and route only your service.
Connectivity does not provide user authentication or keep the origin computer online.

Stop publication if migration fails. Rolling back an application does not
automatically revert its database schema. Test backup restoration on a temporary
database and plan for writes made after a backup.

## 7. Document your project

Include requirements, nonsecret variables, build/start/migration commands,
CI/test procedures and environments, your URLs, publication rules, verification,
recovery, limitations and resource ownership.

The assessment requires only the README deliverables. Use this guide to extend
**your own projects** when you decide to publish them.

## Official references

- [Node.js CI](https://docs.github.com/en/actions/tutorials/build-and-test-code/nodejs).
- [GitHub Actions deployments](https://docs.github.com/en/actions/how-tos/deploy/configure-and-manage-deployments/control-deployments).
- [Environments, secrets and branches](https://docs.github.com/en/actions/how-tos/deploy/configure-and-manage-deployments/manage-environments).
