import { and, desc, eq, gte, isNull, lt, sql } from "drizzle-orm";
import { db } from "../db/client";
import {
  channelDailySnapshots,
  channelHourlySnapshots,
  discordChannels,
  discordGuilds,
  discordMembers,
  discordMessages,
  messageReviewState,
  messageSentiment,
  overviewSnapshots,
} from "../db/schema";
import { getSyncAuditSummary, type SyncAuditSummary } from "./sync-audit";

export type Trend = {
  delta: number;
  pct: number;
};

export type OverviewMetric = {
  value: number;
  trend: Trend;
};

export type OverviewResponse = {
  generatedAt: number;
  range: {
    from: number;
    to: number;
    previousFrom: number;
    previousTo: number;
  };
  metrics: {
    messagesToday: OverviewMetric;
    messagesLast7d: OverviewMetric;
    activeUsersToday: OverviewMetric;
    activeUsersLast7d: OverviewMetric;
    channelsNeedingAttention: OverviewMetric;
    healthScore: OverviewMetric;
  };
  rangeMetrics: {
    activeUsers: OverviewMetric;
    inactiveUsers: OverviewMetric;
    totalTikTokLinks: OverviewMetric;
    uniqueTikTokPosters: OverviewMetric;
    sentimentScore: OverviewMetric;
    negativeMessageRate: OverviewMetric;
    channelsNeedingAttention: OverviewMetric;
    healthScore: OverviewMetric;
  };
  funnel: Array<{
    label: string;
    value: number;
    detail: string;
  }>;
  drilldowns: {
    activeUsers: Array<{
      userId: string;
      displayName: string;
      username: string;
      avatarUrl: string | null;
      messageCount: number;
      lastMessageAt: number;
      topChannelName: string;
    }>;
    inactiveUsers: Array<{
      userId: string;
      displayName: string;
      username: string;
      avatarUrl: string | null;
      historicalMessageCount: number;
      lastMessageAt: number;
    }>;
    creatorsPosting: Array<{
      userId: string;
      displayName: string;
      username: string;
      avatarUrl: string | null;
      videoCount: number;
      lastPostedAt: number;
      links: string[];
    }>;
    flaggedChannels: Array<{
      channelId: string;
      channelName: string;
      negativeRate: number;
      classifiedNegativeRate: number;
      negativeDelta: number;
      messageCount: number;
      pendingCount: number;
      reason: string;
    }>;
    negativeMessages: Array<{
      id: string;
      channelId: string;
      channelName: string;
      author: string;
      content: string;
      rationale: string;
      createdAt: number;
    }>;
  };
  explainers: {
    sentiment: {
      score: number;
      formula: string;
      summary: string;
      positiveMessages: number;
      neutralMessages: number;
      negativeMessages: number;
      classifiedMessages: number;
      provider: string;
      edgeCases: string[];
    };
    health: {
      score: number;
      summary: string;
      drivers: Array<{
        label: string;
        value: number;
        detail: string;
      }>;
    };
  };
  attentionChannels: Array<{
    channelId: string;
    channelName: string;
    negativeRate: number;
    classifiedNegativeRate: number;
    negativeDelta: number;
    messageCount: number;
    pendingCount: number;
    classifiedTotal: number;
  }>;
  ops: {
    monitoredChannels: number;
    guildCount: number;
    lastBackfillAt: number | null;
    allTime: SyncAuditSummary;
    pollIntervalMinutes: number;
    messageContentIntentEnabled: boolean;
    anthropicConfigured: boolean;
    sync: {
      executionMode: "direct" | "disabled";
      inProgress: boolean;
      clientReady: boolean;
      currentMode: "manual" | "incremental" | null;
      currentRequestedBy: "manual" | "cron" | "startup" | null;
      startedAt: number | null;
      lastSuccessAt: number | null;
      lastFailureAt: number | null;
      lastFailureReason: string | null;
      lastDurationMs: number | null;
      overlapSkips: number;
      lastClassifiedCount: number;
    };
    sentimentBacklog: {
      pendingCount: number;
      oldestPendingCreatedAt: number | null;
      lastClassifiedAt: number | null;
      topBacklogChannels: Array<{
        channelId: string;
        channelName: string;
        pendingCount: number;
      }>;
    };
  };
};

export type SentimentChannelsResponse = {
  generatedAt: number;
  window: "24h" | "7d" | "14d";
  totals: {
    positive: number;
    neutral: number;
    negative: number;
    pending: number;
    classified: number;
    total: number;
  };
  trend: Array<{
    bucketStart: number;
    total: number;
    negative: number;
    pending: number;
    negativeRate: number;
  }>;
  availableChannels: Array<{
    channelId: string;
    channelName: string;
  }>;
  channels: Array<{
    channelId: string;
    channelName: string;
    total: number;
    positive: number;
    neutral: number;
    negative: number;
    pending: number;
    classifiedTotal: number;
    negativePct: number;
    classifiedNegativePct: number;
    riskScore: number;
  }>;
  keywordShifts: Array<{
    keyword: string;
    current: number;
    previous: number;
    delta: number;
  }>;
};

export type SentimentMessagesResponse = {
  generatedAt: number;
  summary: {
    pendingCount: number;
    oldestPendingCreatedAt: number | null;
    lastClassifiedAt: number | null;
  };
  items: Array<{
    id: string;
    channelId: string;
    channelName: string;
    author: string;
    label: string;
    content: string;
    rationale: string;
    provider: string;
    keywords: string[];
    confidence: number;
    createdAt: number;
    reactionCount: number;
    reviewStatus: "pending" | "resolved";
    reviewedAt: number | null;
  }>;
  pageInfo: {
    limit: number;
    nextCursor: string | null;
    hasNextPage: boolean;
  };
};

export type SentimentMessageContextResponse = {
  generatedAt: number;
  item: {
    id: string;
    channelId: string;
    channelName: string;
    author: string;
    content: string;
    label: string;
    rationale: string;
    provider: string;
    confidence: number;
    createdAt: number;
    reactionCount: number;
    reviewStatus: "pending" | "resolved";
    reviewedAt: number | null;
  } | null;
  context: Array<{
    id: string;
    author: string;
    content: string;
    createdAt: number;
    label: string;
    reviewStatus: "pending" | "resolved";
  }>;
};

type SentimentMessageSort = "risk" | "newest";

type SentimentMessageCursor = {
  sort: SentimentMessageSort;
  score: number;
  createdAt: number;
  id: number;
};

export type DashboardMessageRow = {
  messageId: number;
  channelId: number;
  discordChannelId: string;
  channelName: string;
  authorId: number;
  author: string | null;
  username: string;
  avatarUrl: string | null;
  content: string;
  createdAt: Date;
  label: string | null;
  confidence: number | null;
  rationale: string | null;
  keywordsJson: string | null;
  provider: string | null;
  classifiedAt: Date | null;
  editedAt: Date | null;
  rawJson: string | null;
  reviewStatus: string | null;
  reviewedAt: Date | null;
};

const SENTIMENT_FORMULA_TEXT =
  "Sentiment score = 50 + ((positive - negative) / classified) * 50, then clamped between 0 and 100. Neutral messages count toward the classified total without moving the numerator, and pending messages are excluded until classification finishes.";

const SENTIMENT_PROVIDER_TEXT =
  "Anthropic Claude Haiku 4.5 classifies stored Discord message text when configured; otherwise messages remain pending and do not affect the score.";

const SENTIMENT_EDGE_CASES = [
  "Empty messages are excluded from classification and dashboard scoring.",
  "Short messages and emoji-only messages still go through the same classifier and can resolve as neutral, positive, or negative based on the returned label.",
  "Discord reactions are not classified because reactions are not stored as standalone message text in this dataset.",
  "Unclassified messages stay pending and are excluded from the sentiment denominator until classification completes.",
];

function windowMs(window: "24h" | "7d" | "14d"): number {
  if (window === "24h") return 24 * 60 * 60 * 1000;
  if (window === "14d") return 14 * 24 * 60 * 60 * 1000;
  return 7 * 24 * 60 * 60 * 1000;
}

function startOfDay(now: number): number {
  const date = new Date(now);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

function startOfHour(now: number): number {
  const date = new Date(now);
  date.setMinutes(0, 0, 0);
  return date.getTime();
}

export function startOfLocalDayFromInput(value: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  const timestamp = new Date(year, month, day, 0, 0, 0, 0).getTime();
  return Number.isFinite(timestamp) ? timestamp : null;
}

export function endOfLocalDayFromInput(value: string): number | null {
  const start = startOfLocalDayFromInput(value);
  return start === null ? null : start + 24 * 60 * 60 * 1000;
}

function trend(current: number, previous: number): Trend {
  if (previous <= 0) {
    return {
      delta: current,
      pct: current > 0 ? 100 : 0,
    };
  }
  return {
    delta: current - previous,
    pct: Math.round((((current - previous) / previous) * 100) * 10) / 10,
  };
}

function ratio(numerator: number, denominator: number): number {
  if (denominator <= 0) return 0;
  return numerator / denominator;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function roundPct(value: number): number {
  return Math.round(value * 1000) / 10;
}

function toTimestamp(value: Date | string | number | null | undefined): number {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }
  if (typeof value === "string") {
    const asNumber = Number(value);
    if (Number.isFinite(asNumber)) return asNumber;

    const asDate = Date.parse(value);
    return Number.isFinite(asDate) ? asDate : 0;
  }
  if (value instanceof Date) return value.getTime();
  return 0;
}

function startOfBucket(value: number, window: "24h" | "7d" | "14d"): number {
  return window === "24h" ? startOfHour(value) : startOfDay(value);
}

function bucketStep(window: "24h" | "7d" | "14d"): number {
  return window === "24h" ? 60 * 60 * 1000 : 24 * 60 * 60 * 1000;
}

function createChannelRiskScore(input: {
  negativePct: number;
  negativeCount: number;
  pendingCount: number;
}): number {
  return Math.round(
    100 *
      (0.5 * (input.negativePct / 100) +
        0.3 * Math.min(input.negativeCount / 50, 1) +
        0.2 * Math.min(input.pendingCount / 50, 1)),
  );
}

function createMessageRiskScore(label: string | null, confidence: number | null): number {
  const safeConfidence = confidence ?? 0;
  if (label === "negative") return 300 + safeConfidence;
  if (label === "pending") return 200;
  if (label === "neutral") return 100 - safeConfidence;
  return safeConfidence;
}

function compareMessageRows(
  sort: SentimentMessageSort,
  a: { label: string | null; confidence: number | null; createdAt: Date | number; messageId: number },
  b: { label: string | null; confidence: number | null; createdAt: Date | number; messageId: number },
): number {
  if (sort === "risk") {
    const scoreDelta =
      createMessageRiskScore(b.label, b.confidence) - createMessageRiskScore(a.label, a.confidence);
    if (scoreDelta !== 0) return scoreDelta;
  }

  const createdAtDelta = toTimestamp(b.createdAt) - toTimestamp(a.createdAt);
  if (createdAtDelta !== 0) return createdAtDelta;
  return b.messageId - a.messageId;
}

function encodeMessageCursor(cursor: SentimentMessageCursor): string {
  return Buffer.from(JSON.stringify(cursor)).toString("base64url");
}

function decodeMessageCursor(value: string | undefined, sort: SentimentMessageSort): SentimentMessageCursor | null {
  if (!value) return null;

  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as Partial<SentimentMessageCursor>;
    if (
      parsed.sort !== sort ||
      typeof parsed.score !== "number" ||
      typeof parsed.createdAt !== "number" ||
      typeof parsed.id !== "number"
    ) {
      return null;
    }
    return {
      sort: parsed.sort,
      score: parsed.score,
      createdAt: parsed.createdAt,
      id: parsed.id,
    };
  } catch {
    return null;
  }
}

function parseKeywords(value: string): string[] {
  try {
    const parsed = JSON.parse(value) as string[];
    return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
  } catch {
    return [];
  }
}

function parseReactionCount(value: string | null | undefined): number {
  if (!value) return 0;
  try {
    const parsed = JSON.parse(value) as { reactions?: unknown };
    return typeof parsed.reactions === "number" ? parsed.reactions : 0;
  } catch {
    return 0;
  }
}

const tiktokPattern = /(?:^|\W)(?:www\.)?(?:vt\.|vm\.)?tiktok\.com\//i;
const tiktokUrlPattern = /(?:https?:\/\/)?(?:www\.)?(?:vt\.|vm\.)?tiktok\.com\/[^\s<>"')]+/gi;

function containsTikTokLink(value: string | null | undefined): boolean {
  return Boolean(value && tiktokPattern.test(value));
}

function extractTikTokLinks(value: string | null | undefined): string[] {
  if (!value) return [];
  return [...value.matchAll(tiktokUrlPattern)].map((match) =>
    match[0].startsWith("http://") || match[0].startsWith("https://")
      ? match[0]
      : `https://${match[0]}`,
  );
}

async function queryMessages(from: number, to: number): Promise<DashboardMessageRow[]> {
  const fromDate = new Date(from);
  const toDate = new Date(to);
  return db
    .select({
      messageId: discordMessages.id,
      channelId: discordChannels.id,
      discordChannelId: discordChannels.discordChannelId,
      channelName: discordChannels.name,
      authorId: discordMembers.id,
      author: discordMembers.displayName,
      username: discordMembers.username,
      avatarUrl: discordMembers.avatarUrl,
      content: discordMessages.content,
      createdAt: discordMessages.createdAt,
      label: messageSentiment.label,
      confidence: messageSentiment.confidence,
      rationale: messageSentiment.rationale,
      keywordsJson: messageSentiment.keywordsJson,
      provider: messageSentiment.provider,
      classifiedAt: messageSentiment.classifiedAt,
      editedAt: discordMessages.editedAt,
      rawJson: discordMessages.rawJson,
      reviewStatus: messageReviewState.status,
      reviewedAt: messageReviewState.reviewedAt,
    })
    .from(discordMessages)
    .innerJoin(discordChannels, eq(discordChannels.id, discordMessages.channelId))
    .innerJoin(discordMembers, eq(discordMembers.id, discordMessages.authorId))
    .leftJoin(messageSentiment, eq(messageSentiment.messageId, discordMessages.id))
    .leftJoin(messageReviewState, eq(messageReviewState.messageId, discordMessages.id))
    .where(
      and(
        gte(discordMessages.createdAt, fromDate),
        lt(discordMessages.createdAt, toDate),
        isNull(discordMessages.deletedAt),
        sql`length(trim(${discordMessages.content})) > 0`, // Exclude empty ingested messages from dashboard sentiment views.
      ),
    )
    .all();
}

export async function getDashboardMessagesData(
  from: number,
  to: number,
): Promise<DashboardMessageRow[]> {
  return queryMessages(from, to);
}

function summarizeLabels(
  messages: Array<{ label: string | null }>,
): { positive: number; neutral: number; negative: number; pending: number; classified: number; total: number } {
  const summary = { positive: 0, neutral: 0, negative: 0, pending: 0, classified: 0, total: messages.length };
  for (const item of messages) {
    if (item.label === "positive") summary.positive += 1;
    else if (item.label === "negative") summary.negative += 1;
    else if (item.label === "neutral") summary.neutral += 1;
    else summary.pending += 1;
  }
  summary.classified = summary.positive + summary.neutral + summary.negative;
  return summary;
}

const matchesChannelFilter = (
  item: { channelId: number; discordChannelId: string },
  requestedChannelId?: string,
): boolean => {
  if (!requestedChannelId) {
    return true;
  }

  return item.discordChannelId === requestedChannelId || String(item.channelId) === requestedChannelId;
};

const logSentimentFilter = (
  scope: "channels" | "messages",
  details: Record<string, string | number | boolean | null | undefined>,
) => {
  console.info(`[sentiment.filter.${scope}]`, details);
};

export async function getOverviewOpsData(): Promise<{
  monitoredChannels: number;
  guildCount: number;
  lastBackfillAt: number | null;
  allTime: SyncAuditSummary;
}> {
  const [channelSummary, guildRows, allTime] = await Promise.all([
    db
      .select({
        monitoredChannels: sql<number>`coalesce(sum(case when ${discordChannels.isMonitored} = 1 then 1 else 0 end), 0)`,
      })
      .from(discordChannels)
      .get(),
    db
      .select({
        guildCount: sql<number>`count(*)`,
        lastBackfillAt: sql<number | null>`max(${discordGuilds.lastBackfillAt})`,
      })
      .from(discordGuilds)
      .get(),
    getSyncAuditSummary(),
  ]);

  return {
    monitoredChannels: channelSummary?.monitoredChannels ?? 0,
    guildCount: guildRows?.guildCount ?? 0,
    lastBackfillAt: guildRows?.lastBackfillAt ?? null,
    allTime,
  };
}

export async function getOverviewData(input?: {
  from?: number;
  to?: number;
}): Promise<OverviewResponse> {
  const now = Date.now();
  const dayStart = startOfDay(now);
  const yesterdayStart = dayStart - 24 * 60 * 60 * 1000;
  const weekStart = now - 7 * 24 * 60 * 60 * 1000;
  const previousWeekStart = now - 14 * 24 * 60 * 60 * 1000;
  const requestedTo =
    typeof input?.to === "number" && Number.isFinite(input.to)
      ? Math.min(input.to, now)
      : now;
  const requestedFrom =
    typeof input?.from === "number" && Number.isFinite(input.from)
      ? Math.min(input.from, requestedTo)
      : weekStart;
  const normalizedFrom = Math.max(0, requestedFrom);
  const normalizedTo = Math.max(normalizedFrom + 1, requestedTo);
  const rangeDuration = Math.max(normalizedTo - normalizedFrom, 1);
  const previousRangeFrom = Math.max(0, normalizedFrom - rangeDuration);
  const previousRangeTo = normalizedFrom;

  const [
    todayMessages,
    yesterdayMessages,
    weekMessages,
    previousWeekMessages,
    rangeMessages,
    previousRangeMessages,
    historicalUserRows,
    previousHistoricalUserRows,
  ] = await Promise.all([
    queryMessages(dayStart, now),
    queryMessages(yesterdayStart, dayStart),
    queryMessages(weekStart, now),
    queryMessages(previousWeekStart, weekStart),
    queryMessages(normalizedFrom, normalizedTo),
    queryMessages(previousRangeFrom, previousRangeTo),
    db
      .select({
        userId: discordMembers.id,
        displayName: discordMembers.displayName,
        username: discordMembers.username,
        avatarUrl: discordMembers.avatarUrl,
        lastMessageAt: sql<Date>`max(${discordMessages.createdAt})`,
        historicalMessageCount: sql<number>`count(*)`,
      })
      .from(discordMessages)
      .innerJoin(discordMembers, eq(discordMembers.id, discordMessages.authorId))
      .where(
        and(
          lt(discordMessages.createdAt, new Date(normalizedFrom)),
          isNull(discordMessages.deletedAt),
          sql`length(trim(${discordMessages.content})) > 0`,
          eq(discordMembers.isBot, false),
        ),
      )
      .groupBy(
        discordMembers.id,
        discordMembers.displayName,
        discordMembers.username,
        discordMembers.avatarUrl,
      )
      .all(),
    db
      .select({
        userId: discordMembers.id,
        lastMessageAt: sql<Date>`max(${discordMessages.createdAt})`,
      })
      .from(discordMessages)
      .innerJoin(discordMembers, eq(discordMembers.id, discordMessages.authorId))
      .where(
        and(
          lt(discordMessages.createdAt, new Date(previousRangeFrom)),
          isNull(discordMessages.deletedAt),
          sql`length(trim(${discordMessages.content})) > 0`,
          eq(discordMembers.isBot, false),
        ),
      )
      .groupBy(discordMembers.id)
      .all(),
  ]);

  const activeUsersToday = new Set(todayMessages.map((item) => item.authorId)).size;
  const activeUsersYesterday = new Set(yesterdayMessages.map((item) => item.authorId)).size;
  const activeUsersWeek = new Set(weekMessages.map((item) => item.authorId)).size;
  const activeUsersPreviousWeek = new Set(previousWeekMessages.map((item) => item.authorId)).size;
  const activeUsersInRange = new Set(rangeMessages.map((item) => item.authorId)).size;
  const activeUsersPreviousRange = new Set(previousRangeMessages.map((item) => item.authorId)).size;
  const activeAuthorIds = new Set(rangeMessages.map((item) => item.authorId));
  const previousActiveAuthorIds = new Set(previousRangeMessages.map((item) => item.authorId));
  const inactiveUsers = historicalUserRows.filter((item) => !activeAuthorIds.has(item.userId));
  const previousInactiveUsers = previousHistoricalUserRows.filter(
    (item) => !previousActiveAuthorIds.has(item.userId),
  );

  const currentChannelStats = new Map<string, {
    channelId: string;
    channelName: string;
    total: number;
    negative: number;
    classifiedTotal: number;
    pendingCount: number;
  }>();
  const previousChannelStats = new Map<string, {
    total: number;
    negative: number;
    classifiedTotal: number;
  }>();
  const rangeChannelStats = new Map<string, {
    channelId: string;
    channelName: string;
    total: number;
    negative: number;
    classifiedTotal: number;
    pendingCount: number;
  }>();
  const previousRangeChannelStats = new Map<string, {
    total: number;
    negative: number;
    classifiedTotal: number;
  }>();

  for (const item of todayMessages) {
    const key = item.discordChannelId;
    const existing = currentChannelStats.get(key) ?? {
      channelId: key,
      channelName: item.channelName,
      total: 0,
      negative: 0,
      classifiedTotal: 0,
      pendingCount: 0,
    };
    existing.total += 1;
    if (item.label === "negative") {
      existing.negative += 1;
      existing.classifiedTotal += 1;
    } else if (item.label === "positive" || item.label === "neutral") {
      existing.classifiedTotal += 1;
    } else {
      existing.pendingCount += 1;
    }
    currentChannelStats.set(key, existing);
  }

  for (const item of yesterdayMessages) {
    const key = item.discordChannelId;
    const existing = previousChannelStats.get(key) ?? { total: 0, negative: 0, classifiedTotal: 0 };
    existing.total += 1;
    if (item.label === "negative") {
      existing.negative += 1;
      existing.classifiedTotal += 1;
    } else if (item.label === "positive" || item.label === "neutral") {
      existing.classifiedTotal += 1;
    }
    previousChannelStats.set(key, existing);
  }

  for (const item of rangeMessages) {
    const key = item.discordChannelId;
    const existing = rangeChannelStats.get(key) ?? {
      channelId: key,
      channelName: item.channelName,
      total: 0,
      negative: 0,
      classifiedTotal: 0,
      pendingCount: 0,
    };
    existing.total += 1;
    if (item.label === "negative") {
      existing.negative += 1;
      existing.classifiedTotal += 1;
    } else if (item.label === "positive" || item.label === "neutral") {
      existing.classifiedTotal += 1;
    } else {
      existing.pendingCount += 1;
    }
    rangeChannelStats.set(key, existing);
  }

  for (const item of previousRangeMessages) {
    const key = item.discordChannelId;
    const existing = previousRangeChannelStats.get(key) ?? {
      total: 0,
      negative: 0,
      classifiedTotal: 0,
    };
    existing.total += 1;
    if (item.label === "negative") {
      existing.negative += 1;
      existing.classifiedTotal += 1;
    } else if (item.label === "positive" || item.label === "neutral") {
      existing.classifiedTotal += 1;
    }
    previousRangeChannelStats.set(key, existing);
  }

  const defaultAttentionChannels = Array.from(currentChannelStats.values())
    .map((item) => {
      const previous = previousChannelStats.get(item.channelId);
      const negativeRate = ratio(item.negative, item.total);
      const previousRate = ratio(previous?.negative ?? 0, previous?.total ?? 0);
      const classifiedNegativeRate = ratio(item.negative, item.classifiedTotal);
      return {
        channelId: item.channelId,
        channelName: item.channelName,
        negativeRate: roundPct(negativeRate),
        classifiedNegativeRate: roundPct(classifiedNegativeRate),
        negativeDelta: roundPct(negativeRate - previousRate),
        messageCount: item.total,
        pendingCount: item.pendingCount,
        classifiedTotal: item.classifiedTotal,
      };
    })
    .sort((a, b) => {
      if (b.negativeRate !== a.negativeRate) return b.negativeRate - a.negativeRate;
      return b.negativeDelta - a.negativeDelta;
    })
    .slice(0, 5);

  const attentionChannels = Array.from(rangeChannelStats.values())
    .map((item) => {
      const previous = previousRangeChannelStats.get(item.channelId);
      const negativeRate = ratio(item.negative, item.total);
      const previousRate = ratio(previous?.negative ?? 0, previous?.total ?? 0);
      const classifiedNegativeRate = ratio(item.negative, item.classifiedTotal);
      return {
        channelId: item.channelId,
        channelName: item.channelName,
        negativeRate: roundPct(negativeRate),
        classifiedNegativeRate: roundPct(classifiedNegativeRate),
        negativeDelta: roundPct(negativeRate - previousRate),
        messageCount: item.total,
        pendingCount: item.pendingCount,
        classifiedTotal: item.classifiedTotal,
      };
    })
    .sort((a, b) => {
      if (b.negativeRate !== a.negativeRate) return b.negativeRate - a.negativeRate;
      return b.negativeDelta - a.negativeDelta;
    })
    .slice(0, 5);

  const weekSummary = summarizeLabels(weekMessages);
  const previousWeekSummary = summarizeLabels(previousWeekMessages);
  const rangeSummary = summarizeLabels(rangeMessages);
  const previousRangeSummary = summarizeLabels(previousRangeMessages);
  const currentNegativeRate = ratio(weekSummary.negative, weekSummary.classified);
  const previousNegativeRate = ratio(previousWeekSummary.negative, previousWeekSummary.classified);
  const rangeNegativeRate = ratio(rangeSummary.negative, rangeSummary.classified);
  const previousRangeNegativeRate = ratio(previousRangeSummary.negative, previousRangeSummary.classified);
  const channelsWithRisk = defaultAttentionChannels.filter((item) => item.negativeRate >= 20 || item.negativeDelta > 10).length;
  const previousRiskChannels = Array.from(previousChannelStats.values())
    .filter((item) => ratio(item.negative, item.total) >= 0.2)
    .length;
  const rangeChannelsWithRisk = Array.from(rangeChannelStats.values())
    .filter((item) => {
      const previous = previousRangeChannelStats.get(item.channelId);
      const currentRate = ratio(item.negative, item.total);
      const previousRate = ratio(previous?.negative ?? 0, previous?.total ?? 0);
      return currentRate >= 0.2 || currentRate - previousRate > 0.1;
    })
    .length;
  const previousRangeRiskChannels = Array.from(previousRangeChannelStats.values())
    .filter((item) => ratio(item.negative, item.total) >= 0.2)
    .length;

  const activeTrend = trend(activeUsersWeek, activeUsersPreviousWeek).pct;
  const messageTrend = trend(weekMessages.length, previousWeekMessages.length).pct;
  const sentimentScore = clamp((1 - currentNegativeRate) * 100, 0, 100);
  const riskScore = clamp(100 - channelsWithRisk * 20, 0, 100);
  const healthScore = Math.round(
    clamp(activeTrend + 100, 0, 200) * 0.175 +
      clamp(messageTrend + 100, 0, 200) * 0.125 +
      sentimentScore * 0.25 +
      riskScore * 0.15,
  );
  const previousHealthScore = Math.round(
    clamp(trend(activeUsersPreviousWeek, activeUsersPreviousWeek).pct + 100, 0, 200) * 0.175 +
      clamp(trend(previousWeekMessages.length, previousWeekMessages.length).pct + 100, 0, 200) * 0.125 +
      clamp((1 - previousNegativeRate) * 100, 0, 100) * 0.25 +
      clamp(100 - previousRiskChannels * 20, 0, 100) * 0.15,
  );
  const rangeActiveTrend = trend(activeUsersInRange, activeUsersPreviousRange).pct;
  const rangeMessageTrend = trend(rangeMessages.length, previousRangeMessages.length).pct;
  const rangeSentimentScore = clamp((1 - rangeNegativeRate) * 100, 0, 100);
  const rangeRiskScore = clamp(100 - rangeChannelsWithRisk * 20, 0, 100);
  const rangeHealthScore = Math.round(
    clamp(rangeActiveTrend + 100, 0, 200) * 0.175 +
      clamp(rangeMessageTrend + 100, 0, 200) * 0.125 +
      rangeSentimentScore * 0.25 +
      rangeRiskScore * 0.15,
  );
  const previousRangeHealthScore = Math.round(
    clamp(trend(activeUsersPreviousRange, activeUsersPreviousRange).pct + 100, 0, 200) * 0.175 +
      clamp(trend(previousRangeMessages.length, previousRangeMessages.length).pct + 100, 0, 200) * 0.125 +
      clamp((1 - previousRangeNegativeRate) * 100, 0, 100) * 0.25 +
      clamp(100 - previousRangeRiskChannels * 20, 0, 100) * 0.15,
  );
  const totalTikTokLinks = rangeMessages.filter((item) => containsTikTokLink(item.content)).length;
  const previousTotalTikTokLinks = previousRangeMessages.filter((item) => containsTikTokLink(item.content)).length;
  const uniqueTikTokPosters = new Set(
    rangeMessages
      .filter((item) => containsTikTokLink(item.content))
      .map((item) => item.authorId),
  ).size;
  const previousUniqueTikTokPosters = new Set(
    previousRangeMessages
      .filter((item) => containsTikTokLink(item.content))
      .map((item) => item.authorId),
  ).size;
  const rangeSentimentMeter = clamp(
    50 + (((rangeSummary.positive - rangeSummary.negative) / Math.max(rangeSummary.classified, 1)) * 50),
    0,
    100,
  );
  const previousRangeSentimentMeter = clamp(
    50 +
      (((previousRangeSummary.positive - previousRangeSummary.negative) /
        Math.max(previousRangeSummary.classified, 1)) *
        50),
    0,
    100,
  );
  const rangeNegativeMessageRate = ratio(rangeSummary.negative, rangeSummary.total) * 100;
  const previousRangeNegativeMessageRate = ratio(previousRangeSummary.negative, previousRangeSummary.total) * 100;
  const activeUserSummaries = Array.from(
    rangeMessages.reduce(
      (acc, item) => {
        const existing = acc.get(item.authorId) ?? {
          userId: String(item.authorId),
          displayName: item.author || item.username,
          username: item.username,
          avatarUrl: item.avatarUrl ?? null,
          messageCount: 0,
          lastMessageAt: 0,
          topChannelName: item.channelName,
          topChannelCount: 0,
          channels: new Map<string, number>(),
        };
        existing.messageCount += 1;
        existing.lastMessageAt = Math.max(existing.lastMessageAt, toTimestamp(item.createdAt));
        const nextChannelCount = (existing.channels.get(item.channelName) ?? 0) + 1;
        existing.channels.set(item.channelName, nextChannelCount);
        if (nextChannelCount >= existing.topChannelCount) {
          existing.topChannelCount = nextChannelCount;
          existing.topChannelName = item.channelName;
        }
        acc.set(item.authorId, existing);
        return acc;
      },
      new Map<number, {
        userId: string;
        displayName: string;
        username: string;
        avatarUrl: string | null;
        messageCount: number;
        lastMessageAt: number;
        topChannelName: string;
        topChannelCount: number;
        channels: Map<string, number>;
      }>(),
    ).values(),
  )
    .map(({ channels: _channels, topChannelCount: _topChannelCount, ...item }) => item)
    .sort((a, b) => b.messageCount - a.messageCount || b.lastMessageAt - a.lastMessageAt)
    .slice(0, 100);
  const inactiveUserSummaries = inactiveUsers
    .map((item) => ({
      userId: String(item.userId),
      displayName: item.displayName?.trim() || item.username,
      username: item.username,
      avatarUrl: item.avatarUrl ?? null,
      historicalMessageCount: item.historicalMessageCount,
      lastMessageAt: toTimestamp(item.lastMessageAt),
    }))
    .sort((a, b) => b.lastMessageAt - a.lastMessageAt)
    .slice(0, 100);
  const creatorPostingSummaries = Array.from(
    [...rangeMessages]
      .sort((a, b) => toTimestamp(b.createdAt) - toTimestamp(a.createdAt))
      .reduce((acc, item) => {
        if (!containsTikTokLink(item.content)) return acc;
        const existing = acc.get(item.authorId) ?? {
          userId: String(item.authorId),
          displayName: item.author || item.username,
          username: item.username,
          avatarUrl: item.avatarUrl ?? null,
          videoCount: 0,
          lastPostedAt: 0,
          links: [] as string[],
          seenLinks: new Set<string>(),
        };
        existing.videoCount += 1;
        existing.lastPostedAt = Math.max(existing.lastPostedAt, toTimestamp(item.createdAt));
        for (const link of extractTikTokLinks(item.content)) {
          if (existing.seenLinks.has(link)) continue;
          existing.seenLinks.add(link);
          existing.links.push(link);
        }
        acc.set(item.authorId, existing);
        return acc;
      }, new Map<number, {
        userId: string;
        displayName: string;
        username: string;
        avatarUrl: string | null;
        videoCount: number;
        lastPostedAt: number;
        links: string[];
        seenLinks: Set<string>;
      }>()).values(),
  )
    .map(({ seenLinks: _seenLinks, ...item }) => item)
    .sort((a, b) => b.videoCount - a.videoCount || b.lastPostedAt - a.lastPostedAt)
    .slice(0, 100);
  const negativeMessages = rangeMessages
    .filter((item) => item.label === "negative")
    .map((item) => ({
      id: String(item.messageId),
      channelId: item.discordChannelId,
      channelName: item.channelName,
      author: item.author || item.username,
      content: item.content,
      rationale: item.rationale ?? "Marked negative by the current classifier.",
      createdAt: toTimestamp(item.createdAt),
    }))
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, 100);
  const flaggedChannelDrilldowns = attentionChannels.map((item) => ({
    channelId: item.channelId,
    channelName: item.channelName,
    negativeRate: item.negativeRate,
    classifiedNegativeRate: item.classifiedNegativeRate,
    negativeDelta: item.negativeDelta,
    messageCount: item.messageCount,
    pendingCount: item.pendingCount,
    reason:
      item.pendingCount > 0
        ? `${item.negativeRate.toFixed(1)}% of total messages are negative, ${item.pendingCount.toLocaleString()} still need classification, and the rate moved ${item.negativeDelta >= 0 ? "+" : ""}${item.negativeDelta.toFixed(1)} pts versus the prior range.`
        : `${item.negativeRate.toFixed(1)}% of total messages are negative and the rate moved ${item.negativeDelta >= 0 ? "+" : ""}${item.negativeDelta.toFixed(1)} pts versus the prior range.`,
  }));

  return {
    generatedAt: now,
    range: {
      from: normalizedFrom,
      to: normalizedTo,
      previousFrom: previousRangeFrom,
      previousTo: previousRangeTo,
    },
    metrics: {
      messagesToday: { value: todayMessages.length, trend: trend(todayMessages.length, yesterdayMessages.length) },
      messagesLast7d: { value: weekMessages.length, trend: trend(weekMessages.length, previousWeekMessages.length) },
      activeUsersToday: { value: activeUsersToday, trend: trend(activeUsersToday, activeUsersYesterday) },
      activeUsersLast7d: { value: activeUsersWeek, trend: trend(activeUsersWeek, activeUsersPreviousWeek) },
      channelsNeedingAttention: { value: channelsWithRisk, trend: trend(channelsWithRisk, previousRiskChannels) },
      healthScore: { value: healthScore, trend: trend(healthScore, previousHealthScore) },
    },
    rangeMetrics: {
      activeUsers: { value: activeUsersInRange, trend: trend(activeUsersInRange, activeUsersPreviousRange) },
      inactiveUsers: { value: inactiveUsers.length, trend: trend(inactiveUsers.length, previousInactiveUsers.length) },
      totalTikTokLinks: { value: totalTikTokLinks, trend: trend(totalTikTokLinks, previousTotalTikTokLinks) },
      uniqueTikTokPosters: { value: uniqueTikTokPosters, trend: trend(uniqueTikTokPosters, previousUniqueTikTokPosters) },
      sentimentScore: { value: Math.round(rangeSentimentMeter), trend: trend(Math.round(rangeSentimentMeter), Math.round(previousRangeSentimentMeter)) },
      negativeMessageRate: { value: Math.round(rangeNegativeMessageRate), trend: trend(Math.round(rangeNegativeMessageRate), Math.round(previousRangeNegativeMessageRate)) },
      channelsNeedingAttention: { value: rangeChannelsWithRisk, trend: trend(rangeChannelsWithRisk, previousRangeRiskChannels) },
      healthScore: { value: rangeHealthScore, trend: trend(rangeHealthScore, previousRangeHealthScore) },
    },
    funnel: [
      {
        label: "Active users",
        value: activeUsersInRange,
        detail: `${rangeMessages.length.toLocaleString()} messages across the selected range.`,
      },
      {
        label: "Inactive users",
        value: inactiveUsers.length,
        detail: "Known members with prior activity but no posts in this range.",
      },
      {
        label: "Channels flagged",
        value: rangeChannelsWithRisk,
        detail: "Channels crossing the negative-rate or change threshold.",
      },
      {
        label: "Negative message rate",
        value: Math.round(rangeNegativeMessageRate),
        detail: `${rangeSummary.negative.toLocaleString()} of ${rangeSummary.total.toLocaleString()} messages are negative.`,
      },
    ],
    drilldowns: {
      activeUsers: activeUserSummaries,
      inactiveUsers: inactiveUserSummaries,
      creatorsPosting: creatorPostingSummaries,
      flaggedChannels: flaggedChannelDrilldowns,
      negativeMessages,
    },
    explainers: {
      sentiment: {
        score: Math.round(rangeSentimentMeter),
        formula: SENTIMENT_FORMULA_TEXT,
        summary: `${rangeSummary.positive.toLocaleString()} positive, ${rangeSummary.neutral.toLocaleString()} neutral, and ${rangeSummary.negative.toLocaleString()} negative classified messages drive the score. Pending messages do not change the score until classification finishes.`,
        positiveMessages: rangeSummary.positive,
        neutralMessages: rangeSummary.neutral,
        negativeMessages: rangeSummary.negative,
        classifiedMessages: rangeSummary.classified,
        provider: SENTIMENT_PROVIDER_TEXT,
        edgeCases: SENTIMENT_EDGE_CASES,
      },
      health: {
        score: rangeHealthScore,
        summary: "Health blends participation trend, posting trend, sentiment balance, and flagged-channel pressure for the selected range.",
        drivers: [
          {
            label: "Activity trend",
            value: Math.round(clamp(rangeActiveTrend + 100, 0, 200)),
            detail: `${rangeActiveTrend >= 0 ? "+" : ""}${rangeActiveTrend.toFixed(1)}% versus the previous matching range.`,
          },
          {
            label: "Message trend",
            value: Math.round(clamp(rangeMessageTrend + 100, 0, 200)),
            detail: `${rangeMessageTrend >= 0 ? "+" : ""}${rangeMessageTrend.toFixed(1)}% versus the previous matching range.`,
          },
          {
            label: "Sentiment score",
            value: Math.round(rangeSentimentScore),
            detail: `${rangeSummary.negative.toLocaleString()} negative messages across ${rangeSummary.classified.toLocaleString()} classified items.`,
          },
          {
            label: "Flagged channels",
            value: Math.round(rangeRiskScore),
            detail: `${rangeChannelsWithRisk.toLocaleString()} channel${rangeChannelsWithRisk === 1 ? "" : "s"} crossed the alert threshold.`,
          },
        ],
      },
    },
    attentionChannels,
    ops: {
      monitoredChannels: 0,
      guildCount: 0,
      lastBackfillAt: null,
      allTime: {
        totalRuns: 0,
        completedRuns: 0,
        failedRuns: 0,
        runningRuns: 0,
        totalClassifiedMessages: 0,
        averageDurationMs: null,
        totalMessagesStored: 0,
        totalMessagesClassified: 0,
        totalMessagesPending: 0,
        totalMembers: 0,
        totalChannels: 0,
        monitoredChannels: 0,
        totalGuilds: 0,
      },
      pollIntervalMinutes: 10,
      messageContentIntentEnabled: false,
      anthropicConfigured: false,
      sync: {
        executionMode: "disabled",
        inProgress: false,
        clientReady: false,
        currentMode: null,
        currentRequestedBy: null,
        startedAt: null,
        lastSuccessAt: null,
        lastFailureAt: null,
        lastFailureReason: null,
        lastDurationMs: null,
        overlapSkips: 0,
        lastClassifiedCount: 0,
      },
      sentimentBacklog: {
        pendingCount: 0,
        oldestPendingCreatedAt: null,
        lastClassifiedAt: null,
        topBacklogChannels: [],
      },
    },
  };
}

export async function getSentimentChannelsData(
  window: "24h" | "7d" | "14d",
  input?: { channelId?: string },
): Promise<SentimentChannelsResponse> {
  const now = Date.now();
  const ms = windowMs(window);
  const from = now - ms;
  const previousFrom = from - ms;
  const [currentMessages, previousMessages] = await Promise.all([
    queryMessages(from, now),
    queryMessages(previousFrom, from),
  ]);

  const channels = new Map<string, {
    channelId: string;
    channelName: string;
    total: number;
    positive: number;
    neutral: number;
    negative: number;
    pending: number;
    classifiedTotal: number;
  }>();
  const currentKeywords = new Map<string, number>();
  const previousKeywords = new Map<string, number>();
  const currentDiscordChannelMatches = input?.channelId
    ? currentMessages.filter((item) => item.discordChannelId === input.channelId).length
    : currentMessages.length;
  const currentInternalChannelMatches = input?.channelId
    ? currentMessages.filter((item) => String(item.channelId) === input.channelId).length
    : currentMessages.length;

  const filteredCurrentMessages = currentMessages.filter((item) => matchesChannelFilter(item, input?.channelId));
  const filteredPreviousMessages = previousMessages.filter((item) => matchesChannelFilter(item, input?.channelId));
  const availableChannels = Array.from(
    currentMessages.reduce((acc, item) => {
      if (!acc.has(item.discordChannelId)) {
        acc.set(item.discordChannelId, {
          channelId: item.discordChannelId,
          channelName: item.channelName,
        });
      }
      return acc;
    }, new Map<string, { channelId: string; channelName: string }>()),
  )
    .map(([, item]) => item)
    .sort((a, b) => a.channelName.localeCompare(b.channelName));

  logSentimentFilter("channels", {
    window,
    requestedChannelId: input?.channelId ?? null,
    currentTotal: currentMessages.length,
    previousTotal: previousMessages.length,
    currentDiscordChannelMatches,
    currentInternalChannelMatches,
    filteredCurrentCount: filteredCurrentMessages.length,
    filteredPreviousCount: filteredPreviousMessages.length,
    availableChannelCount: availableChannels.length,
    availableChannelSample: availableChannels
      .slice(0, 5)
      .map((channel) => `${channel.channelName}:${channel.channelId}`)
      .join(" | "),
  });

  for (const item of filteredCurrentMessages) {
    const summary = channels.get(item.discordChannelId) ?? {
      channelId: item.discordChannelId,
      channelName: item.channelName,
      total: 0,
      positive: 0,
      neutral: 0,
      negative: 0,
      pending: 0,
      classifiedTotal: 0,
    };
    summary.total += 1;
    if (item.label === "positive") {
      summary.positive += 1;
      summary.classifiedTotal += 1;
    } else if (item.label === "negative") {
      summary.negative += 1;
      summary.classifiedTotal += 1;
    } else if (item.label === "neutral") {
      summary.neutral += 1;
      summary.classifiedTotal += 1;
    } else {
      summary.pending += 1;
    }
    channels.set(item.discordChannelId, summary);
    for (const keyword of parseKeywords(item.keywordsJson ?? "[]")) {
      currentKeywords.set(keyword, (currentKeywords.get(keyword) ?? 0) + 1);
    }
  }

  for (const item of filteredPreviousMessages) {
    for (const keyword of parseKeywords(item.keywordsJson ?? "[]")) {
      previousKeywords.set(keyword, (previousKeywords.get(keyword) ?? 0) + 1);
    }
  }

  const totals = summarizeLabels(filteredCurrentMessages);
  const keywordUniverse = new Set([
    ...currentKeywords.keys(),
    ...previousKeywords.keys(),
  ]);
  const trendStart = startOfBucket(from, window);
  const trendStep = bucketStep(window);
  const trendBuckets = new Map<number, {
    total: number;
    negative: number;
    pending: number;
    classified: number;
  }>();

  for (let bucket = trendStart; bucket <= now; bucket += trendStep) {
    trendBuckets.set(bucket, {
      total: 0,
      negative: 0,
      pending: 0,
      classified: 0,
    });
  }

  for (const item of filteredCurrentMessages) {
    const bucketStart = startOfBucket(toTimestamp(item.createdAt), window);
    const bucket = trendBuckets.get(bucketStart);
    if (!bucket) continue;

    bucket.total += 1;
    if (item.label === "negative") {
      bucket.negative += 1;
      bucket.classified += 1;
    } else if (item.label === "positive" || item.label === "neutral") {
      bucket.classified += 1;
    } else {
      bucket.pending += 1;
    }
  }

  const keywordShifts = Array.from(keywordUniverse)
    .map((keyword) => {
      const current = currentKeywords.get(keyword) ?? 0;
      const previous = previousKeywords.get(keyword) ?? 0;
      return {
        keyword,
        current,
        previous,
        delta: current - previous,
      };
    })
    .filter((item) => item.current > 0 || item.previous > 0)
    .sort((a, b) => {
      if (b.delta !== a.delta) return b.delta - a.delta;
      return b.current - a.current;
    })
    .slice(0, 12);

  return {
    generatedAt: now,
    window,
    totals,
    trend: Array.from(trendBuckets.entries()).map(([bucketStart, bucket]) => ({
      bucketStart,
      total: bucket.total,
      negative: bucket.negative,
      pending: bucket.pending,
      negativeRate: roundPct(ratio(bucket.negative, bucket.total)),
    })),
    availableChannels,
    channels: Array.from(channels.values())
      .map((item) => {
        const negativePct = roundPct(ratio(item.negative, item.total));
        const classifiedNegativePct = roundPct(ratio(item.negative, item.classifiedTotal));
        return {
          ...item,
          negativePct,
          classifiedNegativePct,
          riskScore: createChannelRiskScore({
            negativePct,
            negativeCount: item.negative,
            pendingCount: item.pending,
          }),
        };
      })
      .sort((a, b) => {
        if (b.riskScore !== a.riskScore) return b.riskScore - a.riskScore;
        if (b.negativePct !== a.negativePct) return b.negativePct - a.negativePct;
        return b.total - a.total;
      }),
    keywordShifts,
  };
}

export async function getSentimentMessagesData(input: {
  window: "24h" | "7d" | "14d";
  channelId?: string;
  label?: "positive" | "neutral" | "negative" | "pending" | "all";
  q?: string;
  sort?: SentimentMessageSort;
  limit?: number;
  cursor?: string;
  summary?: {
    pendingCount: number;
    oldestPendingCreatedAt: number | null;
    lastClassifiedAt: number | null;
  };
}): Promise<SentimentMessagesResponse> {
  const now = Date.now();
  const from = now - windowMs(input.window);
  const rows = await queryMessages(from, now);
  const normalizedQuery = input.q?.trim().toLowerCase() ?? "";
  const normalizedSort = input.sort ?? "newest";
  const limit = clamp(input.limit ?? 50, 1, 100);
  const cursor = decodeMessageCursor(input.cursor, normalizedSort);
  const discordChannelMatches = input.channelId
    ? rows.filter((item) => item.discordChannelId === input.channelId).length
    : rows.length;
  const internalChannelMatches = input.channelId
    ? rows.filter((item) => String(item.channelId) === input.channelId).length
    : rows.length;

  const filtered = rows
    .filter((item) => {
      if (!matchesChannelFilter(item, input.channelId)) return false;

      const effectiveLabel = item.label ?? "pending";
      if (input.label && input.label !== "all" && effectiveLabel !== input.label) return false;

      if (!normalizedQuery) return true;

      const haystack = [
        item.content,
        item.channelName,
        item.author ?? item.username,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(normalizedQuery);
    })
    .sort((a, b) => compareMessageRows(normalizedSort, a, b));

  logSentimentFilter("messages", {
    window: input.window,
    requestedChannelId: input.channelId ?? null,
    label: input.label ?? "all",
    q: input.q ?? null,
    sort: normalizedSort,
    totalRows: rows.length,
    discordChannelMatches,
    internalChannelMatches,
    filteredCount: filtered.length,
    filteredChannelSample: filtered
      .slice(0, 5)
      .map((item) => `${item.channelName}:${item.discordChannelId}/${item.channelId}`)
      .join(" | "),
  });

  const startIndex = cursor
    ? filtered.findIndex((item) => {
        return (
          createMessageRiskScore(item.label ?? "pending", item.confidence) === cursor.score &&
          toTimestamp(item.createdAt) === cursor.createdAt &&
          item.messageId === cursor.id
        );
      }) + 1
    : 0;
  const safeStartIndex = startIndex > 0 ? startIndex : 0;
  const paged = filtered.slice(safeStartIndex, safeStartIndex + limit + 1);
  const hasNextPage = paged.length > limit;
  const visibleItems = hasNextPage ? paged.slice(0, limit) : paged;
  const nextCursor = hasNextPage
    ? encodeMessageCursor({
        sort: normalizedSort,
        score: createMessageRiskScore(
          visibleItems[visibleItems.length - 1]!.label ?? "pending",
          visibleItems[visibleItems.length - 1]!.confidence,
        ),
        createdAt: toTimestamp(visibleItems[visibleItems.length - 1]!.createdAt),
        id: visibleItems[visibleItems.length - 1]!.messageId,
      })
    : null;

  return {
    generatedAt: now,
    summary: input.summary ?? {
      pendingCount: 0,
      oldestPendingCreatedAt: null,
      lastClassifiedAt: null,
    },
    items: visibleItems.map((item) => ({
      id: String(item.messageId),
      channelId: item.discordChannelId,
      channelName: item.channelName,
      author: item.author || item.username,
      label: item.label ?? "pending",
      content: item.content,
      rationale: item.rationale ?? "Awaiting classification.",
      provider: item.provider ?? "pending",
      keywords: parseKeywords(item.keywordsJson ?? "[]"),
      confidence: item.confidence ?? 0,
      createdAt: toTimestamp(item.createdAt),
      reactionCount: parseReactionCount(item.rawJson),
      reviewStatus: item.reviewStatus === "resolved" ? "resolved" : "pending",
      reviewedAt: item.reviewedAt ? toTimestamp(item.reviewedAt) : null,
    })),
    pageInfo: {
      limit,
      nextCursor,
      hasNextPage,
    },
  };
}

export async function getSentimentMessageContextData(
  messageId: string,
): Promise<SentimentMessageContextResponse> {
  const numericMessageId = Number(messageId);
  if (!Number.isFinite(numericMessageId)) {
    return {
      generatedAt: Date.now(),
      item: null,
      context: [],
    };
  }

  const item = await db
    .select({
      messageId: discordMessages.id,
      channelId: discordMessages.channelId,
      discordChannelId: discordChannels.discordChannelId,
      channelName: discordChannels.name,
      author: discordMembers.displayName,
      username: discordMembers.username,
      content: discordMessages.content,
      createdAt: discordMessages.createdAt,
      label: messageSentiment.label,
      rationale: messageSentiment.rationale,
      provider: messageSentiment.provider,
      confidence: messageSentiment.confidence,
      rawJson: discordMessages.rawJson,
      reviewStatus: messageReviewState.status,
      reviewedAt: messageReviewState.reviewedAt,
    })
    .from(discordMessages)
    .innerJoin(discordChannels, eq(discordChannels.id, discordMessages.channelId))
    .innerJoin(discordMembers, eq(discordMembers.id, discordMessages.authorId))
    .leftJoin(messageSentiment, eq(messageSentiment.messageId, discordMessages.id))
    .leftJoin(messageReviewState, eq(messageReviewState.messageId, discordMessages.id))
    .where(eq(discordMessages.id, numericMessageId))
    .get();

  if (!item) {
    return {
      generatedAt: Date.now(),
      item: null,
      context: [],
    };
  }

  const contextRows = await db
    .select({
      messageId: discordMessages.id,
      author: discordMembers.displayName,
      username: discordMembers.username,
      content: discordMessages.content,
      createdAt: discordMessages.createdAt,
      label: messageSentiment.label,
      reviewStatus: messageReviewState.status,
    })
    .from(discordMessages)
    .innerJoin(discordMembers, eq(discordMembers.id, discordMessages.authorId))
    .leftJoin(messageSentiment, eq(messageSentiment.messageId, discordMessages.id))
    .leftJoin(messageReviewState, eq(messageReviewState.messageId, discordMessages.id))
    .where(
      and(
        eq(discordMessages.channelId, item.channelId),
        isNull(discordMessages.deletedAt),
        sql`length(trim(${discordMessages.content})) > 0`,
      ),
    )
    .orderBy(desc(discordMessages.createdAt), desc(discordMessages.id))
    .limit(40)
    .all();

  const sortedContext = [...contextRows]
    .sort((a, b) => toTimestamp(a.createdAt) - toTimestamp(b.createdAt) || a.messageId - b.messageId);
  const selectedIndex = sortedContext.findIndex((row) => row.messageId === numericMessageId);
  const sliceStart = Math.max(0, selectedIndex - 3);
  const sliceEnd = selectedIndex >= 0 ? selectedIndex + 4 : 7;

  return {
    generatedAt: Date.now(),
    item: {
      id: String(item.messageId),
      channelId: item.discordChannelId,
      channelName: item.channelName,
      author: item.author || item.username,
      content: item.content,
      label: item.label ?? "pending",
      rationale: item.rationale ?? "Awaiting classification.",
      provider: item.provider ?? "pending",
      confidence: item.confidence ?? 0,
      createdAt: toTimestamp(item.createdAt),
      reactionCount: parseReactionCount(item.rawJson),
      reviewStatus: item.reviewStatus === "resolved" ? "resolved" : "pending",
      reviewedAt: item.reviewedAt ? toTimestamp(item.reviewedAt) : null,
    },
    context: sortedContext.slice(sliceStart, sliceEnd).map((row) => ({
      id: String(row.messageId),
      author: row.author || row.username,
      content: row.content,
      createdAt: toTimestamp(row.createdAt),
      label: row.label ?? "pending",
      reviewStatus: row.reviewStatus === "resolved" ? "resolved" : "pending",
    })),
  };
}

export async function updateMessageReviewStatus(input: {
  messageId: string;
  status: "pending" | "resolved";
  note?: string;
}): Promise<{ ok: true }> {
  const numericMessageId = Number(input.messageId);
  if (!Number.isFinite(numericMessageId)) {
    throw new Error("Invalid message id.");
  }

  const now = new Date();
  await db.insert(messageReviewState).values({
    messageId: numericMessageId,
    status: input.status,
    note: input.note?.trim() || null,
    reviewedAt: input.status === "resolved" ? now : null,
    createdAt: now,
    updatedAt: now,
  }).onConflictDoUpdate({
    target: messageReviewState.messageId,
    set: {
      status: input.status,
      note: input.note?.trim() || null,
      reviewedAt: input.status === "resolved" ? now : null,
      updatedAt: now,
    },
  });

  return { ok: true };
}

async function upsertChannelSnapshot(
  table: typeof channelHourlySnapshots | typeof channelDailySnapshots,
  bucketStart: Date,
  windowStart: number,
  windowEnd: number,
) {
  const bucketStartDate = bucketStart instanceof Date ? bucketStart : new Date(bucketStart);
  const rows = await queryMessages(windowStart, windowEnd);
  const summaries = new Map<number, {
    messageCount: number;
    users: Set<number>;
    positive: number;
    neutral: number;
    negative: number;
  }>();

  for (const row of rows) {
    const channel = await db
      .select({ id: discordChannels.id })
      .from(discordChannels)
      .where(eq(discordChannels.discordChannelId, row.discordChannelId))
      .get();
    if (!channel) continue;
    const entry = summaries.get(channel.id) ?? {
      messageCount: 0,
      users: new Set<number>(),
      positive: 0,
      neutral: 0,
      negative: 0,
    };
    entry.messageCount += 1;
    entry.users.add(row.authorId);
    if (row.label === "positive") entry.positive += 1;
    else if (row.label === "negative") entry.negative += 1;
    else entry.neutral += 1;
    summaries.set(channel.id, entry);
  }

  for (const [channelId, entry] of summaries) {
    const existing = await db
      .select({ id: table.id })
      .from(table)
      .where(and(eq(table.channelId, channelId), eq(table.bucketStart, bucketStartDate)))
      .get();
    const values = {
      channelId,
      bucketStart: bucketStartDate,
      messageCount: entry.messageCount,
      activeUserCount: entry.users.size,
      positiveCount: entry.positive,
      neutralCount: entry.neutral,
      negativeCount: entry.negative,
      updatedAt: new Date(),
    };
    if (existing) {
      await db.update(table).set(values).where(eq(table.id, existing.id)).run();
    } else {
      await db.insert(table).values(values).run();
    }
  }
}

export async function refreshSnapshots(): Promise<void> {
  const now = Date.now();
  const nowDate = new Date(now);
  const hourStartMs = startOfHour(now);
  const dayStartMs = startOfDay(now);
  const hourStart = new Date(hourStartMs);
  const dayStart = new Date(dayStartMs);
  await upsertChannelSnapshot(channelHourlySnapshots, hourStart, hourStartMs, now);
  await upsertChannelSnapshot(channelDailySnapshots, dayStart, dayStartMs, now);

  const overview = await getOverviewData();
  const rows = [
    { granularity: "hourly", bucketStart: hourStart },
    { granularity: "daily", bucketStart: dayStart },
  ];

  for (const row of rows) {
    const existing = await db
      .select({ id: overviewSnapshots.id })
      .from(overviewSnapshots)
      .where(and(eq(overviewSnapshots.granularity, row.granularity), eq(overviewSnapshots.bucketStart, row.bucketStart)))
      .get();
    const values = {
      granularity: row.granularity,
      bucketStart: row.bucketStart,
      totalMessages: overview.metrics.messagesLast7d.value,
      activeUsers: overview.metrics.activeUsersLast7d.value,
      negativeRate: overview.attentionChannels.length > 0 ? Math.round(overview.attentionChannels[0].negativeRate * 10) : 0,
      healthScore: overview.metrics.healthScore.value,
      updatedAt: nowDate,
    };
    if (existing) {
      await db.update(overviewSnapshots).set(values).where(eq(overviewSnapshots.id, existing.id)).run();
    } else {
      await db.insert(overviewSnapshots).values(values).run();
    }
  }
}
