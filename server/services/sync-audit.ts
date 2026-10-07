import { desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "../db/client";
import {
  discordChannels,
  discordGuilds,
  discordMembers,
  discordMessages,
  messageSentiment,
  syncRunLogs,
  syncRuns,
} from "../db/schema";

export type SyncAuditRun = {
  id: string;
  mode: "manual" | "incremental";
  requestedBy: "manual" | "cron" | "startup";
  executionMode: "direct";
  reset: boolean;
  status: "running" | "completed" | "failed";
  startedAt: number;
  finishedAt: number | null;
  durationMs: number | null;
  classifiedCount: number;
  failureReason: string | null;
  logs: Array<{
    timestamp: number;
    message: string;
  }>;
};

export type SyncAuditRunInput = {
  id: string;
  mode: SyncAuditRun["mode"];
  requestedBy: SyncAuditRun["requestedBy"];
  executionMode: SyncAuditRun["executionMode"];
  reset: boolean;
  startedAt: number;
};

export type SyncAuditSummary = {
  totalRuns: number;
  completedRuns: number;
  failedRuns: number;
  runningRuns: number;
  totalClassifiedMessages: number;
  averageDurationMs: number | null;
  totalMessagesStored: number;
  totalMessagesClassified: number;
  totalMessagesPending: number;
  totalMembers: number;
  totalChannels: number;
  monitoredChannels: number;
  totalGuilds: number;
};

export const createSyncAuditRun = async (input: SyncAuditRunInput): Promise<void> => {
  await db.insert(syncRuns).values({
    id: input.id,
    mode: input.mode,
    requestedBy: input.requestedBy,
    executionMode: input.executionMode,
    reset: input.reset,
    status: "running",
    startedAt: new Date(input.startedAt),
  });
};

export const appendSyncAuditLog = async (
  runId: string | undefined,
  message: string,
  timestamp: number,
): Promise<void> => {
  if (!runId) {
    return;
  }

  await db.insert(syncRunLogs).values({
    runId,
    timestamp: new Date(timestamp),
    message,
  });
};

export const finalizeSyncAuditRun = async (
  runId: string | undefined,
  result: { ok: boolean; reason?: string; classifiedCount?: number },
  finishedAt: number,
): Promise<void> => {
  if (!runId) {
    return;
  }

  const existing = await db
    .select({ startedAt: syncRuns.startedAt })
    .from(syncRuns)
    .where(eq(syncRuns.id, runId))
    .get();

  const durationMs = existing ? finishedAt - existing.startedAt.getTime() : null;

  await db
    .update(syncRuns)
    .set({
      status: result.ok ? "completed" : "failed",
      finishedAt: new Date(finishedAt),
      durationMs,
      classifiedCount: result.classifiedCount ?? 0,
      failureReason: result.ok ? null : result.reason ?? "Discord sync failed.",
    })
    .where(eq(syncRuns.id, runId))
    .run();
};

export const listSyncAuditRuns = async (limit = 20): Promise<SyncAuditRun[]> => {
  const runs = await db
    .select()
    .from(syncRuns)
    .orderBy(desc(syncRuns.startedAt))
    .limit(limit)
    .all();

  if (runs.length === 0) {
    return [];
  }

  const logs = await db
    .select()
    .from(syncRunLogs)
    .where(inArray(syncRunLogs.runId, runs.map((run) => run.id)))
    .orderBy(desc(syncRunLogs.timestamp))
    .all();

  const logsByRunId = new Map<string, SyncAuditRun["logs"]>();
  for (const entry of logs) {
    const list = logsByRunId.get(entry.runId) ?? [];
    list.unshift({
      timestamp: entry.timestamp.getTime(),
      message: entry.message,
    });
    logsByRunId.set(entry.runId, list);
  }

  return runs.map((run) => ({
    id: run.id,
    mode: run.mode as SyncAuditRun["mode"],
    requestedBy: run.requestedBy as SyncAuditRun["requestedBy"],
    executionMode: run.executionMode as SyncAuditRun["executionMode"],
    reset: run.reset,
    status: run.status as SyncAuditRun["status"],
    startedAt: run.startedAt.getTime(),
    finishedAt: run.finishedAt?.getTime() ?? null,
    durationMs: run.durationMs ?? null,
    classifiedCount: run.classifiedCount,
    failureReason: run.failureReason,
    logs: logsByRunId.get(run.id) ?? [],
  }));
};

export const getSyncAuditSummary = async (): Promise<SyncAuditSummary> => {
  const [runSummary, messageSummary, memberSummary, channelSummary, guildSummary] = await Promise.all([
    db
      .select({
        totalRuns: sql<number>`count(*)`,
        completedRuns: sql<number>`coalesce(sum(case when ${syncRuns.status} = 'completed' then 1 else 0 end), 0)`,
        failedRuns: sql<number>`coalesce(sum(case when ${syncRuns.status} = 'failed' then 1 else 0 end), 0)`,
        runningRuns: sql<number>`coalesce(sum(case when ${syncRuns.status} = 'running' then 1 else 0 end), 0)`,
        totalClassifiedMessages: sql<number>`coalesce(sum(${syncRuns.classifiedCount}), 0)`,
        averageDurationMs: sql<number | null>`avg(${syncRuns.durationMs})`,
      })
      .from(syncRuns)
      .get(),
    db
      .select({
        totalMessagesStored: sql<number>`count(*)`,
        totalMessagesClassified: sql<number>`coalesce(sum(case when ${messageSentiment.id} is not null then 1 else 0 end), 0)`,
        totalMessagesPending: sql<number>`coalesce(sum(case when ${messageSentiment.id} is null then 1 else 0 end), 0)`,
      })
      .from(discordMessages)
      .leftJoin(messageSentiment, eq(messageSentiment.messageId, discordMessages.id))
      .get(),
    db.select({ totalMembers: sql<number>`count(*)` }).from(discordMembers).get(),
    db
      .select({
        totalChannels: sql<number>`count(*)`,
        monitoredChannels: sql<number>`coalesce(sum(case when ${discordChannels.isMonitored} = 1 then 1 else 0 end), 0)`,
      })
      .from(discordChannels)
      .get(),
    db.select({ totalGuilds: sql<number>`count(*)` }).from(discordGuilds).get(),
  ]);

  return {
    totalRuns: runSummary?.totalRuns ?? 0,
    completedRuns: runSummary?.completedRuns ?? 0,
    failedRuns: runSummary?.failedRuns ?? 0,
    runningRuns: runSummary?.runningRuns ?? 0,
    totalClassifiedMessages: runSummary?.totalClassifiedMessages ?? 0,
    averageDurationMs: runSummary?.averageDurationMs ?? null,
    totalMessagesStored: messageSummary?.totalMessagesStored ?? 0,
    totalMessagesClassified: messageSummary?.totalMessagesClassified ?? 0,
    totalMessagesPending: messageSummary?.totalMessagesPending ?? 0,
    totalMembers: memberSummary?.totalMembers ?? 0,
    totalChannels: channelSummary?.totalChannels ?? 0,
    monitoredChannels: channelSummary?.monitoredChannels ?? 0,
    totalGuilds: guildSummary?.totalGuilds ?? 0,
  };
};
