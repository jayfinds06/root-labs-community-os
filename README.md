# Root Labs Community OS

Internal operations dashboard built on the Bun + React starter base.

For first-time setup of this sanitized source export, see [CLIENT_SETUP.md](CLIENT_SETUP.md).

- Current scope: Overview and Sentiment for one Discord server
- Entry points:
  - `"/"` — internal product home
  - `"/dashboard"` — authenticated ops dashboard
  - `"/archive/event-launch"` — preserved legacy event page
- Build guide: follow `docs/agent-build-brief.md` for the implementation plan

## Stack

- React 19
- Tailwind CSS 4
- TanStack Router
- Bun SQLite (`bun:sqlite`) + Drizzle ORM

## Install

```bash
bun install
```

## Run dev server

```bash
bun dev
```

## Build

```bash
bun run build
```

## Start production server

```bash
bun run start
```

## Drizzle commands

```bash
bun run db:generate
bun run db:migrate
bun run db:studio
```
