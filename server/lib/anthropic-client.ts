import { createAnthropic } from "@ai-sdk/anthropic";
import { generateObject } from "ai";
import { z } from "zod";

const SENTIMENT_MODEL_ID = "claude-haiku-4-5";
const MAX_KEYWORDS = 5;

export const sentimentLabels = ["positive", "neutral", "negative"] as const;

export type SentimentLabel = (typeof sentimentLabels)[number];

export type SentimentResult = {
  label: SentimentLabel;
  confidence: number;
  keywords: string[];
  rationale: string;
  provider: string;
};

export type SentimentClient = {
  classifyContent: (content: string) => Promise<SentimentResult | null>;
};

const clampConfidence = (value: number): number => {
  return Math.min(100, Math.max(0, Math.round(value)));
};

const dedupeKeywords = (keywords: string[]): string[] => {
  return Array.from(new Set(keywords)).slice(0, MAX_KEYWORDS);
};

export const normalizeSentimentContent = (content: string): string => {
  return content.trim();
};

export const normalizeSentimentKeywords = (keywords: string[]): string[] => {
  const normalized = keywords
    .map((keyword) => keyword.trim().toLowerCase())
    .filter(Boolean);
  return dedupeKeywords(normalized);
};

const toSentimentResult = (input: {
  label?: string;
  confidence?: number;
  keywords?: string[];
  rationale?: string;
}): SentimentResult | null => {
  if (
    input.label !== "positive" &&
    input.label !== "neutral" &&
    input.label !== "negative"
  ) {
    return null;
  }

  return {
    label: input.label,
    confidence: clampConfidence(input.confidence ?? 60),
    keywords: normalizeSentimentKeywords(input.keywords ?? []),
    rationale: input.rationale?.trim() || "Model classification completed.",
    provider: "anthropic",
  };
};

const sentimentSchema = z.object({
  label: z.enum(sentimentLabels),
  confidence: z.number().min(0).max(100).optional(),
  keywords: z.array(z.string()).max(MAX_KEYWORDS).optional(),
  rationale: z.string().optional(),
});

export const createSentimentClient = (apiKey: string): SentimentClient => {
  const anthropic = createAnthropic({ apiKey });

  return {
    classifyContent: async (content: string): Promise<SentimentResult | null> => {
      const normalizedContent = normalizeSentimentContent(content);
      if (!normalizedContent) {
        return null;
      }

      try {
        const { object } = await generateObject({
          model: anthropic(SENTIMENT_MODEL_ID),
          schema: sentimentSchema,
          temperature: 0,
          system:
            "You classify Discord community messages by sentiment. Keep keywords short, specific, and limited to the message itself.",
          prompt: [
            "Classify the following Discord message.",
            "Use positive for praise, thanks, or successful outcomes.",
            "Use negative for frustration, complaints, bugs, or support pain.",
            "Use neutral for informational, ambiguous, or mixed messages.",
            `Return up to ${MAX_KEYWORDS} keywords.`,
            `Message: ${normalizedContent}`,
          ].join("\n"),
        });

        return toSentimentResult(object);
      } catch (error) {
        console.error("[sentiment.ai-sdk] classification failed", {
          model: SENTIMENT_MODEL_ID,
          messageLength: normalizedContent.length,
          error: error instanceof Error ? error.message : String(error),
        });
        throw error;
      }
    },
  };
};
