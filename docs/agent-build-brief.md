# Root Labs Discord Ops v1 — Agent Build Brief

## Goal
Turn this repo from a launch/registration site into the first internal Root Labs operations app for one Discord server.

The first version is a web-only, single-server, read-only dashboard with two tabs:

- `Overview`
- `Sentiment`

Do not build desktop packaging, TikTok Shop integrations, creator-facing tools, compliance scoring, DMs, or Discord posting in this milestone.

## Current Repo Baseline
This repo already has the core pieces for a quick v1:

- Bun server with route objects in `server/routes/*`
- React 19 frontend with TanStack Router in `src/router.tsx`
- Better Auth email/password auth in `server/auth.ts`
- SQLite via `bun:sqlite` and Drizzle in `server/db/*`
- Existing protected admin patterns in `server/routes/admin.ts` and `src/AdminDashboard.tsx`

Use the current stack. Do not re-platform to Next.js, Express, or Postgres for v1.

## Product Scope
### In scope
- Internal dashboard for authenticated team members
- Discord message ingestion from selected channels
- Sentiment analysis on ingested messages
- Daily/hourly rollups
- Overview metrics based on Discord activity
- Channel-level sentiment views and keyword tracking

### Out of scope
- Desktop app
- Multi-tenant architecture
- TikTok Shop / GMV / payout data
- Creator messaging workflows
- Slash commands
- Gold / Garbage rating engine
- Public-facing creator app

## Required Environment Variables
Add these before implementation:

- `DISCORD_BOT_TOKEN` or `DISCORD_TOKEN`
- `DISCORD_CLIENT_ID`
- `DISCORD_GUILD_ID`
- `DISCORD_MONITORED_CHANNEL_IDS`
- `ANTHROPIC_API_KEY` or equivalent LLM provider key
- `APP_BASE_URL`

Keep Better Auth and SQLite config as-is unless a concrete limitation appears.

## Repo Areas To Extend
### Backend
- `server/index.ts`
  - keep Bun server startup
  - initialize the Discord ingestion worker from here via a separate module
- `server/db/schema.ts`
  - add Discord, sentiment, and snapshot tables
- `server/routes/admin.ts`
  - extend admin APIs for Overview and Sentiment
- `server/auth.ts`
  - keep Better Auth
  - continue using admin role checks

### Frontend
- `src/router.tsx`
  - keep `/dashboard`
  - add dashboard subviews or tab state for `Overview` and `Sentiment`
- `src/AdminDashboard.tsx`
  - replace registration-centric UI with ops dashboard UI
- `src/styles/admin.css`
  - extend existing admin styling instead of starting over

- `src/utils/api.ts`
  - add typed helpers for dashboard APIs

## Targeted Files
Scope changes should stay within:

- `src/AdminDashboard.tsx`
- `src/HomePage.tsx`
- `src/RegistrationPage.tsx`
- `src/router.tsx`
- `src/styles/admin.css`
- `src/styles/home.css`
- `src/utils/api.ts`
- `server/index.ts`
- `server/routes/admin.ts`
- `server/db/schema.ts`
- `server/auth.ts`
- `docs/agent-build-brief.md`

## Data Model Additions
Add the following tables to `server/db/schema.ts`.

### Discord config
- `discord_guilds`
  - `id`
  - `discordGuildId`
  - `name`
  - `timezone`
- `discord_channels`
  - `id`
  - `guildId`
  - `discordChannelId`
  - `name`
  - `isMonitored`

### Members and messages
- `discord_members`
  - `id`
  - `discordUserId`
  - `username`
  - `displayName`
  - `avatarUrl`
- `discord_messages`
  - `id`
  - `discordMessageId`
  - `discordChannelId`
  - `discordUserId`
  - `content`
  - `createdAt`
  - `editedAt`
  - `deletedAt`

### Sentiment
- `message_sentiment`
  - `id`
  - `messageId`
  - `label`
  - `confidence`
  - `keywordsJson`
  - `rationale`
  - `classifiedAt`

### Aggregates
- `channel_daily_snapshots`
  - `id`
  - `discordChannelId`
  - `snapshotDate`
  - `messageCount`
  - `activeUserCount`
  - `positiveCount`
  - `neutralCount`
  - `negativeCount`
  - `topKeywordsJson`
- `overview_snapshots`
  - `id`
  - `snapshotDate`
  - `totalMessages`
  - `activeUsers`
  - `negativeRate`
  - `healthScore`

Use indexes on message timestamps, channel ids, and snapshot dates.

## Backend Work
### 1. Discord ingestion
Create a Discord client module under `server/discord/`.

Responsibilities:
- connect to one server
- subscribe only to required events
- ingest messages from configured channels
- ignore bots and unmonitored channels
- upsert edits
- soft-mark deletes when possible

Do not mix Discord client logic directly into `server/index.ts`; import a bootstrap function instead.

### 2. Sentiment classification
Create a service under `server/services/` that:

- reads newly ingested messages
- classifies them into `positive`, `neutral`, or `negative`
- extracts 3-5 keywords/topics
- stores confidence and a short rationale

Keep the provider behind one interface so the LLM can be swapped later.

### 3. Snapshot jobs
Create a lightweight scheduler under `server/jobs/` for:

- hourly aggregation
- daily rollup generation
- optional backfill for the last 30 days if history is available

For v1, a simple in-process timer is acceptable because this repo already runs as one Bun server process.

### 4. Admin APIs
Extend `server/routes/admin.ts` with:

- `GET /api/admin/overview`
- `GET /api/admin/sentiment/channels`
- `GET /api/admin/sentiment/channel/:channelId`
- `GET /api/admin/digests/daily`
- `POST /api/admin/discord/sync`

Keep the existing `requireAdmin` pattern.

## Frontend Work
### Overview tab
Show:

- total messages today
- total messages this week
- active users today
- active users this week
- sentiment mix summary
- channels needing attention
- simple health score

### Sentiment tab
Show:

- per-channel positive / neutral / negative split
- keyword tracker with trend direction
- list of recent negative spikes
- drill-down into source messages

Keep the dashboard behind the existing `/dashboard` route. Tabs inside the page are enough for v1.

## Suggested Health Score
Keep it simple and Discord-native:

- 35% active user trend
- 25% total message trend
- 25% positive vs negative ratio
- 15% count of channels with negative spikes

Do not include GMV or creator tier data in v1.

## Implementation Order
### Phase 1
- add DB tables and migrations
- add Discord client bootstrap
- ingest messages into SQLite

### Phase 2
- add sentiment service
- persist per-message sentiment
- add snapshot jobs

### Phase 3
- replace current dashboard cards with Overview UI
- add Sentiment tab
- wire new admin APIs to frontend

### Phase 4
- add empty states, permission error states, and retry behavior
- add basic seed/dev scripts for local testing

## Acceptance Criteria
- Admin can sign in with the existing Better Auth flow.
- Discord messages from configured channels are stored in SQLite.
- Message edits do not create duplicate rows.
- Overview shows Discord-native KPI cards from live data.
- Sentiment tab shows per-channel sentiment mix and keywords.
- A user can inspect the raw messages behind a spike or alert.
- Unmonitored channels never appear in analytics.
- If sentiment classification fails, ingestion still succeeds and the failure is visible for retry.

## Test Scenarios
- message create, edit, and delete lifecycle
- unmonitored channel ignored
- bot-authenticated message ignored
- snapshot totals match raw messages
- admin-only route protection still works
- empty server data renders without crashing
- classification returns only allowed labels
- negative spike appears in Sentiment after seeded test data

## Non-Goals For This Repo Pass
Do not let the agent drift into these:

- rebuilding auth
- changing database engine
- adding desktop wrappers
- adding Discord posting or slash commands
- implementing TikTok APIs
- implementing the full feature doc from the original brainstorm

## Definition of Done
This repo should end up with:

- Discord ingestion running inside the Bun app process
- new Drizzle tables and migrations
- protected admin APIs for Overview and Sentiment
- a dashboard UI that replaces the current registration-focused admin experience
- local instructions for running the bot + web app together

## Current Status
- Homepage is now focused on the internal Community OS product at `/`.
- The historical event page is preserved under `/archive/event-launch`.
- The ops dashboard shell is live at `/dashboard` and uses existing Better Auth session flow.
