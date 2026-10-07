import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const visits = sqliteTable("visits", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  path: text("path").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch('now') * 1000)`),
});

export const registrations = sqliteTable("registrations", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  fullName: text("full_name").notNull(),
  email: text("email").notNull().unique(),
  phone: text("phone"),
  handle: text("handle"),
  discordUsername: text("discord_username"),
  heardAbout: text("heard_about").notNull().default(""),
  excitement: text("excitement"),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch('now') * 1000)`),
}, (table) => ({
  createdAtIdx: index("registrations_created_at_idx").on(table.createdAt),
}));

export const discordGuilds = sqliteTable("discord_guilds", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  discordGuildId: text("discord_guild_id").notNull().unique(),
  name: text("name").notNull(),
  lastBackfillAt: integer("last_backfill_at", { mode: "timestamp_ms" }),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch('now') * 1000)`),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch('now') * 1000)`),
}, (table) => ({
  guildIdIdx: index("discord_guilds_discord_guild_id_idx").on(table.discordGuildId),
}));

export const discordChannels = sqliteTable("discord_channels", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  guildId: integer("guild_id")
    .notNull()
    .references(() => discordGuilds.id),
  discordChannelId: text("discord_channel_id").notNull().unique(),
  name: text("name").notNull(),
  isMonitored: integer("is_monitored", { mode: "boolean" }).notNull().default(true),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch('now') * 1000)`),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch('now') * 1000)`),
}, (table) => ({
  guildIdx: index("discord_channels_guild_id_idx").on(table.guildId),
  monitoredIdx: index("discord_channels_monitored_idx").on(table.isMonitored),
}));

export const discordChannelSyncState = sqliteTable("discord_channel_sync_state", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  channelId: integer("channel_id")
    .notNull()
    .references(() => discordChannels.id)
    .unique(),
  lastCursorMessageId: text("last_cursor_message_id"),
  lastCursorMessageCreatedAt: integer("last_cursor_message_created_at", { mode: "timestamp_ms" }),
  lastAttemptedSyncAt: integer("last_attempted_sync_at", { mode: "timestamp_ms" }),
  lastSuccessfulSyncAt: integer("last_successful_sync_at", { mode: "timestamp_ms" }),
  lastError: text("last_error"),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch('now') * 1000)`),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch('now') * 1000)`),
}, (table) => ({
  channelIdx: index("discord_channel_sync_state_channel_id_idx").on(table.channelId),
  lastSuccessfulSyncIdx: index("discord_channel_sync_state_last_successful_sync_idx").on(table.lastSuccessfulSyncAt),
}));

export const discordMembers = sqliteTable("discord_members", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  guildId: integer("guild_id")
    .notNull()
    .references(() => discordGuilds.id),
  discordUserId: text("discord_user_id").notNull().unique(),
  username: text("username").notNull(),
  displayName: text("display_name"),
  avatarUrl: text("avatar_url"),
  isBot: integer("is_bot", { mode: "boolean" }).notNull().default(false),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch('now') * 1000)`),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch('now') * 1000)`),
}, (table) => ({
  guildIdx: index("discord_members_guild_id_idx").on(table.guildId),
  userIdx: index("discord_members_discord_user_id_idx").on(table.discordUserId),
}));

export const discordMessages = sqliteTable("discord_messages", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  discordMessageId: text("discord_message_id").notNull().unique(),
  guildId: integer("guild_id")
    .notNull()
    .references(() => discordGuilds.id),
  channelId: integer("channel_id")
    .notNull()
    .references(() => discordChannels.id),
  authorId: integer("author_id")
    .notNull()
    .references(() => discordMembers.id),
  content: text("content").notNull().default(""),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  editedAt: integer("edited_at", { mode: "timestamp_ms" }),
  deletedAt: integer("deleted_at", { mode: "timestamp_ms" }),
  rawJson: text("raw_json"),
}, (table) => ({
  messageIdIdx: index("discord_messages_discord_message_id_idx").on(table.discordMessageId),
  createdAtIdx: index("discord_messages_created_at_idx").on(table.createdAt),
  channelIdx: index("discord_messages_channel_id_idx").on(table.channelId),
  authorIdx: index("discord_messages_author_id_idx").on(table.authorId),
}));

export const messageSentiment = sqliteTable("message_sentiment", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  messageId: integer("message_id")
    .notNull()
    .references(() => discordMessages.id)
    .unique(),
  label: text("label").notNull(),
  confidence: integer("confidence").notNull().default(0),
  keywordsJson: text("keywords_json").notNull().default("[]"),
  rationale: text("rationale").notNull().default(""),
  provider: text("provider").notNull().default("heuristic"),
  classifiedAt: integer("classified_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch('now') * 1000)`),
}, (table) => ({
  labelIdx: index("message_sentiment_label_idx").on(table.label),
  classifiedAtIdx: index("message_sentiment_classified_at_idx").on(table.classifiedAt),
}));

export const messageReviewState = sqliteTable("message_review_state", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  messageId: integer("message_id")
    .notNull()
    .references(() => discordMessages.id)
    .unique(),
  status: text("status").notNull().default("pending"),
  note: text("note"),
  reviewedAt: integer("reviewed_at", { mode: "timestamp_ms" }),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch('now') * 1000)`),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch('now') * 1000)`),
}, (table) => ({
  statusIdx: index("message_review_state_status_idx").on(table.status),
  reviewedAtIdx: index("message_review_state_reviewed_at_idx").on(table.reviewedAt),
}));

export const channelHourlySnapshots = sqliteTable("channel_hourly_snapshots", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  channelId: integer("channel_id")
    .notNull()
    .references(() => discordChannels.id),
  bucketStart: integer("bucket_start", { mode: "timestamp_ms" }).notNull(),
  messageCount: integer("message_count").notNull().default(0),
  activeUserCount: integer("active_user_count").notNull().default(0),
  positiveCount: integer("positive_count").notNull().default(0),
  neutralCount: integer("neutral_count").notNull().default(0),
  negativeCount: integer("negative_count").notNull().default(0),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch('now') * 1000)`),
}, (table) => ({
  bucketIdx: index("channel_hourly_snapshots_bucket_idx").on(table.bucketStart),
  channelBucketIdx: index("channel_hourly_snapshots_channel_bucket_idx").on(table.channelId, table.bucketStart),
}));

export const channelDailySnapshots = sqliteTable("channel_daily_snapshots", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  channelId: integer("channel_id")
    .notNull()
    .references(() => discordChannels.id),
  bucketStart: integer("bucket_start", { mode: "timestamp_ms" }).notNull(),
  messageCount: integer("message_count").notNull().default(0),
  activeUserCount: integer("active_user_count").notNull().default(0),
  positiveCount: integer("positive_count").notNull().default(0),
  neutralCount: integer("neutral_count").notNull().default(0),
  negativeCount: integer("negative_count").notNull().default(0),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch('now') * 1000)`),
}, (table) => ({
  bucketIdx: index("channel_daily_snapshots_bucket_idx").on(table.bucketStart),
  channelBucketIdx: index("channel_daily_snapshots_channel_bucket_idx").on(table.channelId, table.bucketStart),
}));

export const overviewSnapshots = sqliteTable("overview_snapshots", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  granularity: text("granularity").notNull(),
  bucketStart: integer("bucket_start", { mode: "timestamp_ms" }).notNull(),
  totalMessages: integer("total_messages").notNull().default(0),
  activeUsers: integer("active_users").notNull().default(0),
  negativeRate: integer("negative_rate").notNull().default(0),
  healthScore: integer("health_score").notNull().default(0),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch('now') * 1000)`),
}, (table) => ({
  bucketIdx: index("overview_snapshots_bucket_idx").on(table.bucketStart),
  granularityBucketIdx: index("overview_snapshots_granularity_bucket_idx").on(table.granularity, table.bucketStart),
}));

export const appSettings = sqliteTable("app_settings", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  key: text("key").notNull().unique(),
  value: text("value").notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch('now') * 1000)`),
}, (table) => ({
  keyIdx: index("app_settings_key_idx").on(table.key),
}));

export const syncRuns = sqliteTable("sync_runs", {
  id: text("id").primaryKey(),
  mode: text("mode").notNull(),
  requestedBy: text("requested_by").notNull(),
  executionMode: text("execution_mode").notNull(),
  reset: integer("reset", { mode: "boolean" }).notNull().default(false),
  status: text("status").notNull(),
  startedAt: integer("started_at", { mode: "timestamp_ms" }).notNull(),
  finishedAt: integer("finished_at", { mode: "timestamp_ms" }),
  durationMs: integer("duration_ms"),
  classifiedCount: integer("classified_count").notNull().default(0),
  failureReason: text("failure_reason"),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch('now') * 1000)`),
}, (table) => ({
  startedAtIdx: index("sync_runs_started_at_idx").on(table.startedAt),
  statusIdx: index("sync_runs_status_idx").on(table.status),
}));

export const syncRunLogs = sqliteTable("sync_run_logs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  runId: text("run_id")
    .notNull()
    .references(() => syncRuns.id),
  timestamp: integer("timestamp", { mode: "timestamp_ms" }).notNull(),
  message: text("message").notNull(),
}, (table) => ({
  runIdIdx: index("sync_run_logs_run_id_idx").on(table.runId),
  runTimestampIdx: index("sync_run_logs_run_timestamp_idx").on(table.runId, table.timestamp),
}));

// ── Better Auth tables ──

export const user = sqliteTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: integer("email_verified", { mode: "boolean" })
    .notNull()
    .default(false),
  image: text("image"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  role: text("role"),
  banned: integer("banned", { mode: "boolean" }),
  banReason: text("ban_reason"),
  banExpires: integer("ban_expires", { mode: "timestamp" }),
});

export const session = sqliteTable("session", {
  id: text("id").primaryKey(),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  token: text("token").notNull().unique(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id")
    .notNull()
    .references(() => user.id),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  impersonatedBy: text("impersonated_by"),
});

export const account = sqliteTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: integer("access_token_expires_at", {
    mode: "timestamp",
  }),
  refreshTokenExpiresAt: integer("refresh_token_expires_at", {
    mode: "timestamp",
  }),
  scope: text("scope"),
  password: text("password"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export const verification = sqliteTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }),
  updatedAt: integer("updated_at", { mode: "timestamp" }),
});
