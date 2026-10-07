# Repository Guidelines

## Project Structure & Module Organization
- `src/index.ts`: Bun server entrypoint (API routes + static frontend serving).
- `src/frontend.tsx`: React client bootstrap.
- `src/router.tsx`: TanStack Router route tree and router registration.
- `src/App.tsx`: Main UI screen.
- `src/db/`: Database layer (`schema.ts`, `client.ts`, `migrate.ts`) for Bun SQLite + Drizzle.
- `drizzle/`: Generated SQL migrations and metadata.
- `dist/`: Production build output (generated).
- `data/`: Local SQLite files (runtime state; not source code).

## Build, Test, and Development Commands
- `bun install`: Install dependencies.
- `bun run dev`: Start Bun server with HMR for frontend and backend.
- `bun run build`: Production frontend bundle to `dist/` using Bun build API + Tailwind plugin.
- `bun run start`: Run server in production mode.
- `bun run db:generate`: Generate Drizzle migrations from schema changes.
- `bun run db:migrate`: Apply migrations to local SQLite DB.
- `bun run db:studio`: Open Drizzle Studio for DB inspection.

## Coding Style & Naming Conventions
- Language: TypeScript (strict mode enabled in `tsconfig.json`).
- Prefer explicit types on exported APIs.
- Indentation: 2 spaces; use semicolons and double quotes to match existing code.
- Prefer `type` over `interface` for type definitions.
- Avoid using classes; prefer functional style and enforce arrow-function constants (`const fn = () => {}`) for non-method logic. Do not use the `function` keyword for new code unless explicitly unavoidable.
- Filenames: `kebab-case` (for example, `replay-engine.ts`, `signin-route.tsx`).
- React components: `PascalCase` file/function names (example: `App.tsx`).
- React components: PascalCase exports (for example, `DashboardRoute`).
- Frontend imports use `@/*` alias where available; server code uses relative imports.
- Utility/helper modules: short `camelCase` exports, grouped by domain (`src/db/*`).
- Keep API route handlers in `src/index.ts` small; move reusable logic into modules.

## UI/UX Guidelines
- Favor clean, minimal components with disciplined spacing and clear visual hierarchy.
- No decorative fluff, glitter, novelty effects, or ornamental UI that does not improve comprehension.
- Aim for an extremely minimal, premium presentation with restrained polish and high-quality defaults.
- Prefer calm layouts, limited color usage, and strong typography over dense surfaces or heavy chrome.
- Interactions should feel precise and refined: subtle motion, obvious affordances, and no unnecessary animation.
- When in doubt, remove elements until only the essential interface remains.

## Testing Guidelines
- No automated test framework is configured yet.
- Minimum verification for each change:
  - `bun run build`
  - `bun run db:migrate` (for schema or API changes)
  - Manual API/UI smoke check in `bun run dev`.
- When adding tests, place them near source files as `*.test.ts` or `*.test.tsx`.

## Commit & Pull Request Guidelines
- This repository currently has no commit history; use Conventional Commits going forward (example: `feat: add visits API pagination`).
- Keep commits focused and atomic; separate DB schema changes from UI refactors when possible.
- PRs should include:
  - Clear summary of behavior changes
  - Linked issue/ticket (if available)
  - Migration notes for any `drizzle/` changes
  - Screenshots/GIFs for UI changes

## Security & Configuration Tips
- Never commit `.env*` files or secrets.
- Treat `data/app.db` as local runtime data; avoid committing it.
