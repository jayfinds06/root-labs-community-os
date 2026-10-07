export type AdminChatWindow = "24h" | "7d" | "14d";

export type AdminChatCitation = {
  source: "overview" | "sentiment/channels" | "sentiment/messages" | "explorer" | "sql";
  label: string;
  generatedAt?: number;
  meta?: Record<string, string | number | boolean | null>;
};

export type AdminChatEvidenceMessage = {
  id: string;
  channelName: string;
  author: string;
  content: string;
  createdAt: number;
  label?: string;
};

export type AdminChatBriefingMetricDelta = {
  current: number;
  delta: number;
  pct: number;
};

export type AdminChatTopContentItem = {
  source: "discord-link-shares";
  url: string;
  shareCount: number;
  creatorCount: number;
  lastSharedAt: number;
  sampleAuthor: string;
  sampleContent: string;
  views: number | null;
  sales: number | null;
  gmv: number | null;
  engagement: number | null;
  liveSessions: number | null;
};

export type AdminChatBriefingBundle = {
  generatedAt: number;
  window: AdminChatWindow;
  totals: {
    positive: number;
    neutral: number;
    negative: number;
    pending: number;
    classified: number;
    total: number;
  };
  health: {
    score: number;
    delta: AdminChatBriefingMetricDelta;
    summary: string;
    drivers: Array<{
      label: string;
      value: number;
      detail: string;
    }>;
    nextAction: string;
  };
  sentimentByChannel: Array<{
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
  flaggedChannels: Array<{
    channelId: string;
    channelName: string;
    negativeRate: number;
    classifiedNegativeRate: number;
    negativeDelta: number;
    messageCount: number;
    pendingCount: number;
    reason: string;
    contributingMessages: Array<{
      id: string;
      channelId: string;
      channelName: string;
      author: string;
      content: string;
      rationale: string;
      createdAt: number;
      label: "negative";
      confidence: number;
      provider: string;
      keywords: string[];
      reviewStatus: "pending" | "resolved";
    }>;
  }>;
  pendingReviewByChannel: Array<{
    channelId: string;
    channelName: string;
    pendingReviewCount: number;
    classifiedNegativeCount: number;
    latestMessageAt: number | null;
    examples: Array<{
      id: string;
      author: string;
      content: string;
      createdAt: number;
    }>;
  }>;
  creatorActivity: {
    activeCount: number;
    inactiveCount: number;
    activeCreators: Array<{
      userId: string;
      displayName: string;
      username: string;
      avatarUrl: string | null;
      activityCount: number;
      lastActiveAt: number;
      detail: string;
    }>;
    inactiveCreators: Array<{
      userId: string;
      displayName: string;
      username: string;
      avatarUrl: string | null;
      activityCount: number;
      lastActiveAt: number;
      detail: string;
    }>;
  };
  topSharedTikToks: Array<{
    url: string;
    shareCount: number;
    creatorCount: number;
    lastSharedAt: number;
    creators: string[];
    channels: string[];
    sampleAuthor: string;
    sampleContent: string;
  }>;
  topContent: AdminChatTopContentItem[];
  weekOverWeek: {
    healthScore: AdminChatBriefingMetricDelta;
    activeUsers: AdminChatBriefingMetricDelta;
    inactiveUsers: AdminChatBriefingMetricDelta;
    totalTikTokLinks: AdminChatBriefingMetricDelta;
    uniqueTikTokPosters: AdminChatBriefingMetricDelta;
    negativeMessageRate: AdminChatBriefingMetricDelta;
    channelsNeedingAttention: AdminChatBriefingMetricDelta;
  };
  flaggedMessages: Array<{
    id: string;
    channelId: string;
    channelName: string;
    author: string;
    content: string;
    rationale: string;
    createdAt: number;
    label: "negative";
    confidence: number;
    provider: string;
    keywords: string[];
    reviewStatus: "pending" | "resolved";
  }>;
};

export type AdminChatGuardrails = {
  readOnly: true;
  toolsUsed: string[];
};

export type AdminChatRequest = {
  question: string;
  conversationId?: string;
  context?: {
    window?: AdminChatWindow;
    channelId?: string;
  };
};

export type AdminChatResponse = {
  answer: string;
  citations: AdminChatCitation[];
  evidence: {
    briefing?: AdminChatBriefingBundle;
    messages?: AdminChatEvidenceMessage[];
    sql?: {
      tables: string[];
      rowCount: number;
      truncated: boolean;
      rows: Array<Record<string, string | number | boolean | null>>;
    };
  };
  guardrails: AdminChatGuardrails;
};

export type AdminChatStreamEvent =
  | {
      type: "meta";
      citations: AdminChatCitation[];
      evidence: AdminChatResponse["evidence"];
      guardrails: AdminChatGuardrails;
    }
  | {
      type: "text";
      value: string;
    }
  | {
      type: "done";
    }
  | {
      type: "error";
      message: string;
    };
