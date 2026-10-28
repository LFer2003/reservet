# Working on Reservet

[Español](CONTRIBUTING.md) · **English** · [Русский](CONTRIBUTING.ru.md)

For the assessment, the [main README](README.en.md) defines tasks and submission
in your own repository. Docker and deployment are not required; do not send PRs
to the original repository. These conventions are supporting material.

Start with the [junior guide](docs/en/JUNIOR_GUIDE.md) and
[architecture conventions](docs/en/ARCHITECTURE.md).

## Workflow

1. Define the expected behavior and error cases.
2. Create a branch for each task, such as `feat/list-tables`.
3. Run `npm ci` and `npm run check` to verify your starting point.
4. Implement a small change you can explain.
5. Add tests for the behavior and relevant errors.
6. Review `git diff`, run `npm run check` and document how to verify the delivery.

## Conventions

- Code and filenames are in English; learning documentation is available in Spanish, English and Russian.
- Use UTF-8, LF and two spaces, as specified in `.editorconfig`. Avoid tools that
  convert multilingual text to another encoding.
- Use strict TypeScript in the backend. Avoid `any` and casts that hide unvalidated data.
- Prefer `const`, descriptive names and functions with one responsibility.
- Explain the reason behind non-obvious decisions, rather than commenting on every line.
- Add dependencies or layers only when you can explain the need they address.
- Never commit `.env`, credentials, real customer data or log contents.
- Add new migrations; never edit an applied migration.
- Check Spanish, English and Russian. Do not translate user-entered names.
- Keep all three documentation versions in sync when instructions change.

## Quality commands

```powershell
npm run format       # Apply consistent formatting
npm run lint         # Detect code problems
npm run typecheck    # Check backend and script types
npm test             # Configuration, HTTP and interface tests
npm run build        # Compile the backend
npm run check        # Run every check, including formatting
```

Tests use Node and JSDOM without connecting to real PostgreSQL, AWS or providers.
JSDOM does not check visual appearance: also review the browser, mobile layout and
keyboard navigation. When implementing repositories, add integration tests using
a separate test database, never working or production data.

GitHub Actions runs `npm run check` when the project is on GitHub. Describe each
delivery with the problem, result and verification evidence. Do not disable checks
just to make a delivery pass.

## Compatibility

TypeScript 5.9 and ESLint 9 retain compatibility with Node 22.13 and typescript-eslint.
Before major upgrades, check supported ranges and run every verification. Do not
hide dependency conflicts with `--force` or `--legacy-peer-deps`.
