import {
  getDashboardMessagesData,
  getOverviewData,
  getSentimentChannelsData,
  getSentimentMessagesData,
  type DashboardMessageRow,
  type Trend,
} from "./dashboard";
import type {
  AdminChatBriefingBundle,
  AdminChatBriefingMetricDelta,
  AdminChatTopContentItem,
  AdminChatWindow,
} from "../../shared/admin-chat";

type BriefingMessage = AdminChatBriefingBundle["flaggedMessages"][number];
type BriefingCreator = AdminChatBriefingBundle["creatorActivity"]["activeCreators"][number];
type BriefingPendingReviewChannel = AdminChatBriefingBundle["pendingReviewByChannel"][number];
type BriefingTopSharedTikTok = AdminChatBriefingBundle["topSharedTikToks"][number];
type BriefingTopContent = AdminChatTopContentItem;
type BriefingFlaggedChannel = AdminChatBriefingBundle["flaggedChannels"][number];

const tiktokPattern = /(?:^|\W)(?:www\.)?(?:vt\.|vm\.)?tiktok\.com\//i;
const tiktokUrlPattern = /(?:https?:\/\/)?(?:www\.)?(?:vt\.|vm\.)?tiktok\.com\/[^\s<>"')]+/gi;

const windowMs = (window: AdminChatWindow): number => {
  if (window === "24h") return 24 * 60 * 60 * 1000;
  if (window === "14d") return 14 * 24 * 60 * 60 * 1000;
  return 7 * 24 * 60 * 60 * 1000;
};

const toTimestamp = (value: Date | number | null | undefined): number => {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (value instanceof Date) return value.getTime();
  return 0;
};

const parseKeywords = (value: string | null | undefined): string[] => {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value) as string[];
    return Array.isArray(parsed) ? parsed.filter((item) => typeof item === "string" && item.trim().length > 0) : [];
  } catch {
    return [];
  }
};

const containsTikTokLink = (value: string | null | undefined): boolean => {
  return Boolean(value && tiktokPattern.test(value));
};

const extractTikTokLinks = (value: string | null | undefined): string[] => {
  if (!value) return [];
  return [...value.matchAll(tiktokUrlPattern)].map((match) =>
    match[0].startsWith("http://") || match[0].startsWith("https://")
      ? match[0]
      : `https://${match[0]}`,
  );
};

const toMetricDelta = (value: { value: number; trend: Trend }): AdminChatBriefingMetricDelta => ({
  current: value.value,
  delta: value.trend.delta,
  pct: value.trend.pct,
});

const toBriefingMessage = (row: DashboardMessageRow): BriefingMessage | null => {
  if (row.label !== "negative") return null;
  return {
    id: String(row.messageId),
    channelId: row.discordChannelId,
    channelName: row.channelName,
    author: row.author || row.username,
    content: row.content,
    rationale: row.rationale ?? "Marked negative by the current classifier.",
    createdAt: toTimestamp(row.createdAt),
    label: "negative",
    confidence: row.confidence ?? 0,
    provider: row.provider ?? "pending",
    keywords: parseKeywords(row.keywordsJson),
    reviewStatus: row.reviewStatus === "resolved" ? "resolved" : "pending",
  };
};

const sortMessagesDescending = (left: DashboardMessageRow, right: DashboardMessageRow): number => {
  return toTimestamp(right.createdAt) - toTimestamp(left.createdAt) || right.messageId - left.messageId;
};

const buildPendingReviewByChannel = (
  rows: DashboardMessageRow[],
): BriefingPendingReviewChannel[] => {
  const buckets = new Map<string, BriefingPendingReviewChannel>();

  for (const row of rows.sort(sortMessagesDescending)) {
    const needsReview =
      row.reviewStatus !== "resolved" && (row.label === "negative" || row.label == null);
    if (!needsReview) continue;

    const existing = buckets.get(row.discordChannelId) ?? {
      channelId: row.discordChannelId,
      channelName: row.channelName,
      pendingReviewCount: 0,
      classifiedNegativeCount: 0,
      latestMessageAt: null,
      examples: [],
    };

    existing.pendingReviewCount += 1;
    if (row.label === "negative") {
      existing.classifiedNegativeCount += 1;
    }
    const createdAt = toTimestamp(row.createdAt);
    existing.latestMessageAt = existing.latestMessageAt
      ? Math.max(existing.latestMessageAt, createdAt)
      : createdAt;
    if (existing.examples.length < 3) {
      existing.examples.push({
        id: String(row.messageId),
        author: row.author || row.username,
        content: row.content,
        createdAt,
      });
    }

    buckets.set(row.discordChannelId, existing);
  }

  return Array.from(buckets.values())
    .sort((left, right) => {
      if (right.pendingReviewCount !== left.pendingReviewCount) {
        return right.pendingReviewCount - left.pendingReviewCount;
      }
      return (right.latestMessageAt ?? 0) - (left.latestMessageAt ?? 0);
    })
    .slice(0, 8);
};

const buildTopSharedTikToks = (
  rows: DashboardMessageRow[],
): BriefingTopSharedTikTok[] => {
  const buckets = new Map<
    string,
    {
      url: string;
      shareCount: number;
      creators: Set<string>;
      channels: Set<string>;
      lastSharedAt: number;
      sampleAuthor: string;
      sampleContent: string;
    }
  >();

  for (const row of rows) {
    if (!containsTikTokLink(row.content)) continue;
    for (const url of extractTikTokLinks(row.content)) {
      const existing = buckets.get(url) ?? {
        url,
        shareCount: 0,
        creators: new Set<string>(),
        channels: new Set<string>(),
        lastSharedAt: 0,
        sampleAuthor: row.author || row.username,
        sampleContent: row.content,
      };
      existing.shareCount += 1;
      existing.creators.add(row.author || row.username);
      existing.channels.add(row.channelName);
      existing.lastSharedAt = Math.max(existing.lastSharedAt, toTimestamp(row.createdAt));
      buckets.set(url, existing);
    }
  }

  return Array.from(buckets.values())
    .map((item) => ({
      url: item.url,
      shareCount: item.shareCount,
      creatorCount: item.creators.size,
      lastSharedAt: item.lastSharedAt,
      creators: [...item.creators].slice(0, 4),
      channels: [...item.channels].slice(0, 4),
      sampleAuthor: item.sampleAuthor,
      sampleContent: item.sampleContent,
    }))
    .sort((left, right) => {
      if (right.shareCount !== left.shareCount) return right.shareCount - left.shareCount;
      if (right.creatorCount !== left.creatorCount) return right.creatorCount - left.creatorCount;
      return right.lastSharedAt - left.lastSharedAt;
    })
    .slice(0, 10);
};

export const buildAdminChatBriefingBundle = async (input?: {
  window?: AdminChatWindow;
}): Promise<AdminChatBriefingBundle> => {
  const window = input?.window ?? "7d";
  const now = Date.now();
  const selectedWindowFrom = now - windowMs(window);
  const weeklyFrom = now - windowMs("7d");

  const [
    selectedOverview,
    weeklyOverview,
    sentimentChannels,
    flaggedMessagesResponse,
    selectedRows,
    weeklyRows,
  ] = await Promise.all([
    getOverviewData({
      from: selectedWindowFrom,
      to: now,
    }),
    window === "7d"
      ? getOverviewData({
          from: selectedWindowFrom,
          to: now,
        })
      : getOverviewData(),
    getSentimentChannelsData(window),
    getSentimentMessagesData({
      window,
      label: "negative",
      sort: "risk",
      limit: 12,
      summary: {
        pendingCount: 0,
        oldestPendingCreatedAt: null,
        lastClassifiedAt: null,
      },
    }),
    getDashboardMessagesData(selectedWindowFrom, now),
    getDashboardMessagesData(weeklyFrom, now),
  ]);

  const flaggedMessages = flaggedMessagesResponse.items
    .map((item) => ({
      id: item.id,
      channelId: item.channelId,
      channelName: item.channelName,
      author: item.author,
      content: item.content,
      rationale: item.rationale,
      createdAt: item.createdAt,
      label: "negative" as const,
      confidence: item.confidence,
      provider: item.provider,
      keywords: item.keywords,
      reviewStatus: item.reviewStatus,
    }))
    .slice(0, 8);

  const pendingReviewByChannel = buildPendingReviewByChannel(selectedRows);
  const topSharedTikToks = buildTopSharedTikToks(weeklyRows);
  const topContent = topSharedTikToks.map((item) => ({
    source: "discord-link-shares" as const,
    url: item.url,
    shareCount: item.shareCount,
    creatorCount: item.creatorCount,
    lastSharedAt: item.lastSharedAt,
    sampleAuthor: item.sampleAuthor,
    sampleContent: item.sampleContent,
    views: null,
    sales: null,
    gmv: null,
    engagement: null,
    liveSessions: null,
  }));
  const flaggedChannels = selectedOverview.drilldowns.flaggedChannels.map((channel) => ({
    ...channel,
    contributingMessages: flaggedMessages
      .filter((message) => message.channelId === channel.channelId)
      .slice(0, 3),
  }));

  const nextAction = flaggedChannels[0]
    ? `Start in ${flaggedChannels[0].channelName}: ${flaggedChannels[0].reason}`
    : pendingReviewByChannel[0]
      ? `Clear ${pendingReviewByChannel[0].pendingReviewCount.toLocaleString()} pending review messages in ${pendingReviewByChannel[0].channelName}.`
      : topSharedTikToks[0]
        ? `Use ${topSharedTikToks[0].url} as the lead creator example in today's briefing.`
        : "No urgent risk is visible. Use the briefing to reinforce the strongest creator activity this week.";

  return {
    generatedAt: now,
    window,
    totals: sentimentChannels.totals,
    health: {
      score: selectedOverview.rangeMetrics.healthScore.value,
      delta: selectedOverview.rangeMetrics.healthScore.trend,
      summary: selectedOverview.explainers.health.summary,
      drivers: selectedOverview.explainers.health.drivers,
      nextAction,
    },
    sentimentByChannel: sentimentChannels.channels,
    keywordShifts: sentimentChannels.keywordShifts.slice(0, 8),
    flaggedChannels,
    pendingReviewByChannel,
    creatorActivity: {
      activeCount: selectedOverview.rangeMetrics.activeUsers.value,
      inactiveCount: selectedOverview.rangeMetrics.inactiveUsers.value,
      activeCreators: selectedOverview.drilldowns.activeUsers.slice(0, 8).map((item) => ({
        userId: item.userId,
        displayName: item.displayName,
        username: item.username,
        avatarUrl: item.avatarUrl,
        activityCount: item.messageCount,
        lastActiveAt: item.lastMessageAt,
        detail: `${item.messageCount.toLocaleString()} messages, most active in ${item.topChannelName}.`,
      })),
      inactiveCreators: selectedOverview.drilldowns.inactiveUsers.slice(0, 8).map((item) => ({
        userId: item.userId,
        displayName: item.displayName,
        username: item.username,
        avatarUrl: item.avatarUrl,
        activityCount: item.historicalMessageCount,
        lastActiveAt: item.lastMessageAt,
        detail: `${item.historicalMessageCount.toLocaleString()} historical messages before going quiet.`,
      })),
    },
    topSharedTikToks,
    topContent,
    weekOverWeek: {
      healthScore: toMetricDelta(weeklyOverview.rangeMetrics.healthScore),
      activeUsers: toMetricDelta(weeklyOverview.rangeMetrics.activeUsers),
      inactiveUsers: toMetricDelta(weeklyOverview.rangeMetrics.inactiveUsers),
      totalTikTokLinks: toMetricDelta(weeklyOverview.rangeMetrics.totalTikTokLinks),
      uniqueTikTokPosters: toMetricDelta(weeklyOverview.rangeMetrics.uniqueTikTokPosters),
      negativeMessageRate: toMetricDelta(weeklyOverview.rangeMetrics.negativeMessageRate),
      channelsNeedingAttention: toMetricDelta(weeklyOverview.rangeMetrics.channelsNeedingAttention),
    },
    flaggedMessages:
      flaggedMessages.length > 0
        ? flaggedMessages
        : selectedRows
            .map(toBriefingMessage)
            .filter((item): item is BriefingMessage => Boolean(item))
            .sort((left, right) => right.createdAt - left.createdAt)
            .slice(0, 8),
  };
};
