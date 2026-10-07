export type DiscordOpsConfig = {
  botToken: string | null;
  clientId: string | null;
  guildId: string | null;
  monitoredChannelIds: string[];
  anthropicApiKey: string | null;
  appBaseUrl: string | null;
  backfillDays: number;
  incrementalBackfillDays: number;
  incrementalSyncEnabled: boolean;
  enableMessageContentIntent: boolean;
};

function readList(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function readNumber(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function readBoolean(value: string | undefined, fallback = false): boolean {
  if (!value) return fallback;
  return ["1", "true", "yes", "on"].includes(value.toLowerCase());
}

export function getDiscordOpsConfig(): DiscordOpsConfig {
  return {
    botToken: process.env.DISCORD_BOT_TOKEN ?? process.env.DISCORD_TOKEN ?? null,
    clientId: process.env.DISCORD_CLIENT_ID ?? null,
    guildId: process.env.DISCORD_GUILD_ID ?? null,
    monitoredChannelIds: readList(process.env.DISCORD_MONITORED_CHANNEL_IDS),
    anthropicApiKey: process.env.ANTHROPIC_API_KEY ?? null,
    appBaseUrl: process.env.APP_BASE_URL ?? null,
    backfillDays: readNumber(process.env.DISCORD_BACKFILL_DAYS, 14),
    incrementalBackfillDays: readNumber(process.env.DISCORD_INCREMENTAL_BACKFILL_DAYS, 1),
    incrementalSyncEnabled: readBoolean(process.env.DISCORD_INCREMENTAL_SYNC_ENABLED, true),
    enableMessageContentIntent: readBoolean(process.env.DISCORD_MESSAGE_CONTENT_INTENT),
  };
}
