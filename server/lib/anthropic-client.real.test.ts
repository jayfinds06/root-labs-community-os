import { describe, expect, test } from "bun:test";
import { createSentimentClient } from "./anthropic-client";

describe("createSentimentClient (real Anthropic)", () => {
  test("classifies an obviously positive message via the live Anthropic client", async () => {
    const apiKey = process.env.ANTHROPIC_API_KEY;

    if (!apiKey) {
      console.warn("[anthropic.real-test] skipped: missing ANTHROPIC_API_KEY");
      return;
    }

    const client = createSentimentClient(apiKey);
    const result = await client.classifyContent(
      "Thank you, this fixed the issue and everything works perfectly now.",
    );

    expect(result).toBeTruthy();
    expect(result?.provider).toBe("anthropic");
    expect(result?.label).toBe("positive");
    expect(typeof result?.confidence).toBe("number");
    expect(result!.confidence).toBeGreaterThanOrEqual(0);
    expect(result!.confidence).toBeLessThanOrEqual(100);
    expect(Array.isArray(result?.keywords)).toBe(true);
    expect(result!.keywords.length).toBeGreaterThan(0);
    expect(typeof result?.rationale).toBe("string");
    expect(result!.rationale.length).toBeGreaterThan(0);
  });
});
