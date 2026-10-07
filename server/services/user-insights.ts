import { and, desc, eq, inArray, isNull, like, or, sql } from "drizzle-orm";
import { db } from "../db/client";
import {
  discordChannels,
  discordGuilds,
  discordMembers,
  discordMessages,
  messageSentiment,
} from "../db/schema";

type UserInsightListItem = {
  userId: string;
  discordUserId: string;
  displayName: string;
  username: string;
  avatarUrl: string | null;
  guildName: string;
  isBot: boolean;
  messageCount: number;
  classifiedCount: number;
  pendingCount: number;
  positiveCount: number;
  neutralCount: number;
  negativeCount: number;
  tiktokLinkCount: number;
  avgConfidence: number;
  lastMessageAt: number | null;
  sentimentMeter: number;
  summary: string;
};

type UserInsightSummary = {
  totalUsers: number;
  totalMessages: number;
  classifiedMessages: number;
  pendingMessages: number;
  positiveMessages: number;
  neutralMessages: number;
  negativeMessages: number;
  totalTikTokLinks: number;
  sentimentMeter: number;
  lastMessageAt: number | null;
};

export type UserInsightsResponse = {
  generatedAt: number;
  summary: UserInsightSummary;
  items: UserInsightListItem[];
};

export type UserInsightDetailResponse = {
  generatedAt: number;
  item: (UserInsightListItem & {
    topChannels: Array<{
      channelId: string;
      channelName: string;
      messageCount: number;
      tiktokLinkCount: number;
    }>;
    topKeywords: Array<{
      keyword: string;
      count: number;
    }>;
    recentMessages: Array<{
      id: string;
      channelName: string;
      content: string;
      createdAt: number;
      label: string;
      confidence: number;
      containsTikTokLink: boolean;
    }>;
    recentTikTokMessages: Array<{
      id: string;
      channelName: string;
      content: string;
      createdAt: number;
      label: string;
      confidence: number;
    }>;
  }) | null;
};

type UserInsightFilters = {
  q?: string;
  guildId?: string | null;
  includeBots?: boolean;
  limit?: number;
  userId?: number;
};

const DEFAULT_LIMIT = 40;
const MAX_LIMIT = 100;
const DEFAULT_DETAIL_LIMIT = 8;
const MAX_DETAIL_LIMIT = 20;

const tiktokMatchSql = sql<number>`case
  when (
    lower(${discordMessages.content}) like '%tiktok.com/%'
    or lower(${discordMessages.content}) like '%www.tiktok.com/%'
    or lower(${discordMessages.content}) like '%vt.tiktok.com/%'
    or lower(${discordMessages.content}) like '%vm.tiktok.com/%'
  ) then 1
  else 0
end`;

const buildBaseFilters = (input: UserInsightFilters) => {
  const q = input.q?.trim();
  const guildId = input.guildId ? Number(input.guildId) : null;
  const includeBots = input.includeBots === true;

  return and(
    isNull(discordMessages.deletedAt),
    includeBots ? undefined : eq(discordMembers.isBot, false),
    Number.isFinite(guildId) ? eq(discordMessages.guildId, guildId as number) : undefined,
    typeof input.userId === "number" ? eq(discordMessages.authorId, input.userId) : undefined,
    q
      ? or(
          like(discordMembers.displayName, `%${q}%`),
          like(discordMembers.username, `%${q}%`),
          like(discordMembers.discordUserId, `%${q}%`),
          like(discordChannels.name, `%${q}%`),
          like(discordMessages.content, `%${q}%`),
        )
      : undefined,
  );
};

const clampPercent = (value: number): number => Math.max(0, Math.min(100, Math.round(value)));

const toTimestamp = (value: Date | string | number | bigint | null | undefined): number | null => {
  if (value == null) return null;
  if (value instanceof Date) return value.getTime();
  if (typeof value === "number" || typeof value === "bigint") {
    const asNumber = Number(value);
    return Number.isFinite(asNumber) ? asNumber : null;
  }
  if (typeof value === "string") {
    const asNumber = Number(value);
    if (Number.isFinite(asNumber)) return asNumber;
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const toPreview = (value: string): string => {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (!normalized) return "(empty)";
  return normalized.length > 120 ? `${normalized.slice(0, 117)}...` : normalized;
};

const computeSentimentMeter = (positiveCount: number, negativeCount: number, classifiedCount: number): number => {
  if (classifiedCount <= 0) return 50;
  return clampPercent(50 + (((positiveCount - negativeCount) / classifiedCount) * 50));
};

const buildInsightSummary = (input: {
  positiveCount: number;
  negativeCount: number;
  classifiedCount: number;
  pendingCount: number;
  tiktokLinkCount: number;
  topChannels: string[];
  topKeywords: string[];
}): string => {
  const parts: string[] = [];

  if (input.topChannels.length) {
    parts.push(`Mostly active in ${input.topChannels.join(", ")}.`);
  }

  if (input.tiktokLinkCount > 0) {
    parts.push(
      `Shared ${input.tiktokLinkCount.toLocaleString()} TikTok link${input.tiktokLinkCount === 1 ? "" : "s"}.`,
    );
  }

  if (input.classifiedCount > 0) {
    const tone =
      input.negativeCount > input.positiveCount
        ? "Leans negative"
        : input.positiveCount > input.negativeCount
          ? "Leans positive"
          : "Mostly balanced";
    parts.push(`${tone} across ${input.classifiedCount.toLocaleString()} classified messages.`);
  }

  if (input.pendingCount > 0) {
    parts.push(`${input.pendingCount.toLocaleString()} message${input.pendingCount === 1 ? "" : "s"} still pending review.`);
  }

  if (input.topKeywords.length) {
    parts.push(`Keywords: ${input.topKeywords.join(", ")}.`);
  }

  return parts.join(" ").trim() || "Recent activity is available, but sentiment context is still sparse.";
};

const normalizeLimit = (value: number | undefined, fallback: number, max: number): number => {
  if (!value || !Number.isFinite(value) || value <= 0) return fallback;
  return Math.min(max, Math.round(value));
};

const collectContextMaps = async (userIds: number[], where: ReturnType<typeof buildBaseFilters>) => {
  if (!userIds.length) {
    return {
      topChannelsByUser: new Map<number, string[]>(),
      topKeywordsByUser: new Map<number, string[]>(),
    };
  }

  const [channelRows, keywordRows] = await Promise.all([
    db
      .select({
        userId: discordMessages.authorId,
        channelName: discordChannels.name,
        messageCount: sql<number>`count(*)`,
      })
      .from(discordMessages)
      .innerJoin(discordMembers, eq(discordMembers.id, discordMessages.authorId))
      .innerJoin(discordChannels, eq(discordChannels.id, discordMessages.channelId))
      .where(and(where, inArray(discordMessages.authorId, userIds)))
      .groupBy(discordMessages.authorId, discordChannels.id, discordChannels.name)
      .orderBy(desc(sql<number>`count(*)`), discordChannels.name)
      .all(),
    db
      .select({
        userId: discordMessages.authorId,
        keywordsJson: messageSentiment.keywordsJson,
      })
      .from(discordMessages)
      .innerJoin(discordMembers, eq(discordMembers.id, discordMessages.authorId))
      .leftJoin(messageSentiment, eq(messageSentiment.messageId, discordMessages.id))
      .where(and(where, inArray(discordMessages.authorId, userIds)))
      .all(),
  ]);

  const topChannelsByUser = new Map<number, string[]>();
  const topKeywordsByUser = new Map<number, string[]>();

  for (const row of channelRows) {
    const existing = topChannelsByUser.get(row.userId) ?? [];
    if (existing.length < 2) {
      topChannelsByUser.set(row.userId, [...existing, row.channelName]);
    }
  }

  const keywordCountByUser = new Map<number, Map<string, number>>();
  for (const row of keywordRows) {
    if (!row.keywordsJson) continue;

    let parsed: unknown;
    try {
      parsed = JSON.parse(row.keywordsJson);
    } catch {
      continue;
    }

    if (!Array.isArray(parsed)) continue;

    const bucket = keywordCountByUser.get(row.userId) ?? new Map<string, number>();
    for (const keyword of parsed) {
      if (typeof keyword !== "string") continue;
      const normalized = keyword.trim().toLowerCase();
      if (!normalized) continue;
      bucket.set(normalized, (bucket.get(normalized) ?? 0) + 1);
    }
    keywordCountByUser.set(row.userId, bucket);
  }

  for (const [userId, counts] of keywordCountByUser.entries()) {
    const topKeywords = [...counts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, 3)
      .map(([keyword]) => keyword);
    topKeywordsByUser.set(userId, topKeywords);
  }

  return {
    topChannelsByUser,
    topKeywordsByUser,
  };
};

const getUserInsightRows = async (input: UserInsightFilters) => {
  const limit = normalizeLimit(input.limit, DEFAULT_LIMIT, MAX_LIMIT);
  const where = buildBaseFilters(input);

  const rows = await db
    .select({
      userId: discordMembers.id,
      discordUserId: discordMembers.discordUserId,
      displayName: discordMembers.displayName,
      username: discordMembers.username,
      avatarUrl: discordMembers.avatarUrl,
      guildName: discordGuilds.name,
      isBot: discordMembers.isBot,
      messageCount: sql<number>`count(*)`,
      classifiedCount: sql<number>`sum(case when ${messageSentiment.id} is not null then 1 else 0 end)`,
      pendingCount: sql<number>`sum(case when ${messageSentiment.id} is null then 1 else 0 end)`,
      positiveCount: sql<number>`sum(case when ${messageSentiment.label} = 'positive' then 1 else 0 end)`,
      neutralCount: sql<number>`sum(case when ${messageSentiment.label} = 'neutral' then 1 else 0 end)`,
      negativeCount: sql<number>`sum(case when ${messageSentiment.label} = 'negative' then 1 else 0 end)`,
      tiktokLinkCount: sql<number>`sum(${tiktokMatchSql})`,
      avgConfidence: sql<number>`coalesce(round(avg(${messageSentiment.confidence}), 0), 0)`,
      lastMessageAt: sql<Date | null>`max(${discordMessages.createdAt})`,
    })
    .from(discordMessages)
    .innerJoin(discordMembers, eq(discordMembers.id, discordMessages.authorId))
    .innerJoin(discordGuilds, eq(discordGuilds.id, discordMessages.guildId))
    .innerJoin(discordChannels, eq(discordChannels.id, discordMessages.channelId))
    .leftJoin(messageSentiment, eq(messageSentiment.messageId, discordMessages.id))
    .where(where)
    .groupBy(
      discordMembers.id,
      discordMembers.discordUserId,
      discordMembers.displayName,
      discordMembers.username,
      discordMembers.avatarUrl,
      discordGuilds.name,
      discordMembers.isBot,
    )
    .orderBy(desc(sql<Date | null>`max(${discordMessages.createdAt})`), desc(discordMembers.id))
    .limit(limit)
    .all();

  const userIds = rows.map((row) => row.userId);
  const { topChannelsByUser, topKeywordsByUser } = await collectContextMaps(userIds, where);

  return rows.map((row) => {
    const displayName = row.displayName?.trim() || row.username;
    const topChannels = topChannelsByUser.get(row.userId) ?? [];
    const topKeywords = topKeywordsByUser.get(row.userId) ?? [];
    const sentimentMeter = computeSentimentMeter(
      row.positiveCount,
      row.negativeCount,
      row.classifiedCount,
    );

    return {
      userId: String(row.userId),
      discordUserId: row.discordUserId,
      displayName,
      username: row.username,
      avatarUrl: row.avatarUrl ?? null,
      guildName: row.guildName,
      isBot: row.isBot,
      messageCount: row.messageCount,
      classifiedCount: row.classifiedCount,
      pendingCount: row.pendingCount,
      positiveCount: row.positiveCount,
      neutralCount: row.neutralCount,
      negativeCount: row.negativeCount,
      tiktokLinkCount: row.tiktokLinkCount,
      avgConfidence: row.avgConfidence,
      lastMessageAt: toTimestamp(row.lastMessageAt),
      sentimentMeter,
      summary: buildInsightSummary({
        positiveCount: row.positiveCount,
        negativeCount: row.negativeCount,
        classifiedCount: row.classifiedCount,
        pendingCount: row.pendingCount,
        tiktokLinkCount: row.tiktokLinkCount,
        topChannels,
        topKeywords,
      }),
    } satisfies UserInsightListItem;
  });
};

export const getUserInsights = async (input: UserInsightFilters): Promise<UserInsightsResponse> => {
  const where = buildBaseFilters(input);
  const [summaryRow, items] = await Promise.all([
    db
      .select({
        totalUsers: sql<number>`count(distinct ${discordMessages.authorId})`,
        totalMessages: sql<number>`count(*)`,
        classifiedMessages: sql<number>`sum(case when ${messageSentiment.id} is not null then 1 else 0 end)`,
        pendingMessages: sql<number>`sum(case when ${messageSentiment.id} is null then 1 else 0 end)`,
        positiveMessages: sql<number>`sum(case when ${messageSentiment.label} = 'positive' then 1 else 0 end)`,
        neutralMessages: sql<number>`sum(case when ${messageSentiment.label} = 'neutral' then 1 else 0 end)`,
        negativeMessages: sql<number>`sum(case when ${messageSentiment.label} = 'negative' then 1 else 0 end)`,
        totalTikTokLinks: sql<number>`sum(${tiktokMatchSql})`,
        lastMessageAt: sql<Date | null>`max(${discordMessages.createdAt})`,
      })
      .from(discordMessages)
      .innerJoin(discordMembers, eq(discordMembers.id, discordMessages.authorId))
      .innerJoin(discordChannels, eq(discordChannels.id, discordMessages.channelId))
      .leftJoin(messageSentiment, eq(messageSentiment.messageId, discordMessages.id))
      .where(where)
      .get(),
    getUserInsightRows(input),
  ]);

  const classifiedMessages = summaryRow?.classifiedMessages ?? 0;
  const positiveMessages = summaryRow?.positiveMessages ?? 0;
  const negativeMessages = summaryRow?.negativeMessages ?? 0;

  return {
    generatedAt: Date.now(),
    summary: {
      totalUsers: summaryRow?.totalUsers ?? 0,
      totalMessages: summaryRow?.totalMessages ?? 0,
      classifiedMessages,
      pendingMessages: summaryRow?.pendingMessages ?? 0,
      positiveMessages,
      neutralMessages: summaryRow?.neutralMessages ?? 0,
      negativeMessages,
      totalTikTokLinks: summaryRow?.totalTikTokLinks ?? 0,
      sentimentMeter: computeSentimentMeter(
        positiveMessages,
        negativeMessages,
        classifiedMessages,
      ),
      lastMessageAt: toTimestamp(summaryRow?.lastMessageAt),
    },
    items,
  };
};

export const getUserInsightDetail = async (
  userId: string | null,
  input: UserInsightFilters & { detailLimit?: number },
): Promise<UserInsightDetailResponse> => {
  const normalizedUserId = Number(userId);
  if (!Number.isFinite(normalizedUserId)) {
    throw new Error("Invalid user id.");
  }

  const baseItem = (await getUserInsightRows({
    ...input,
    userId: normalizedUserId,
    limit: 1,
  }))
    .find((item) => Number(item.userId) === normalizedUserId) ?? null;

  if (!baseItem) {
    return {
      generatedAt: Date.now(),
      item: null,
    };
  }

  const detailLimit = normalizeLimit(input.detailLimit, DEFAULT_DETAIL_LIMIT, MAX_DETAIL_LIMIT);
  const where = buildBaseFilters({ ...input, userId: normalizedUserId });

  const [channelRows, recentMessages, recentTikTokMessages, keywordRows] = await Promise.all([
    db
      .select({
        channelId: discordChannels.discordChannelId,
        channelName: discordChannels.name,
        messageCount: sql<number>`count(*)`,
        tiktokLinkCount: sql<number>`sum(${tiktokMatchSql})`,
      })
      .from(discordMessages)
      .innerJoin(discordMembers, eq(discordMembers.id, discordMessages.authorId))
      .innerJoin(discordChannels, eq(discordChannels.id, discordMessages.channelId))
      .where(where)
      .groupBy(discordChannels.id, discordChannels.discordChannelId, discordChannels.name)
      .orderBy(desc(sql<number>`count(*)`), discordChannels.name)
      .limit(5)
      .all(),
    db
      .select({
        id: discordMessages.id,
        channelName: discordChannels.name,
        content: discordMessages.content,
        createdAt: discordMessages.createdAt,
        label: messageSentiment.label,
        confidence: messageSentiment.confidence,
      })
      .from(discordMessages)
      .innerJoin(discordMembers, eq(discordMembers.id, discordMessages.authorId))
      .innerJoin(discordChannels, eq(discordChannels.id, discordMessages.channelId))
      .leftJoin(messageSentiment, eq(messageSentiment.messageId, discordMessages.id))
      .where(where)
      .orderBy(desc(discordMessages.createdAt), desc(discordMessages.id))
      .limit(detailLimit)
      .all(),
    db
      .select({
        id: discordMessages.id,
        channelName: discordChannels.name,
        content: discordMessages.content,
        createdAt: discordMessages.createdAt,
        label: messageSentiment.label,
        confidence: messageSentiment.confidence,
      })
      .from(discordMessages)
      .innerJoin(discordMembers, eq(discordMembers.id, discordMessages.authorId))
      .innerJoin(discordChannels, eq(discordChannels.id, discordMessages.channelId))
      .leftJoin(messageSentiment, eq(messageSentiment.messageId, discordMessages.id))
      .where(and(where, sql`${tiktokMatchSql} = 1`))
      .orderBy(desc(discordMessages.createdAt), desc(discordMessages.id))
      .limit(detailLimit)
      .all(),
    db
      .select({
        keywordsJson: messageSentiment.keywordsJson,
      })
      .from(discordMessages)
      .innerJoin(discordMembers, eq(discordMembers.id, discordMessages.authorId))
      .leftJoin(messageSentiment, eq(messageSentiment.messageId, discordMessages.id))
      .where(where)
      .all(),
  ]);

  const keywordCounts = new Map<string, number>();
  for (const row of keywordRows) {
    if (!row.keywordsJson) continue;
    let parsed: unknown;
    try {
      parsed = JSON.parse(row.keywordsJson);
    } catch {
      continue;
    }

    if (!Array.isArray(parsed)) continue;

    for (const keyword of parsed) {
      if (typeof keyword !== "string") continue;
      const normalized = keyword.trim().toLowerCase();
      if (!normalized) continue;
      keywordCounts.set(normalized, (keywordCounts.get(normalized) ?? 0) + 1);
    }
  }

  const topKeywords = [...keywordCounts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 6)
    .map(([keyword, count]) => ({ keyword, count }));

  return {
    generatedAt: Date.now(),
    item: {
      ...baseItem,
      topChannels: channelRows.map((row) => ({
        channelId: row.channelId,
        channelName: row.channelName,
        messageCount: row.messageCount,
        tiktokLinkCount: row.tiktokLinkCount,
      })),
      topKeywords,
      recentMessages: recentMessages.map((row) => ({
        id: String(row.id),
        channelName: row.channelName,
        content: toPreview(row.content),
        createdAt: toTimestamp(row.createdAt) ?? Date.now(),
        label: row.label ?? "pending",
        confidence: row.confidence ?? 0,
        containsTikTokLink: /(?:^|\W)(?:www\.)?(?:vt\.|vm\.)?tiktok\.com\//i.test(row.content),
      })),
      recentTikTokMessages: recentTikTokMessages.map((row) => ({
        id: String(row.id),
        channelName: row.channelName,
        content: toPreview(row.content),
        createdAt: toTimestamp(row.createdAt) ?? Date.now(),
        label: row.label ?? "pending",
        confidence: row.confidence ?? 0,
      })),
    },
  };
};
