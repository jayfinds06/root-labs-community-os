import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";

const generateObjectMock = mock(async () => ({
  object: {
    answer: "Post an update that addresses creator-lounge and highlights Maya's TikTok share.",
    insufficientEvidence: false,
  },
}));
const streamTextMock = mock(() => ({
  textStream: (async function* () {
    yield "stream";
  })(),
}));

const anthropicModelMock = mock((modelId: string) => ({ modelId }));
const createAnthropicMock = mock(() => anthropicModelMock);

mock.module("ai", () => ({
  generateObject: generateObjectMock,
  streamText: streamTextMock,
}));

mock.module("@ai-sdk/anthropic", () => ({
  createAnthropic: createAnthropicMock,
}));

const { createAdminChatClient } = await import("./admin-chat-client");

const baseInput = {
  question: "What should I post in announcements today?",
  citations: [{ source: "overview", label: "Briefing health and creator activity" }],
  evidence: {
    briefing: {
      generatedAt: 100,
      window: "7d",
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
        summary: "Health blends activity and channel pressure.",
        drivers: [
          { label: "Activity trend", value: 82, detail: "+4.5% week over week." },
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
      ],
      keywordShifts: [
        { keyword: "sample", current: 12, previous: 4, delta: 8 },
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
          reason: "Complaints are clustering around samples.",
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
        inactiveCreators: [],
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
    },
  },
  guardrails: {
    readOnly: true as const,
    toolsUsed: ["briefing", "overview", "sentiment-channels", "sentiment-messages"],
  },
};

describe("createAdminChatClient", () => {
  beforeEach(() => {
    generateObjectMock.mockClear();
    anthropicModelMock.mockClear();
    createAnthropicMock.mockClear();
  });

  afterEach(() => {
    generateObjectMock.mockImplementation(async () => ({
      object: {
        answer: "Post an update that addresses creator-lounge and highlights Maya's TikTok share.",
        insufficientEvidence: false,
      },
    }));
  });

  test("returns a deterministic briefing answer without Anthropic config", async () => {
    const client = createAdminChatClient(null);
    const result = await client.answerQuestion(baseInput);

    expect(result.answer).toContain("creator-lounge");
    expect(result.answer).toContain("tiktok.com");
    expect(generateObjectMock).not.toHaveBeenCalled();
  });

  test("returns synthesized output when Anthropic is configured", async () => {
    const client = createAdminChatClient("test-key");
    const result = await client.answerQuestion(baseInput);

    expect(createAnthropicMock).toHaveBeenCalledWith({ apiKey: "test-key" });
    expect(anthropicModelMock).toHaveBeenCalledWith("claude-haiku-4-5");
    expect(result.answer).toBe("Post an update that addresses creator-lounge and highlights Maya's TikTok share.");
    const request = generateObjectMock.mock.calls[0]?.[0];
    expect(String(request?.system)).toContain("briefing bundle");
    expect(String(request?.system)).toContain("author_id");
    expect(String(request?.system)).toContain("discord_user_id");
    expect(String(request?.system)).toContain("GMV");
    expect(String(request?.system)).toContain("views");
    expect(String(request?.system)).toContain("vague question");
  });

  test("falls back to a deterministic answer when synthesis throws", async () => {
    generateObjectMock.mockImplementationOnce(async () => {
      throw new Error("provider request failed");
    });

    const client = createAdminChatClient("test-key");
    const result = await client.answerQuestion(baseInput);

    expect(anthropicModelMock).toHaveBeenCalledWith("claude-haiku-4-5");
    expect(result.answer).toContain("creator-lounge");
    expect(result.answer).toContain("tiktok.com");
  });

  test("builds a health answer with drivers and week-over-week movement in fallback mode", async () => {
    const client = createAdminChatClient(null);
    const result = await client.answerQuestion({
      ...baseInput,
      question: "What is driving the health score this week?",
    });

    expect(result.answer).toContain("Health is 59/100.");
    expect(result.answer).toContain("Activity trend");
    expect(result.answer).toContain("Week over week:");
  });
});
