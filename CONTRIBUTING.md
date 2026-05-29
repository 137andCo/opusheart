# Contributing to OpusHeart

Thanks for your interest in contributing! Here's how to get started.

## Development Setup

1. Fork the repo and clone your fork
2. Install dependencies: `pnpm install`
3. Start infrastructure: `docker compose up -d`
4. Copy `.env.example` to `.env` and configure
5. Run the dev server: `pnpm dev:server`

## Workflow

1. Create a feature branch from `main`: `git checkout -b feat/my-feature`
2. Make your changes with tests
3. Run the test suite: `pnpm test`
4. Run type checks: `pnpm typecheck`
5. Commit using conventional commits (see below)
6. Open a PR against `main`

## Commit Conventions

We use [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` new feature
- `fix:` bug fix
- `docs:` documentation only
- `test:` adding or updating tests
- `refactor:` code change that neither fixes a bug nor adds a feature
- `chore:` maintenance tasks

## Code Style

- TypeScript throughout, strict mode
- ESM modules (`"type": "module"`)
- Express 5 for the server, Nuxt 4 for frontends
- Mongoose for data access
- Zod for validation schemas (shared package)

## Testing

- The unit/integration suites live under `packages/server/tests` and `packages/shared`; the server suite is integration-style (real HTTP via supertest). The dashboard has Playwright e2e tests under `packages/dashboard/e2e`.
- Server tests run against a **real MongoDB** — start one first (e.g. `docker compose up -d mongo`) and point the suite at it with `TEST_MONGO_URL`
- No mocks: tests exercise real code paths against real services
- Run all tests: `pnpm test`

## Pull Request Guidelines

- Keep PRs focused on a single concern
- Include tests for new features and bug fixes
- Update documentation if the change affects public APIs
- All CI checks must pass before merge

## Contributor License & Sign-Off

OpusHeart is released under the [PolyForm Noncommercial License 1.0.0](LICENSE). To keep the project sustainable and legally clean, contributions are accepted on these terms:

1. **Developer Certificate of Origin.** You certify the [DCO](https://developercertificate.org/) for every commit — that you wrote the contribution or otherwise have the right to submit it. Sign off each commit with `git commit -s` (adds a `Signed-off-by:` line).
2. **License grant.** You grant 137 & Co. a perpetual, irrevocable, worldwide license to your contribution, including the right to relicense it — for example, to offer OpusHeart under a separate commercial license. You retain copyright in your work.

This dual grant is what lets OpusHeart stay free for nonprofits and community organizations while 137 & Co. funds ongoing development through commercial licensing and hosting. If you can't agree to it, please don't submit a PR.

## Code of Conduct

This project follows the [Contributor Covenant](CODE_OF_CONDUCT.md). Be respectful.
