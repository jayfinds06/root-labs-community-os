import type {
  AdminChatBriefingBundle as SharedAdminChatBriefingBundle,
  AdminChatBriefingMetricDelta as SharedAdminChatBriefingMetricDelta,
  AdminChatCitation as SharedAdminChatCitation,
  AdminChatEvidenceMessage as SharedAdminChatEvidenceMessage,
  AdminChatGuardrails as SharedAdminChatGuardrails,
  AdminChatRequest as SharedAdminChatRequest,
  AdminChatResponse as SharedAdminChatResponse,
  AdminChatStreamEvent as SharedAdminChatStreamEvent,
  AdminChatWindow,
} from "../../shared/admin-chat";

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
    allTime: {
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

export type SentimentWindow = AdminChatWindow;
export type SentimentLabel = "all" | "positive" | "neutral" | "negative" | "pending";
export type SentimentMessageSort = "risk" | "newest";

export type SentimentChannelsResponse = {
  generatedAt: number;
  window: SentimentWindow;
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

export type ExplorerResourceKey =
  | "discord-guilds"
  | "discord-channels"
  | "discord-members"
  | "discord-messages"
  | "channel-hourly-snapshots"
  | "channel-daily-snapshots"
  | "overview-snapshots";

export type ExplorerValue = string | number | boolean | null | string[];

export type ExplorerResourceDefinition = {
  key: ExplorerResourceKey;
  label: string;
  description: string;
  defaultSort: { field: string; dir: "desc" };
  allowedIncludes: string[];
  columns: Array<{
    key: string;
    label: string;
    type: "string" | "number" | "boolean" | "datetime" | "json";
    defaultVisible: boolean;
  }>;
  filters: Array<{
    key: string;
    label: string;
    type: "text" | "boolean" | "datetime" | "select";
    param: string;
    options?: Array<{ value: string; label: string }>;
  }>;
};

export type ExplorerResourcesResponse = {
  generatedAt: number;
  resources: ExplorerResourceDefinition[];
};

export type ExplorerListResponse = {
  resource: ExplorerResourceKey;
  generatedAt: number;
  items: Array<{
    id: string;
    values: Record<string, ExplorerValue>;
  }>;
  pageInfo: {
    limit: number;
    nextCursor: string | null;
    hasNextPage: boolean;
  };
};

export type ExplorerDetailResponse = {
  resource: ExplorerResourceKey;
  generatedAt: number;
  item: {
    id: string;
    values: Record<string, ExplorerValue>;
    joins: Record<string, Record<string, ExplorerValue> | null>;
  } | null;
};

export type UserInsightSummary = {
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

export type UserInsightListItem = {
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

export type SyncResponse = {
  ok: boolean;
  jobId?: string;
  reason?: string;
};

export type ResetResponse = {
  ok: boolean;
  reason?: string;
  deleted?: {
    overviewSnapshots: number;
    channelDailySnapshots: number;
    channelHourlySnapshots: number;
    messageSentiment: number;
    discordMessages: number;
    discordMembers: number;
    discordChannels: number;
    discordGuilds: number;
  };
};

export type SyncSettingsResponse = {
  cadenceMinutes: number;
  allowRawDataAccess: boolean;
  limits: {
    defaultMinutes: number;
    minMinutes: number;
    maxMinutes: number;
  };
};

export type AdminUser = {
  id: string;
  name: string;
  email: string;
  role: "admin" | "user";
  banned: boolean;
  banReason: string | null;
  createdAt: number;
  updatedAt: number;
};

export type AdminUsersResponse = {
  items: AdminUser[];
  total: number;
};

export type AdminUserMutationResponse = {
  ok: boolean;
  item?: AdminUser | null;
};

export type AdminChatCitation = SharedAdminChatCitation;
export type AdminChatEvidenceMessage = SharedAdminChatEvidenceMessage;
export type AdminChatBriefingMetricDelta = SharedAdminChatBriefingMetricDelta;
export type AdminChatBriefingBundle = SharedAdminChatBriefingBundle;
export type AdminChatGuardrails = SharedAdminChatGuardrails;
export type AdminChatRequest = SharedAdminChatRequest;
export type AdminChatResponse = SharedAdminChatResponse;
export type AdminChatStreamEvent = SharedAdminChatStreamEvent;

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  if (!response.ok) {
    const payload = await response.json().catch(() => null) as { error?: string; reason?: string } | null;
    throw new Error(payload?.error ?? payload?.reason ?? `Request failed (${response.status})`);
  }
  return (await response.json()) as T;
}

export function fetchOverview(input?: {
  from?: string;
  to?: string;
}): Promise<OverviewResponse> {
  const params = new URLSearchParams();
  if (input?.from) params.set("from", input.from);
  if (input?.to) params.set("to", input.to);
  const query = params.toString();
  return fetchJson(`/api/admin/overview${query ? `?${query}` : ""}`);
}

export function fetchSentimentChannels(
  window: SentimentWindow,
  input?: { channelId?: string },
): Promise<SentimentChannelsResponse> {
  const params = new URLSearchParams({ window });
  if (input?.channelId) params.set("channelId", input.channelId);
  return fetchJson(`/api/admin/sentiment/channels?${params.toString()}`);
}

export function fetchSentimentMessages(input: {
  window: SentimentWindow;
  label: SentimentLabel;
  channelId?: string;
  q?: string;
  sort?: SentimentMessageSort;
  limit?: number;
  cursor?: string;
}): Promise<SentimentMessagesResponse> {
  const params = new URLSearchParams({
    window: input.window,
    label: input.label,
  });
  if (input.channelId) params.set("channelId", input.channelId);
  if (input.q) params.set("q", input.q);
  if (input.sort) params.set("sort", input.sort);
  if (input.limit) params.set("limit", String(input.limit));
  if (input.cursor) params.set("cursor", input.cursor);
  return fetchJson(`/api/admin/sentiment/messages?${params.toString()}`);
}

export function fetchSentimentMessageContext(messageId: string): Promise<SentimentMessageContextResponse> {
  return fetchJson(`/api/admin/sentiment/message-context?messageId=${encodeURIComponent(messageId)}`);
}

export function updateSentimentReviewStatus(input: {
  messageId: string;
  status: "pending" | "resolved";
  note?: string;
}): Promise<{ ok: boolean }> {
  return fetchJson("/api/admin/sentiment/review-status", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export function triggerDiscordSync(input?: { reset?: boolean }): Promise<SyncResponse> {
  return fetchJson("/api/admin/discord/sync", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reset: input?.reset === true }),
  });
}

export function resetDiscordData(): Promise<ResetResponse> {
  return fetchJson("/api/admin/discord/reset", { method: "POST" });
}

export function dropAllDiscordData(): Promise<ResetResponse> {
  return resetDiscordData();
}

export function fetchSyncSettings(): Promise<SyncSettingsResponse> {
  return fetchJson("/api/admin/settings/sync");
}

export function updateSyncSettings(input: {
  cadenceMinutes?: number;
  allowRawDataAccess?: boolean;
}): Promise<SyncSettingsResponse & { ok: boolean }> {
  return fetchJson("/api/admin/settings/sync", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export function fetchAdminUsers(search?: string): Promise<AdminUsersResponse> {
  const params = new URLSearchParams();
  if (search?.trim()) {
    params.set("search", search.trim());
  }
  const query = params.toString();
  return fetchJson(`/api/admin/users${query ? `?${query}` : ""}`);
}

export function createAdminUser(input: {
  name: string;
  email: string;
  password: string;
  role: "admin" | "user";
}): Promise<AdminUserMutationResponse> {
  return fetchJson("/api/admin/users", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export function updateAdminUser(input: {
  userId: string;
  name: string;
  email: string;
  role: "admin" | "user";
}): Promise<AdminUserMutationResponse> {
  return fetchJson("/api/admin/users/update", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export function deleteAdminUser(userId: string): Promise<{ ok: boolean }> {
  return fetchJson("/api/admin/users/delete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId }),
  });
}

export function fetchAdminChat(input: AdminChatRequest): Promise<AdminChatResponse> {
  return fetchJson("/api/admin/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export async function fetchAdminChatStream(input: AdminChatRequest): Promise<Response> {
  const response = await fetch("/api/admin/chat/stream", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const payload = await response
      .json()
      .catch(() => null) as { error?: string; reason?: string } | null;
    throw new Error(payload?.error ?? payload?.reason ?? `Request failed (${response.status})`);
  }

  return response;
}

export function fetchExplorerResources(): Promise<ExplorerResourcesResponse> {
  return fetchJson("/api/admin/explorer/resources");
}

export function fetchExplorerList(input: {
  resource: ExplorerResourceKey;
  cursor?: string | null;
  limit?: number;
  q?: string;
  from?: string;
  to?: string;
  guildId?: string;
  channelId?: string;
  authorId?: string;
  sentimentLabel?: string;
  isDeleted?: string;
  isMonitored?: string;
  isBot?: string;
  granularity?: string;
}): Promise<ExplorerListResponse> {
  const params = new URLSearchParams({ resource: input.resource });
  if (input.cursor) params.set("cursor", input.cursor);
  if (input.limit) params.set("limit", String(input.limit));
  if (input.q) params.set("q", input.q);
  if (input.from) params.set("from", input.from);
  if (input.to) params.set("to", input.to);
  if (input.guildId) params.set("guildId", input.guildId);
  if (input.channelId) params.set("channelId", input.channelId);
  if (input.authorId) params.set("authorId", input.authorId);
  if (input.sentimentLabel) params.set("sentimentLabel", input.sentimentLabel);
  if (input.isDeleted) params.set("isDeleted", input.isDeleted);
  if (input.isMonitored) params.set("isMonitored", input.isMonitored);
  if (input.isBot) params.set("isBot", input.isBot);
  if (input.granularity) params.set("granularity", input.granularity);
  return fetchJson(`/api/admin/explorer/list?${params.toString()}`);
}

export function fetchExplorerDetail(input: {
  resource: ExplorerResourceKey;
  id: string;
}): Promise<ExplorerDetailResponse> {
  const params = new URLSearchParams(input);
  return fetchJson(`/api/admin/explorer/detail?${params.toString()}`);
}

export function fetchUserInsights(input?: {
  q?: string;
  guildId?: string;
  includeBots?: boolean;
  limit?: number;
}): Promise<UserInsightsResponse> {
  const params = new URLSearchParams();
  if (input?.q) params.set("q", input.q);
  if (input?.guildId) params.set("guildId", input.guildId);
  if (input?.includeBots) params.set("includeBots", "true");
  if (input?.limit) params.set("limit", String(input.limit));
  const query = params.toString();
  return fetchJson(`/api/admin/explorer/user-insights${query ? `?${query}` : ""}`);
}

export function fetchUserInsightDetail(input: {
  id: string;
  q?: string;
  guildId?: string;
  includeBots?: boolean;
  detailLimit?: number;
}): Promise<UserInsightDetailResponse> {
  const params = new URLSearchParams({ id: input.id });
  if (input.q) params.set("q", input.q);
  if (input.guildId) params.set("guildId", input.guildId);
  if (input.includeBots) params.set("includeBots", "true");
  if (input.detailLimit) params.set("detailLimit", String(input.detailLimit));
  return fetchJson(`/api/admin/explorer/user-insights/detail?${params.toString()}`);
}
