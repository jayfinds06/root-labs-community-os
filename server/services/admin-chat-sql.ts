import { createAnthropic } from "@ai-sdk/anthropic";
import { generateObject } from "ai";
import { z } from "zod";
import { sqliteClient } from "../db/client";

const ADMIN_SQL_MODEL_ID = "claude-haiku-4-5";
const MAX_SQL_ROWS = 25;
const SQL_TIMEOUT_MS = 3000;

const ALLOWED_TABLES = [
  "discord_guilds",
  "discord_channels",
  "discord_channel_sync_state",
  "discord_members",
  "discord_messages",
  "message_sentiment",
  "message_review_state",
  "channel_hourly_snapshots",
  "channel_daily_snapshots",
  "overview_snapshots",
  "sync_runs",
  "sync_run_logs",
] as const;

const DENIED_TABLES = [
  "user",
  "session",
  "account",
  "verification",
  "registrations",
  "app_settings",
] as const;

const TABLE_SCHEMA_MAP = {
  discord_guilds: ["id", "discord_guild_id", "name", "last_backfill_at", "created_at", "updated_at"],
  discord_channels: ["id", "guild_id", "discord_channel_id", "name", "is_monitored", "created_at", "updated_at"],
  discord_channel_sync_state: ["id", "channel_id", "last_cursor_message_id", "last_cursor_message_created_at", "last_attempted_sync_at", "last_successful_sync_at", "last_error", "created_at", "updated_at"],
  discord_members: ["id", "guild_id", "discord_user_id", "username", "display_name", "avatar_url", "is_bot", "created_at", "updated_at"],
  discord_messages: ["id", "discord_message_id", "guild_id", "channel_id", "author_id", "content", "created_at", "edited_at", "deleted_at", "raw_json"],
  message_sentiment: ["id", "message_id", "label", "confidence", "keywords_json", "rationale", "provider", "classified_at"],
  message_review_state: ["id", "message_id", "status", "note", "reviewed_at", "created_at", "updated_at"],
  channel_hourly_snapshots: ["id", "channel_id", "bucket_start", "message_count", "active_user_count", "positive_count", "neutral_count", "negative_count", "updated_at"],
  channel_daily_snapshots: ["id", "channel_id", "bucket_start", "message_count", "active_user_count", "positive_count", "neutral_count", "negative_count", "updated_at"],
  overview_snapshots: ["id", "granularity", "bucket_start", "total_messages", "active_users", "negative_rate", "health_score", "updated_at"],
  sync_runs: ["id", "mode", "requested_by", "execution_mode", "reset", "status", "started_at", "finished_at", "duration_ms", "classified_count", "failure_reason", "created_at"],
  sync_run_logs: ["id", "run_id", "timestamp", "message"],
} as const;

const JOIN_GUIDE = [
  "discord_messages.author_id = discord_members.id",
  "discord_messages.channel_id = discord_channels.id",
  "discord_messages.guild_id = discord_guilds.id",
  "discord_members.guild_id = discord_guilds.id",
  "discord_channels.guild_id = discord_guilds.id",
  "message_sentiment.message_id = discord_messages.id",
  "message_review_state.message_id = discord_messages.id",
  "channel_hourly_snapshots.channel_id = discord_channels.id",
  "channel_daily_snapshots.channel_id = discord_channels.id",
  "discord_channel_sync_state.channel_id = discord_channels.id",
  "sync_run_logs.run_id = sync_runs.id",
] as const;

const TABLE_GUIDE = {
  discord_guilds: "Discord servers/workspaces.",
  discord_channels: "Channel metadata and monitored status.",
  discord_channel_sync_state: "Per-channel ingest cursor and sync health.",
  discord_members: "Known Discord members; join messages through author_id.",
  discord_messages: "Raw Discord messages and timestamps.",
  message_sentiment: "One sentiment record per message when classified.",
  message_review_state: "Human review status for flagged messages.",
  channel_hourly_snapshots: "Hourly per-channel message and sentiment aggregates.",
  channel_daily_snapshots: "Daily per-channel message and sentiment aggregates.",
  overview_snapshots: "Overall dashboard health and activity snapshots.",
  sync_runs: "Top-level sync executions and outcomes.",
  sync_run_logs: "Detailed log lines for each sync run.",
} as const;

const QUERY_EXAMPLES = [
  "Latest messages by channel: SELECT m.created_at, c.name AS channel_name, mem.display_name, m.content FROM discord_messages m JOIN discord_channels c ON m.channel_id = c.id JOIN discord_members mem ON m.author_id = mem.id ORDER BY m.created_at DESC LIMIT 10",
  "Negative sentiment by channel: SELECT c.name, COUNT(*) AS negative_messages FROM message_sentiment s JOIN discord_messages m ON s.message_id = m.id JOIN discord_channels c ON m.channel_id = c.id WHERE s.label = 'negative' GROUP BY c.id, c.name ORDER BY negative_messages DESC LIMIT 10",
  "Recent sync failures: SELECT id, status, failure_reason, started_at, finished_at FROM sync_runs WHERE status != 'completed' ORDER BY started_at DESC LIMIT 10",
] as const;

const sqlProposalSchema = z.object({
  sql: z.string().min(1),
});

type SqlGenerationInput = {
  question: string;
  contextSummary?: Record<string, unknown>;
};

export type AdminChatSqlResult = {
  summary: {
    tables: string[];
    rowCount: number;
    truncated: boolean;
  };
  rows: Array<Record<string, string | number | boolean | null>>;
};

const normalizeWhitespace = (value: string): string => value.replace(/\s+/g, " ").trim();

const getReferencedTables = (sql: string): string[] => {
  const matches = Array.from(
    sql.matchAll(/\b(?:from|join)\s+["`[]?([a-z_][a-z0-9_]*)["`\]]?/gi),
  );

  return Array.from(new Set(matches.map((match) => match[1]?.toLowerCase()).filter(Boolean))) as string[];
};

const stringifyCell = (value: unknown): string | number | boolean | null => {
  if (value === null || value === undefined) return null;
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value;
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  return JSON.stringify(value);
};

const validateSelectSql = (sql: string): { normalizedSql: string; tables: string[] } => {
  const normalizedSql = normalizeWhitespace(sql).replace(/;$/, "");
  const lowerSql = normalizedSql.toLowerCase();

  if (!lowerSql.startsWith("select ")) {
    throw new Error("Only SELECT statements are allowed.");
  }

  if (normalizedSql.includes(";")) {
    throw new Error("Multiple SQL statements are not allowed.");
  }

  if (
    /\b(insert|update|delete|alter|drop|create|replace|attach|detach|pragma|vacuum|reindex|analyze|begin|commit|rollback|savepoint|release)\b/i.test(
      normalizedSql,
    )
  ) {
    throw new Error("Mutating or administrative SQL is not allowed.");
  }

  if (/\bwith\b/i.test(normalizedSql)) {
    throw new Error("CTE queries are not allowed.");
  }

  const tables = getReferencedTables(normalizedSql);
  if (!tables.length) {
    throw new Error("SQL must reference at least one allowlisted table.");
  }

  const deniedTable = tables.find((table) => (DENIED_TABLES as readonly string[]).includes(table));
  if (deniedTable) {
    throw new Error(`Table ${deniedTable} is not allowed.`);
  }

  const disallowedTable = tables.find((table) => !(ALLOWED_TABLES as readonly string[]).includes(table));
  if (disallowedTable) {
    throw new Error(`Table ${disallowedTable} is not allowlisted.`);
  }

  return { normalizedSql, tables };
};

const createSqlPrompt = (input: SqlGenerationInput): string => {
  return JSON.stringify({
    question: input.question,
    contextSummary: input.contextSummary ?? {},
    constraints: {
      dialect: "sqlite",
      allowedTables: ALLOWED_TABLES,
      deniedTables: DENIED_TABLES,
      maxRows: MAX_SQL_ROWS,
      rules: [
        "Return a single SELECT statement only.",
        "Do not use PRAGMA or any write operation.",
        "Prefer exact filters, aggregation, ordering, and limits that answer the question directly.",
        "Use only the columns listed in schemaMap.",
        "Use joinGuide for joins; do not invent columns.",
      ],
    },
    schemaMap: TABLE_SCHEMA_MAP,
    joinGuide: JOIN_GUIDE,
    tableGuide: TABLE_GUIDE,
    queryExamples: QUERY_EXAMPLES,
    notes: [
      "discord_messages uses author_id, not user_id.",
      "discord_members stores the Discord identifier in discord_user_id.",
      "Use snapshot tables for trends and aggregated counts; use discord_messages for message-level detail.",
      "Prefer internal integer/text primary keys for joins, not external Discord ids unless filtering specific guild/channel/user identifiers.",
    ],
  });
};

export const generateAdminChatSql = async (
  apiKey: string | null,
  input: SqlGenerationInput,
): Promise<string | null> => {
  if (!apiKey) {
    return null;
  }

  const anthropic = createAnthropic({ apiKey });
  const { object } = await generateObject({
    model: anthropic(ADMIN_SQL_MODEL_ID),
    schema: sqlProposalSchema,
    temperature: 0,
    system: [
      "Write one read-only SQLite SELECT query for RootLabs' Discord admin dashboard.",
      "Use only the allowed tables.",
      "Use only the provided schemaMap columns, joinGuide relationships, and tableGuide semantics.",
      "Prefer the simplest query that directly answers the question; use snapshot tables for trends and message tables for row-level examples.",
      "Never produce mutating SQL, PRAGMA, or multiple statements.",
      "Return SQL only through the schema field.",
    ].join(" "),
    prompt: createSqlPrompt(input),
  });

  return object.sql;
};

export const executeAdminChatSql = async (sql: string): Promise<AdminChatSqlResult> => {
  const { normalizedSql, tables } = validateSelectSql(sql);
  const wrappedSql = `SELECT * FROM (${normalizedSql}) AS raw_admin_chat_result LIMIT ${MAX_SQL_ROWS + 1}`;
  const statement = sqliteClient.query(wrappedSql);
  const rows = await Promise.race<unknown[]>([
    Promise.resolve(statement.all() as unknown[]),
    new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error("SQL query timed out.")), SQL_TIMEOUT_MS);
    }),
  ]);

  const truncated = rows.length > MAX_SQL_ROWS;
  const visibleRows = rows.slice(0, MAX_SQL_ROWS).map((row) => {
    const normalizedRow = row as Record<string, unknown>;
    return Object.fromEntries(
      Object.entries(normalizedRow).map(([key, value]) => [key, stringifyCell(value)]),
    );
  });

  return {
    summary: {
      tables,
      rowCount: visibleRows.length,
      truncated,
    },
    rows: visibleRows,
  };
};
