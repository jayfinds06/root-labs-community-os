import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";

const generateObjectMock = mock(async () => ({
  object: {
    label: "positive",
    confidence: 87,
    keywords: ["alpha", "beta", "alpha"],
    rationale: "Strongly positive message.",
  },
}));

const anthropicModelMock = mock((modelId: string) => ({ modelId }));
const createAnthropicMock = mock(() => anthropicModelMock);

mock.module("ai", () => ({
  generateObject: generateObjectMock,
}));

mock.module("@ai-sdk/anthropic", () => ({
  createAnthropic: createAnthropicMock,
}));

const { createSentimentClient } = await import("./anthropic-client");

describe("createSentimentClient", () => {
  beforeEach(() => {
    generateObjectMock.mockClear();
    anthropicModelMock.mockClear();
    createAnthropicMock.mockClear();
  });

  afterEach(() => {
    generateObjectMock.mockImplementation(async () => ({
      object: {
        label: "positive",
        confidence: 87,
        keywords: ["alpha", "beta", "alpha"],
        rationale: "Strongly positive message.",
      },
    }));
  });

  test("returns structured sentiment from the AI SDK response", async () => {
    const client = createSentimentClient("test-key");

    const result = await client.classifyContent("Thanks, this fixed the issue.");

    expect(createAnthropicMock).toHaveBeenCalledWith({ apiKey: "test-key" });
    expect(anthropicModelMock).toHaveBeenCalledWith("claude-haiku-4-5");
    expect(generateObjectMock).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      label: "positive",
      confidence: 87,
      keywords: ["alpha", "beta"],
      rationale: "Strongly positive message.",
      provider: "anthropic",
    });
  });

  test("rethrows when the AI SDK call throws", async () => {
    generateObjectMock.mockImplementationOnce(async () => {
      throw new Error("rate limited");
    });

    const client = createSentimentClient("test-key");
    await expect(client.classifyContent("This is a test message.")).rejects.toThrow("rate limited");
  });

  test("returns null for empty content without calling the model", async () => {
    const client = createSentimentClient("test-key");
    const result = await client.classifyContent("   ");

    expect(result).toBeNull();
    expect(generateObjectMock).not.toHaveBeenCalled();
  });
});
