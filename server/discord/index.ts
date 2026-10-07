import {
  ChannelType,
  Client,
  Events,
  GatewayIntentBits,
  type GuildBasedChannel,
  type Message,
} from "discord.js";
import { and, eq } from "drizzle-orm";
import { getDiscordOpsConfig } from "../config";
import { db } from "../db/client";
import {
  channelDailySnapshots,
  channelHourlySnapshots,
  discordChannels,
  discordChannelSyncState,
  discordGuilds,
  discordMembers,
  discordMessages,
  messageSentiment,
  overviewSnapshots,
} from "../db/schema";
import { classifyPendingMessages } from "../services/sentiment";
import { refreshSnapshots } from "../services/dashboard";
import {
  appendSyncAuditLog,
  createSyncAuditRun as persistSyncAuditRunStart,
  finalizeSyncAuditRun as persistSyncAuditRunFinish,
  type SyncAuditRun,
} from "../services/sync-audit";
import {
  discordSyncCadenceLimits,
  getDiscordSyncCadenceMinutes,
  saveDiscordSyncCadenceMinutes,
} from "../services/discord-settings";

type SyncMode = "manual" | "incremental";

type SyncJobData = {
  mode: SyncMode;
  requestedBy: "manual" | "cron" | "startup";
  reset?: boolean;
};

type SyncRunResponse = {
  ok: boolean;
  reason?: string;
};

type SyncRunOptions = {
  requestedBy: SyncJobData["requestedBy"];
  executionMode: "direct";
  reset?: boolean;
  rejectIfBusy?: boolean;
};

type ResetResponse = {
  ok: boolean;
  reason?: string;
  deleted?: {
    overviewSnapshots: number;
    channelDailySnapshots: number;
    channelHourlySnapshots: number;
    messageSentiment: number;
    discordMessages: number;
    discordMembers: number;
    discordChannelSyncState: number;
    discordChannels: number;
    discordGuilds: number;
  };
};

export type DiscordRuntimeStatus = {
  enabled: boolean;
  clientReady: boolean;
  executionMode: "direct" | "disabled";
  inProgress: boolean;
  currentMode: SyncMode | null;
  currentRequestedBy: SyncJobData["requestedBy"] | null;
  startedAt: number | null;
  lastSuccessAt: number | null;
  lastFailureAt: number | null;
  lastFailureReason: string | null;
  lastDurationMs: number | null;
  overlapSkips: number;
  lastClassifiedCount: number;
  pollIntervalMs: number;
  monitoredChannelCount: number;
  messageContentIntentEnabled: boolean;
  anthropicConfigured: boolean;
};

type DiscordRuntime = {
  enabled: boolean;
  syncNow: (options?: { reset?: boolean }) => Promise<SyncRunResponse>;
  resetData: () => Promise<ResetResponse>;
  getStatus: () => Promise<DiscordRuntimeStatus>;
};

const CADENCE_REFRESH_INTERVAL_MS = 30 * 1000;

type ChannelCursorState = {
  lastCursorMessageId: string | null;
  lastCursorMessageCreatedAt: Date | null;
};

let runtime: DiscordRuntime = {
  enabled: false,
  syncNow: async () => ({ ok: false, reason: "Discord runtime not configured." }),
  resetData: async () => ({ ok: false, reason: "Discord runtime not configured." }),
  getStatus: async () => ({
    enabled: false,
    clientReady: false,
    executionMode: "disabled",
    inProgress: false,
    currentMode: null,
    currentRequestedBy: null,
    startedAt: null,
    lastSuccessAt: null,
    lastFailureAt: null,
    lastFailureReason: "Discord runtime not configured.",
    lastDurationMs: null,
    overlapSkips: 0,
    lastClassifiedCount: 0,
    pollIntervalMs: discordSyncCadenceLimits.defaultMinutes * 60 * 1000,
    monitoredChannelCount: 0,
    messageContentIntentEnabled: false,
    anthropicConfigured: false,
  }),
};

let applyRuntimeCadence: ((pollIntervalMs: number) => Promise<void>) | null = null;
let syncStatus: DiscordRuntimeStatus = {
  enabled: false,
  clientReady: false,
  executionMode: "disabled",
  inProgress: false,
  currentMode: null,
  currentRequestedBy: null,
  startedAt: null,
  lastSuccessAt: null,
  lastFailureAt: null,
  lastFailureReason: null,
  lastDurationMs: null,
  overlapSkips: 0,
  lastClassifiedCount: 0,
  pollIntervalMs: discordSyncCadenceLimits.defaultMinutes * 60 * 1000,
  monitoredChannelCount: 0,
  messageContentIntentEnabled: false,
  anthropicConfigured: false,
};

const DISALLOWED_INTENTS_ERROR = "Used disallowed intents";
const MISSING_ACCESS_ERROR_CODE = 50001;
let syncRunSequence = 0;

function toReason(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return "Discord sync failed.";
}

function isDisallowedIntentsError(error: unknown): boolean {
  return error instanceof Error && error.message.includes(DISALLOWED_INTENTS_ERROR);
}

function isMissingAccessError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const maybeCode = "code" in error ? error.code : null;
  return maybeCode === MISSING_ACCESS_ERROR_CODE || error.message.includes("Missing Access");
}

function buildGatewayIntents(enableMessageContentIntent: boolean): GatewayIntentBits[] {
  const intents = [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
  ];

  if (enableMessageContentIntent) {
    intents.push(GatewayIntentBits.MessageContent);
  }

  return intents;
}

function getMissingConfig(config: ReturnType<typeof getDiscordOpsConfig>): string[] {
  const missing: string[] = [];
  if (!config.botToken) missing.push("DISCORD_BOT_TOKEN|DISCORD_TOKEN");
  if (!config.guildId) missing.push("DISCORD_GUILD_ID");
  if (config.monitoredChannelIds.length === 0) missing.push("DISCORD_MONITORED_CHANNEL_IDS");
  return missing;
}

function logConfigSummary(config: ReturnType<typeof getDiscordOpsConfig>) {
  console.log("Discord config:", {
    hasToken: Boolean(config.botToken),
    hasClientId: Boolean(config.clientId),
    hasGuildId: Boolean(config.guildId),
    monitoredChannelCount: config.monitoredChannelIds.length,
    monitoredChannelIds: config.monitoredChannelIds,
    useMessageContentIntent: config.enableMessageContentIntent,
    hasAnthropicApiKey: Boolean(config.anthropicApiKey),
    appBaseUrl: config.appBaseUrl,
    backfillDays: config.backfillDays,
    incrementalBackfillDays: config.incrementalBackfillDays,
    incrementalSyncEnabled: config.incrementalSyncEnabled,
  });
}

function cadenceMinutesToMs(minutes: number): number {
  return minutes * 60 * 1000;
}

function buildSyncAuditRun(input: {
  mode: SyncMode;
  requestedBy: SyncJobData["requestedBy"];
  executionMode: "direct";
  reset: boolean;
}): SyncAuditRun {
  syncRunSequence += 1;
  return {
    id: `sync-${nowMs()}-${syncRunSequence}`,
    mode: input.mode,
    requestedBy: input.requestedBy,
    executionMode: input.executionMode,
    reset: input.reset,
    status: "running",
    startedAt: nowMs(),
    finishedAt: null,
    durationMs: null,
    classifiedCount: 0,
    failureReason: null,
    logs: [],
  };
}

const sleep = async (ms: number): Promise<void> => {
  await new Promise((resolve) => setTimeout(resolve, ms));
};

const logSyncMessage = async (runId: string | undefined, message: string): Promise<void> => {
  const prefix = runId ?? "direct";
  console.log(`[sync:${prefix}] ${message}`);
  await appendSyncAuditLog(runId, message, nowMs());
};

const retryDiscordOperation = async <T>(
  label: string,
  operation: () => Promise<T>,
  runId?: string,
): Promise<T> => {
  const delays = [750, 1500, 3000];
  let lastError: unknown;

  for (let attempt = 0; attempt <= delays.length; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (attempt === delays.length) {
        await logSyncMessage(runId, `${label} failed after ${attempt + 1} attempts.`);
        throw error;
      }

      const delayMs = delays[attempt] ?? delays[delays.length - 1]!;
      await logSyncMessage(runId, `${label} failed on attempt ${attempt + 1}; retrying in ${delayMs}ms.`);
      await sleep(delayMs);
    }
  }

  throw lastError instanceof Error ? lastError : new Error(`${label} failed.`);
};

const clearDiscordIngestedData = async (): Promise<NonNullable<ResetResponse["deleted"]>> => {
  const deleted = {
    overviewSnapshots: db.delete(overviewSnapshots).run().changes,
    channelDailySnapshots: db.delete(channelDailySnapshots).run().changes,
    channelHourlySnapshots: db.delete(channelHourlySnapshots).run().changes,
    messageSentiment: db.delete(messageSentiment).run().changes,
    discordMessages: db.delete(discordMessages).run().changes,
    discordMembers: db.delete(discordMembers).run().changes,
    discordChannelSyncState: db.delete(discordChannelSyncState).run().changes,
    discordChannels: db.delete(discordChannels).run().changes,
    discordGuilds: db.delete(discordGuilds).run().changes,
  };

  return deleted;
};

async function getRuntimeStatus(): Promise<DiscordRuntimeStatus> {
  return { ...syncStatus };
}

function nowDate(): Date {
  return new Date();
}

function nowMs(): number {
  return Date.now();
}

function toMs(value: number | Date | null | undefined): Date {
  if (!value) return nowDate();
  return value instanceof Date ? value : new Date(value);
}

async function getChannelCursorState(channelId: number): Promise<ChannelCursorState> {
  const existing = await db
    .select({
      lastCursorMessageId: discordChannelSyncState.lastCursorMessageId,
      lastCursorMessageCreatedAt: discordChannelSyncState.lastCursorMessageCreatedAt,
    })
    .from(discordChannelSyncState)
    .where(eq(discordChannelSyncState.channelId, channelId))
    .get();

  return {
    lastCursorMessageId: existing?.lastCursorMessageId ?? null,
    lastCursorMessageCreatedAt: existing?.lastCursorMessageCreatedAt ?? null,
  };
}

async function updateChannelSyncState(
  channelId: number,
  values: Partial<{
    lastCursorMessageId: string | null;
    lastCursorMessageCreatedAt: Date | null;
    lastAttemptedSyncAt: Date | null;
    lastSuccessfulSyncAt: Date | null;
    lastError: string | null;
  }>,
): Promise<void> {
  const now = nowDate();
  await db.insert(discordChannelSyncState).values({
    channelId,
    lastCursorMessageId: values.lastCursorMessageId ?? null,
    lastCursorMessageCreatedAt: values.lastCursorMessageCreatedAt ?? null,
    lastAttemptedSyncAt: values.lastAttemptedSyncAt ?? null,
    lastSuccessfulSyncAt: values.lastSuccessfulSyncAt ?? null,
    lastError: values.lastError ?? null,
    updatedAt: now,
  }).onConflictDoUpdate({
    target: discordChannelSyncState.channelId,
    set: {
      lastCursorMessageId: values.lastCursorMessageId ?? null,
      lastCursorMessageCreatedAt: values.lastCursorMessageCreatedAt ?? null,
      lastAttemptedSyncAt: values.lastAttemptedSyncAt ?? null,
      lastSuccessfulSyncAt: values.lastSuccessfulSyncAt ?? null,
      lastError: values.lastError ?? null,
      updatedAt: now,
    },
  });
}

async function ensureGuild(discordGuildId: string, name: string) {
  const now = nowDate();
  const result = await db
    .insert(discordGuilds)
    .values({
      discordGuildId,
      name,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: discordGuilds.discordGuildId,
      set: {
        name,
        updatedAt: now,
      },
    })
    .returning({ id: discordGuilds.id })
    .get();
  return result.id;
}

async function ensureChannel(guildId: number, channel: GuildBasedChannel, monitored: boolean) {
  const now = nowDate();
  const values = {
    guildId,
    discordChannelId: channel.id,
    name: channel.name,
    isMonitored: monitored,
    updatedAt: now,
  };
  const result = await db
    .insert(discordChannels)
    .values(values)
    .onConflictDoUpdate({
      target: discordChannels.discordChannelId,
      set: values,
    })
    .returning({ id: discordChannels.id })
    .get();
  return result.id;
}

async function ensureMember(guildId: number, message: Message<boolean>) {
  const now = nowDate();
  const values = {
    guildId,
    discordUserId: message.author.id,
    username: message.author.username,
    displayName: message.member?.displayName ?? message.author.globalName ?? message.author.username,
    avatarUrl: message.author.displayAvatarURL() || null,
    isBot: message.author.bot,
    updatedAt: now,
  };
  const result = await db
    .insert(discordMembers)
    .values(values)
    .onConflictDoUpdate({
      target: discordMembers.discordUserId,
      set: values,
    })
    .returning({ id: discordMembers.id })
    .get();
  return result.id;
}

async function upsertMessage(guildId: number, channelId: number, authorId: number, message: Message<boolean>) {
  const values = {
    guildId,
    channelId,
    authorId,
    content: message.content ?? "",
    createdAt: toMs(message.createdTimestamp),
    editedAt: message.editedTimestamp ? toMs(message.editedTimestamp) : null,
    deletedAt: null,
    rawJson: JSON.stringify({
      attachments: [...message.attachments.values()].map((item) => item.url),
      embeds: message.embeds.length,
      reactions: message.reactions.cache.size,
    }),
  };
  const result = await db
    .insert(discordMessages)
    .values({
      discordMessageId: message.id,
      ...values,
    })
    .onConflictDoUpdate({
      target: discordMessages.discordMessageId,
      set: values,
    })
    .returning({ id: discordMessages.id })
    .get();
  return result.id;
}

async function markMessageDeleted(messageId: string) {
  await db
    .update(discordMessages)
    .set({ deletedAt: nowDate() })
    .where(eq(discordMessages.discordMessageId, messageId))
    .run();
}

async function syncGuildChannels(client: Client, guildId: string, monitoredChannelIds: string[]) {
  const guild = await client.guilds.fetch(guildId);
  const internalGuildId = await ensureGuild(guild.id, guild.name);
  const channels = await guild.channels.fetch();
  for (const channel of channels.values()) {
    if (!channel || channel.type !== ChannelType.GuildText) continue;
    await ensureChannel(internalGuildId, channel, monitoredChannelIds.includes(channel.id));
  }
  return { guild, internalGuildId };
}

async function ingestMessage(
  message: Message<boolean>,
  internalGuildId: number,
  monitoredChannelIds: string[],
): Promise<number | null> {
  if (message.author.bot || !message.guild || !monitoredChannelIds.includes(message.channelId)) {
    return null;
  }

  if (message.channel.type !== ChannelType.GuildText) {
    return null;
  }

  let resolvedGuildId = internalGuildId;
  if (!resolvedGuildId) {
    resolvedGuildId = await ensureGuild(message.guild.id, message.guild.name);
  }

  let channel = await db
    .select()
    .from(discordChannels)
    .where(and(eq(discordChannels.discordChannelId, message.channelId), eq(discordChannels.guildId, resolvedGuildId)))
    .get();

  if (!channel) {
    resolvedGuildId = await ensureGuild(message.guild.id, message.guild.name);
    const channelId = await ensureChannel(resolvedGuildId, message.channel, true);
    channel = await db
      .select()
      .from(discordChannels)
      .where(eq(discordChannels.id, channelId))
      .get();
  }

  if (!channel) return null;

  const authorId = await ensureMember(resolvedGuildId, message);
  return upsertMessage(resolvedGuildId, channel.id, authorId, message);
}

async function backfillRecentHistory(
  client: Client,
  guildId: string,
  internalGuildId: number,
  monitoredChannelIds: string[],
  mode: SyncMode,
  backfillDays: number,
  runId?: string,
) {
  const cutoff = nowMs() - backfillDays * 24 * 60 * 60 * 1000;
  for (const channelId of monitoredChannelIds) {
    await logSyncMessage(runId, `Backfilling channel ${channelId}.`);
    let channel: Awaited<ReturnType<Client["channels"]["fetch"]>>;
    try {
      channel = await retryDiscordOperation(
        `Fetch channel ${channelId}`,
        () => client.channels.fetch(channelId),
        runId,
      );
    } catch (error) {
      if (isMissingAccessError(error)) {
        await logSyncMessage(runId, `Skipping channel ${channelId}: bot is missing access.`);
        continue;
      }
      throw error;
    }
    if (!channel || channel.type !== ChannelType.GuildText) continue;

    const internalChannelId = await ensureChannel(internalGuildId, channel, true);

    try {
      const existingCursor = await getChannelCursorState(internalChannelId);
      const useForwardCursor = mode === "incremental" && Boolean(existingCursor.lastCursorMessageId);
      await updateChannelSyncState(internalChannelId, {
        lastCursorMessageId: existingCursor.lastCursorMessageId,
        lastCursorMessageCreatedAt: existingCursor.lastCursorMessageCreatedAt,
        lastAttemptedSyncAt: nowDate(),
        lastError: null,
      });

      let fetchedCount = 0;
      let ingestedCount = 0;
      let skippedOldCount = 0;
      let before: string | undefined;
      let after = useForwardCursor ? existingCursor.lastCursorMessageId ?? undefined : undefined;
      let latestCursorMessageId = existingCursor.lastCursorMessageId;
      let latestCursorMessageCreatedAt = existingCursor.lastCursorMessageCreatedAt;

      while (true) {
        const batch = await retryDiscordOperation(
          `Fetch message batch for channel ${channelId}`,
          () => channel.messages.fetch(useForwardCursor ? { limit: 100, after } : { limit: 100, before }),
          runId,
        );
        if (batch.size === 0) break;
        fetchedCount += batch.size;
        let stop = false;
        const messages = [...batch.values()].sort((a, b) => a.createdTimestamp - b.createdTimestamp);

        for (const message of messages) {
          if (!useForwardCursor && message.createdTimestamp < cutoff) {
            skippedOldCount += 1;
            stop = true;
            break;
          }
          await ingestMessage(message, internalGuildId, monitoredChannelIds);
          ingestedCount += 1;
          if (
            !latestCursorMessageCreatedAt
            || message.createdTimestamp >= latestCursorMessageCreatedAt.getTime()
          ) {
            latestCursorMessageId = message.id;
            latestCursorMessageCreatedAt = toMs(message.createdTimestamp);
          }
          await sleep(40);
        }

        if (useForwardCursor) {
          after = messages[messages.length - 1]?.id;
          if (!after) break;
        } else {
          before = batch.last()?.id;
          if (!before || stop) break;
        }

        await sleep(300);
      }

      await updateChannelSyncState(internalChannelId, {
        lastCursorMessageId: latestCursorMessageId,
        lastCursorMessageCreatedAt: latestCursorMessageCreatedAt,
        lastAttemptedSyncAt: nowDate(),
        lastSuccessfulSyncAt: nowDate(),
        lastError: null,
      });

      await logSyncMessage(
        runId,
        `Backfill summary for ${channelId}: mode=${useForwardCursor ? "cursor" : "window"}, fetched=${fetchedCount}, ingested=${ingestedCount}, skippedOld=${skippedOldCount}.`,
      );
    } catch (error) {
      await updateChannelSyncState(internalChannelId, {
        lastAttemptedSyncAt: nowDate(),
        lastError: toReason(error),
      });
      throw error;
    }
  }
  await db
    .update(discordGuilds)
    .set({ lastBackfillAt: nowDate(), updatedAt: nowDate() })
    .where(eq(discordGuilds.discordGuildId, guildId))
    .run();
}

export async function bootstrapDiscordOps(): Promise<DiscordRuntime> {
  const config = getDiscordOpsConfig();
  const initialCadenceMinutes = await getDiscordSyncCadenceMinutes();
  const initialPollIntervalMs = cadenceMinutesToMs(initialCadenceMinutes);
  logConfigSummary(config);
  syncStatus = {
    ...syncStatus,
    enabled: false,
    clientReady: false,
    executionMode: "disabled",
    inProgress: false,
    currentMode: null,
    currentRequestedBy: null,
    startedAt: null,
    lastFailureReason: null,
    monitoredChannelCount: config.monitoredChannelIds.length,
    messageContentIntentEnabled: config.enableMessageContentIntent,
    anthropicConfigured: Boolean(config.anthropicApiKey),
    pollIntervalMs: initialPollIntervalMs,
  };

  const missingConfig = getMissingConfig(config);
  if (missingConfig.length > 0) {
    console.error(
      `Discord runtime disabled: missing required env configuration (${missingConfig.join(", ")}).`,
    );
    runtime = {
      enabled: false,
      syncNow: async () => {
        console.error(
          `Discord sync requested but runtime is disabled: missing required env configuration (${missingConfig.join(", ")}).`,
        );
        return { ok: false, reason: "Missing Discord env configuration." };
      },
      resetData: async () => {
        try {
          const deleted = await clearDiscordIngestedData();
          return { ok: true, deleted };
        } catch (error) {
          return { ok: false, reason: toReason(error) };
        }
      },
      getStatus: getRuntimeStatus,
    };
    syncStatus = {
      ...syncStatus,
      enabled: false,
      executionMode: "disabled",
      lastFailureReason: "Missing Discord env configuration.",
    };
    applyRuntimeCadence = null;
    return runtime;
  }

  let messageContentIntentEnabled = config.enableMessageContentIntent;
  let client = new Client({ intents: buildGatewayIntents(messageContentIntentEnabled) });
  let internalGuildId = 0;
  let isClientReady = false;
  let incrementalTimeout: ReturnType<typeof setTimeout> | null = null;
  let cadenceWatcherInterval: ReturnType<typeof setInterval> | null = null;

  const clearIncrementalTimeout = () => {
    if (!incrementalTimeout) {
      return;
    }

    clearTimeout(incrementalTimeout);
    incrementalTimeout = null;
  };

  const applyCadence = async (pollIntervalMs: number): Promise<void> => {
    syncStatus = {
      ...syncStatus,
      pollIntervalMs,
    };

    if (!config.incrementalSyncEnabled) {
      clearIncrementalTimeout();
    }
  };

  const refreshCadenceFromSettings = async (): Promise<number> => {
    const cadenceMinutes = await getDiscordSyncCadenceMinutes();
    const nextPollIntervalMs = cadenceMinutesToMs(cadenceMinutes);

    if (syncStatus.pollIntervalMs !== nextPollIntervalMs) {
      await applyCadence(nextPollIntervalMs);
    }

    return nextPollIntervalMs;
  };

  const scheduleDirectIncrementalSync = async (): Promise<void> => {
    clearIncrementalTimeout();

    if (!config.incrementalSyncEnabled) {
      return;
    }

    const nextPollIntervalMs = await refreshCadenceFromSettings();
    incrementalTimeout = setTimeout(async () => {
      const result = await runSyncTracked("incremental", {
        requestedBy: "cron",
        executionMode: "direct",
        rejectIfBusy: false,
      });
      if (!result.ok && result.reason !== "Skipped overlapping sync run.") {
        console.error("Incremental Discord sync failed:", result.reason);
      }

      await scheduleDirectIncrementalSync();
    }, nextPollIntervalMs);
  };

  applyRuntimeCadence = applyCadence;

  const waitForClientReady = async (): Promise<boolean> => {
    for (let attempt = 0; attempt < 30; attempt += 1) {
      if (isClientReady) return true;
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    return false;
  };

  const runSyncTracked = async (
    mode: SyncMode,
    options: SyncRunOptions,
  ): Promise<{ ok: boolean; reason?: string; classifiedCount?: number }> => {
    const rejectIfBusy = options.rejectIfBusy ?? true;
    if (syncStatus.inProgress) {
      syncStatus = {
        ...syncStatus,
        overlapSkips: syncStatus.overlapSkips + 1,
      };
      await logSyncMessage(
        undefined,
        rejectIfBusy ? "Rejected overlapping sync request." : "Skipped overlapping sync request.",
      );
      return {
        ok: false,
        reason: rejectIfBusy ? "A Discord sync is already running." : "Skipped overlapping sync run.",
      };
    }

    const auditRun = buildSyncAuditRun({
      mode,
      requestedBy: options.requestedBy,
      executionMode: options.executionMode,
      reset: options.reset ?? false,
    });
    await persistSyncAuditRunStart({
      id: auditRun.id,
      mode: auditRun.mode,
      requestedBy: auditRun.requestedBy,
      executionMode: auditRun.executionMode,
      reset: auditRun.reset,
      startedAt: auditRun.startedAt,
    });
    const startedAt = nowMs();
    syncStatus = {
      ...syncStatus,
      enabled: true,
      clientReady: isClientReady,
      executionMode: options.executionMode,
      inProgress: true,
      currentMode: mode,
      currentRequestedBy: options.requestedBy,
      startedAt,
      lastFailureReason: null,
    };

    try {
      await logSyncMessage(auditRun.id, `Preparing ${mode} sync (${options.executionMode}).`);
      if (options.reset) {
        await logSyncMessage(auditRun.id, "Reset requested. Clearing ingested Discord data before sync.");
        await clearDiscordIngestedData();
      }
      if (!isClientReady) {
        await logSyncMessage(auditRun.id, "Waiting for Discord client readiness.");
      }
      const result = await (async (): Promise<{ ok: boolean; reason?: string; classifiedCount?: number }> => {
        if (!isClientReady) {
          const ready = await waitForClientReady();
          if (!ready) {
            return { ok: false, reason: "Discord client is not ready yet." };
          }
        }

        try {
          await logSyncMessage(auditRun.id, "Syncing guild channels.");
          const synced = await retryDiscordOperation(
            `Sync guild channels for ${config.guildId!}`,
            () => syncGuildChannels(client, config.guildId!, config.monitoredChannelIds),
            auditRun.id,
          );
          internalGuildId = synced.internalGuildId;
          const backfillDays = mode === "incremental" ? config.incrementalBackfillDays : config.backfillDays;
          await logSyncMessage(auditRun.id, `Backfilling ${backfillDays} day window across ${config.monitoredChannelIds.length} channels.`);
          await backfillRecentHistory(
            client,
            config.guildId!,
            internalGuildId,
            config.monitoredChannelIds,
            mode,
            backfillDays,
            auditRun.id,
          );
          const classifyLimit = mode === "incremental" ? 100 : 200;
          await logSyncMessage(auditRun.id, `Classifying up to ${classifyLimit} pending messages.`);
          const classification = await classifyPendingMessages(config.anthropicApiKey, classifyLimit);
          await logSyncMessage(
            auditRun.id,
            `Classification summary: classifier=${classification.classifier}, pendingBefore=${classification.pendingBefore}, selected=${classification.selected}, processed=${classification.processed}, pendingAfter=${classification.pendingAfter}, limit=${classification.limit}${classification.skipReason ? `, skipReason=${classification.skipReason}` : ""}.`,
          );
          await logSyncMessage(auditRun.id, `Classified ${classification.processed} messages.`);
          await refreshSnapshots();
          await logSyncMessage(auditRun.id, "Refreshed overview and channel snapshots.");
          return { ok: true, classifiedCount: classification.processed };
        } catch (error) {
          console.error("Discord sync failed:", error);
          return { ok: false, reason: toReason(error) };
        }
      })();
      const finishedAt = nowMs();
      syncStatus = {
        ...syncStatus,
        clientReady: isClientReady,
        inProgress: false,
        currentMode: null,
        currentRequestedBy: null,
        startedAt: null,
        lastDurationMs: finishedAt - startedAt,
        lastClassifiedCount: result.classifiedCount ?? 0,
        lastSuccessAt: result.ok ? finishedAt : syncStatus.lastSuccessAt,
        lastFailureAt: result.ok ? syncStatus.lastFailureAt : finishedAt,
        lastFailureReason: result.ok ? null : result.reason ?? "Discord sync failed.",
      };
      await persistSyncAuditRunFinish(auditRun.id, result, finishedAt);
      return result;
    } catch (error) {
      const finishedAt = nowMs();
      syncStatus = {
        ...syncStatus,
        clientReady: isClientReady,
        inProgress: false,
        currentMode: null,
        currentRequestedBy: null,
        startedAt: null,
        lastDurationMs: finishedAt - startedAt,
        lastFailureAt: finishedAt,
        lastFailureReason: toReason(error),
      };
      const result = { ok: false, reason: toReason(error) };
      await persistSyncAuditRunFinish(auditRun.id, result, finishedAt);
      return result;
    }
  };

  const attachClientEventHandlers = (targetClient: Client) => {
    targetClient.on(Events.Error, (error) => {
      if (isDisallowedIntentsError(error)) {
        console.error(
          "Discord gateway rejected the configured privileged intents. Disable DISCORD_MESSAGE_CONTENT_INTENT or enable Message Content Intent for the bot in the Discord developer portal.",
        );
        return;
      }

      console.error("Discord client error:", error);
    });

    targetClient.once(Events.ClientReady, async () => {
      isClientReady = true;
      syncStatus = {
        ...syncStatus,
        enabled: true,
        clientReady: true,
        executionMode: "direct",
      };

      const initialSyncResult = await runSyncTracked("manual", {
        requestedBy: "startup",
        executionMode: "direct",
      });
      if (!initialSyncResult.ok) {
        console.error("Initial in-process Discord sync failed:", initialSyncResult.reason);
      }

      if (config.incrementalSyncEnabled) {
        await scheduleDirectIncrementalSync();
      }

      if (!cadenceWatcherInterval) {
        cadenceWatcherInterval = setInterval(() => {
          void refreshCadenceFromSettings();
        }, CADENCE_REFRESH_INTERVAL_MS);
      }
    });

    targetClient.on(Events.MessageCreate, async (message) => {
      await ingestMessage(message, internalGuildId, config.monitoredChannelIds);
    });

    targetClient.on(Events.MessageUpdate, async (_, updated) => {
      if (!updated.partial) {
        const messageId = await ingestMessage(updated, internalGuildId, config.monitoredChannelIds);
        if (messageId) {
          await db.delete(messageSentiment).where(eq(messageSentiment.messageId, messageId)).run();
        }
      }
    });

    targetClient.on(Events.MessageDelete, async (message) => {
      if (!message.id) return;
      await markMessageDeleted(message.id);
    });
  };

  const loginClient = async (): Promise<void> => {
    try {
      await client.login(config.botToken);
    } catch (error) {
      if (!messageContentIntentEnabled || !isDisallowedIntentsError(error)) {
        throw error;
      }

      console.warn(
        "Discord login rejected Message Content intent. Retrying without GatewayIntentBits.MessageContent.",
      );
      messageContentIntentEnabled = false;
      syncStatus = {
        ...syncStatus,
        messageContentIntentEnabled: false,
      };
      client.destroy();
      client = new Client({ intents: buildGatewayIntents(false) });
      attachClientEventHandlers(client);
      await client.login(config.botToken);
    }
  };

  attachClientEventHandlers(client);
  await loginClient();

  runtime = {
    enabled: true,
    syncNow: async (options) => {
      if (!isClientReady) {
        return { ok: false, reason: "Discord client is not ready yet." };
      }

      const directResult = await runSyncTracked("manual", {
        requestedBy: "manual",
        executionMode: "direct",
        reset: options?.reset,
      });
      if (!directResult.ok) {
        return { ok: false, reason: directResult.reason };
      }
      return { ok: true };
    },
    resetData: async () => {
      if (syncStatus.inProgress) {
        return { ok: false, reason: "Cannot clear ingested data while a sync is running." };
      }
      try {
        internalGuildId = 0;
        const deleted = await clearDiscordIngestedData();
        syncStatus = {
          ...syncStatus,
          lastSuccessAt: nowMs(),
          lastClassifiedCount: 0,
          lastFailureReason: null,
        };
        return { ok: true, deleted };
      } catch (error) {
        return { ok: false, reason: toReason(error) };
      }
    },
    getStatus: getRuntimeStatus,
  };
  return runtime;
}

export function getDiscordRuntime(): DiscordRuntime {
  return runtime;
}

export const getDiscordRuntimeStatus = async (): Promise<DiscordRuntimeStatus> => {
  return runtime.getStatus();
};

export const updateDiscordSyncCadence = async (minutes: unknown): Promise<number> => {
  const cadenceMinutes = await saveDiscordSyncCadenceMinutes(minutes);
  const pollIntervalMs = cadenceMinutesToMs(cadenceMinutes);

  syncStatus = {
    ...syncStatus,
    pollIntervalMs,
  };

  if (applyRuntimeCadence) {
    await applyRuntimeCadence(pollIntervalMs);
  }

  return cadenceMinutes;
};
