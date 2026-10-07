import { describe, expect, mock, test } from "bun:test";

const answerQuestionMock = mock(async (input: {
  insufficientEvidence?: boolean;
  citations: unknown[];
  evidence: unknown;
  guardrails: { toolsUsed: string[]; readOnly: true };
}) => ({
  answer: input.insufficientEvidence ? "insufficient" : "ok",
  citations: input.citations,
  evidence: input.evidence,
  guardrails: input.guardrails,
}));

mock.module("../config", () => ({
  getDiscordOpsConfig: () => ({ anthropicApiKey: "test-key" }),
}));

const getAdminChatAllowRawDataAccessMock = mock(async () => false);
const generateAdminChatSqlMock = mock(async () => "SELECT id, content FROM discord_messages ORDER BY created_at DESC");
const executeAdminChatSqlMock = mock(async () => ({
  summary: {
    tables: ["discord_messages"],
    rowCount: 1,
    truncated: false,
  },
  rows: [
    {
      id: "sql-1",
      content: "raw row",
    },
  ],
}));

mock.module("../lib/admin-chat-client", () => ({
  createAdminChatClient: () => ({
    answerQuestion: answerQuestionMock,
  }),
}));

mock.module("./discord-settings", () => ({
  getAdminChatAllowRawDataAccess: getAdminChatAllowRawDataAccessMock,
}));

mock.module("./admin-chat-sql", () => ({
  generateAdminChatSql: generateAdminChatSqlMock,
  executeAdminChatSql: executeAdminChatSqlMock,
}));

const buildAdminChatBriefingBundleMock = mock(async (input?: { window?: string }) => ({
  generatedAt: 100,
  window: input?.window ?? "7d",
  totals: {
    positive: 143,
    neutral: 51,
    negative: 69,
    pending: 4,
    classified: 263,
    total: 267,
  },
  health: {
    score: 59,
    delta: { delta: -6, pct: -9.2 },
    summary: "Health blends activity, TikTok sharing, sentiment, and flagged-channel pressure.",
    drivers: [
      { label: "Activity trend", value: 82, detail: "+4.5% week over week." },
      { label: "Message trend", value: 76, detail: "-2.1% week over week." },
      { label: "Sentiment score", value: 58, detail: "69 negative across 263 classified messages." },
    ],
    nextAction: "Start in #creator-lounge and clear the unresolved negative queue.",
  },
  sentimentByChannel: [
    {
      channelId: "channel-1",
      channelName: "#creator-lounge",
      total: 18,
      positive: 1,
      neutral: 3,
      negative: 10,
      pending: 4,
      classifiedTotal: 14,
      negativePct: 55.6,
      classifiedNegativePct: 71.4,
      riskScore: 81,
    },
    {
      channelId: "channel-2",
      channelName: "#wins",
      total: 12,
      positive: 8,
      neutral: 3,
      negative: 1,
      pending: 0,
      classifiedTotal: 12,
      negativePct: 8.3,
      classifiedNegativePct: 8.3,
      riskScore: 10,
    },
  ],
  keywordShifts: [
    { keyword: "sample", current: 12, previous: 4, delta: 8 },
    { keyword: "shipping", current: 9, previous: 2, delta: 7 },
    { keyword: "live", current: 6, previous: 4, delta: 2 },
  ],
  flaggedChannels: [
    {
      channelId: "channel-1",
      channelName: "#creator-lounge",
      negativeRate: 55.6,
      classifiedNegativeRate: 71.4,
      negativeDelta: 18.2,
      messageCount: 18,
      pendingCount: 4,
      reason: "Negative share jumped +18.2 pts week over week and unresolved complaints are clustering in the channel.",
      contributingMessages: [
        {
          id: "m-1",
          channelId: "channel-1",
          channelName: "#creator-lounge",
          author: "alex",
          content: "Samples are still stuck and no one replied.",
          rationale: "Direct complaint about an unresolved workflow.",
          createdAt: 1710,
          label: "negative",
          confidence: 91,
          provider: "Anthropic Claude Haiku 4.5",
          keywords: ["sample", "stuck"],
          reviewStatus: "pending",
        },
      ],
    },
  ],
  pendingReviewByChannel: [
    {
      channelId: "channel-1",
      channelName: "#creator-lounge",
      pendingReviewCount: 3,
      classifiedNegativeCount: 2,
      latestMessageAt: 1710,
      examples: [
        {
          id: "m-1",
          author: "alex",
          content: "Samples are still stuck and no one replied.",
          createdAt: 1710,
        },
      ],
    },
  ],
  creatorActivity: {
    activeCount: 12,
    inactiveCount: 5,
    activeCreators: [
      {
        userId: "user-1",
        displayName: "Maya",
        username: "maya",
        avatarUrl: null,
        activityCount: 14,
        lastActiveAt: 1710,
        detail: "14 messages, most active in #wins.",
      },
    ],
    inactiveCreators: [
      {
        userId: "user-2",
        displayName: "Jordan",
        username: "jordan",
        avatarUrl: null,
        activityCount: 22,
        lastActiveAt: 1600,
        detail: "22 historical messages before going quiet.",
      },
    ],
  },
  topSharedTikToks: [
    {
      url: "https://www.tiktok.com/@maya/video/1",
      shareCount: 4,
      creatorCount: 2,
      lastSharedAt: 1710,
      creators: ["Maya", "Ari"],
      channels: ["#wins", "#announcements"],
      sampleAuthor: "Maya",
      sampleContent: "This TikTok format is working right now.",
    },
  ],
  topContent: [
    {
      source: "discord-link-shares",
      url: "https://www.tiktok.com/@maya/video/1",
      shareCount: 4,
      creatorCount: 2,
      lastSharedAt: 1710,
      sampleAuthor: "Maya",
      sampleContent: "This TikTok format is working right now.",
      views: null,
      sales: null,
      gmv: null,
      engagement: null,
      liveSessions: null,
    },
  ],
  weekOverWeek: {
    healthScore: { current: 59, delta: -6, pct: -9.2 },
    activeUsers: { current: 12, delta: 2, pct: 20 },
    inactiveUsers: { current: 5, delta: 1, pct: 25 },
    totalTikTokLinks: { current: 11, delta: 3, pct: 37.5 },
    uniqueTikTokPosters: { current: 6, delta: 1, pct: 20 },
    negativeMessageRate: { current: 26, delta: 8, pct: 44.4 },
    channelsNeedingAttention: { current: 1, delta: 1, pct: 100 },
  },
  flaggedMessages: [
    {
      id: "m-1",
      channelId: "channel-1",
      channelName: "#creator-lounge",
      author: "alex",
      content: "Samples are still stuck and no one replied.",
      rationale: "Direct complaint about an unresolved workflow.",
      createdAt: 1710,
      label: "negative",
      confidence: 91,
      provider: "Anthropic Claude Haiku 4.5",
      keywords: ["sample", "stuck"],
      reviewStatus: "pending",
    },
  ],
}));

mock.module("./admin-chat-briefing", () => ({
  buildAdminChatBriefingBundle: buildAdminChatBriefingBundleMock,
}));

const { answerAdminChat } = await import("./admin-chat");

describe("answerAdminChat", () => {
  test("injects the full briefing bundle for broad status questions", async () => {
    const response = await answerAdminChat({
      question: "What is the current health of Discord operations?",
    });

    expect(response.answer).toBe("ok");
    expect(response.guardrails.toolsUsed).toEqual([
      "briefing",
      "overview",
      "sentiment-channels",
      "sentiment-messages",
    ]);
    expect(response.citations.map((citation) => citation.source)).toEqual([
      "overview",
      "sentiment/channels",
      "overview",
      "sentiment/messages",
    ]);
    expect(response.evidence.briefing?.health.score).toBe(59);
    expect(response.evidence.briefing?.topContent[0]?.source).toBe("discord-link-shares");
  });

  test("still includes flagged message evidence for announcement questions", async () => {
    const response = await answerAdminChat({
      question: "What should I post in announcements today?",
    });

    expect(response.answer).toBe("ok");
    expect(response.evidence.messages?.[0]?.channelName).toBe("#creator-lounge");
    expect(response.evidence.briefing?.topSharedTikToks[0]?.url).toContain("tiktok.com");
  });

  test("uses raw SQL fallback when examples are requested and the briefing is empty", async () => {
    getAdminChatAllowRawDataAccessMock.mockImplementationOnce(async () => true);
    buildAdminChatBriefingBundleMock.mockImplementationOnce(async () => ({
        generatedAt: 100,
        window: "7d",
        totals: {
          positive: 0,
          neutral: 0,
          negative: 0,
          pending: 0,
          classified: 0,
          total: 0,
        },
        health: {
          score: 0,
          delta: { delta: 0, pct: 0 },
          summary: "No data.",
          drivers: [],
          nextAction: "No action.",
        },
        sentimentByChannel: [],
        keywordShifts: [],
        flaggedChannels: [],
        pendingReviewByChannel: [],
        creatorActivity: {
          activeCount: 0,
          inactiveCount: 0,
          activeCreators: [],
          inactiveCreators: [],
        },
        topSharedTikToks: [],
        topContent: [],
        weekOverWeek: {
          healthScore: { current: 0, delta: 0, pct: 0 },
          activeUsers: { current: 0, delta: 0, pct: 0 },
          inactiveUsers: { current: 0, delta: 0, pct: 0 },
          totalTikTokLinks: { current: 0, delta: 0, pct: 0 },
          uniqueTikTokPosters: { current: 0, delta: 0, pct: 0 },
          negativeMessageRate: { current: 0, delta: 0, pct: 0 },
          channelsNeedingAttention: { current: 0, delta: 0, pct: 0 },
        },
        flaggedMessages: [],
      }));

    const response = await answerAdminChat({
      question: "Show me recent message examples about the current issue.",
    });

    expect(response.answer).toBe("ok");
    expect(generateAdminChatSqlMock).toHaveBeenCalled();
    expect(executeAdminChatSqlMock).toHaveBeenCalled();
    expect(response.guardrails.toolsUsed).toContain("sql:discord-raw");
    expect(response.citations.some((citation) => citation.source === "sql")).toBe(true);
  });
});
