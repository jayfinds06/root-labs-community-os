import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { db } from "../db/client";
import { discordChannels, discordMessages, messageSentiment } from "../db/schema";
import {
  createSentimentClient,
  normalizeSentimentContent,
  type SentimentClient,
  type SentimentResult,
} from "../lib/anthropic-client";

const sentimentClients = new Map<string, SentimentClient>();
const nonEmptyDiscordMessage = sql`length(trim(${discordMessages.content})) > 0`; // Exclude empty ingested messages from sentiment backlog/classification.
const CLASSIFICATION_CONCURRENCY = 5;
const RATE_LIMIT_MAX_RETRIES = 5;
const RATE_LIMIT_BASE_DELAY_MS = 1500;

const getSentimentClient = (apiKey: string): SentimentClient => {
  const existingClient = sentimentClients.get(apiKey);
  if (existingClient) {
    return existingClient;
  }

  const client = createSentimentClient(apiKey);
  sentimentClients.set(apiKey, client);
  return client;
};

export const classifyContent = async (
  content: string,
  apiKey: string | null,
): Promise<SentimentResult | null> => {
  const normalizedContent = normalizeSentimentContent(content);

  if (!normalizedContent) {
    return null;
  }

  if (!apiKey) {
    return null;
  }

  const client = getSentimentClient(apiKey);
  return client.classifyContent(normalizedContent);
};

const isRateLimitError = (error: unknown): boolean => {
  if (!error || typeof error !== "object") {
    return false;
  }

  const maybeError = error as {
    statusCode?: number;
    status?: number;
    cause?: { statusCode?: number; status?: number; message?: string };
    message?: string;
  };

  return (
    maybeError.statusCode === 429 ||
    maybeError.status === 429 ||
    maybeError.cause?.statusCode === 429 ||
    maybeError.cause?.status === 429 ||
    maybeError.message?.includes("429") === true ||
    maybeError.message?.toLowerCase().includes("rate limit") === true ||
    maybeError.cause?.message?.toLowerCase().includes("rate limit") === true
  );
};

const sleep = async (ms: number): Promise<void> => {
  await new Promise((resolve) => setTimeout(resolve, ms));
};

const classifyWithRetry = async (
  content: string,
  apiKey: string | null,
  messageId: number,
): Promise<SentimentResult | null> => {
  for (let attempt = 0; attempt <= RATE_LIMIT_MAX_RETRIES; attempt += 1) {
    try {
      return await classifyContent(content, apiKey);
    } catch (error) {
      if (!isRateLimitError(error) || attempt === RATE_LIMIT_MAX_RETRIES) {
        throw error;
      }

      const delayMs = RATE_LIMIT_BASE_DELAY_MS * 2 ** attempt;
      console.warn("[sentiment.classify] rate limited; retrying", {
        messageId,
        attempt: attempt + 1,
        delayMs,
      });
      await sleep(delayMs);
    }
  }

  return null;
};

export const classifyPendingMessages = async (
  apiKey: string | null,
  limit = 25,
): Promise<{
  processed: number;
  pendingBefore: number;
  pendingAfter: number;
  selected: number;
  limit: number;
  classifier: "anthropic" | "heuristic";
  skipReason: string | null;
}> => {
  const pendingBeforeRow = await db
    .select({ value: sql<number>`count(*)` })
    .from(discordMessages)
    .leftJoin(messageSentiment, eq(messageSentiment.messageId, discordMessages.id))
    .where(and(isNull(messageSentiment.id), isNull(discordMessages.deletedAt), nonEmptyDiscordMessage))
    .get();

  const pending = await db
    .select({
      id: discordMessages.id,
      content: discordMessages.content,
    })
    .from(discordMessages)
    .leftJoin(messageSentiment, eq(messageSentiment.messageId, discordMessages.id))
    .where(and(isNull(messageSentiment.id), isNull(discordMessages.deletedAt), nonEmptyDiscordMessage))
    .orderBy(desc(discordMessages.createdAt))
    .limit(limit)
    .all();

  const classifier = apiKey ? "anthropic" : "heuristic";
  const pendingBefore = pendingBeforeRow?.value ?? 0;

  if (!apiKey) {
    return {
      processed: 0,
      pendingBefore,
      pendingAfter: pendingBefore,
      selected: 0,
      limit,
      classifier,
      skipReason: "missing_api_key",
    };
  }

  if (pending.length === 0) {
    return {
      processed: 0,
      pendingBefore,
      pendingAfter: pendingBefore,
      selected: 0,
      limit,
      classifier,
      skipReason: pendingBefore === 0 ? "no_pending_messages" : "no_selectable_messages",
    };
  }

  let processed = 0;
  let failed = 0;

  for (let index = 0; index < pending.length; index += CLASSIFICATION_CONCURRENCY) {
    const batch = pending.slice(index, index + CLASSIFICATION_CONCURRENCY);

    const batchResults = await Promise.all(
      batch.map(async (item) => {
        try {
          const result = await classifyWithRetry(item.content, apiKey, item.id);
          if (!result) {
            failed += 1;
            console.error("[sentiment.classify] message classification returned null", {
              messageId: item.id,
              contentPreview: item.content.slice(0, 160),
            });
            return;
          }

          const now = new Date();
          await db.insert(messageSentiment).values({
            messageId: item.id,
            label: result.label,
            confidence: result.confidence,
            keywordsJson: JSON.stringify(result.keywords),
            rationale: result.rationale,
            provider: result.provider,
            classifiedAt: now,
          }).onConflictDoUpdate({
            target: messageSentiment.messageId,
            set: {
              label: result.label,
              confidence: result.confidence,
              keywordsJson: JSON.stringify(result.keywords),
              rationale: result.rationale,
              provider: result.provider,
              classifiedAt: now,
            },
          });

          processed += 1;
        } catch (error) {
          failed += 1;
          console.error("[sentiment.classify] message classification failed", {
            messageId: item.id,
            contentPreview: item.content.slice(0, 160),
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }),
    );

    void batchResults;
  }

  const pendingAfterRow = await db
    .select({ value: sql<number>`count(*)` })
    .from(discordMessages)
    .leftJoin(messageSentiment, eq(messageSentiment.messageId, discordMessages.id))
    .where(and(isNull(messageSentiment.id), isNull(discordMessages.deletedAt), nonEmptyDiscordMessage))
    .get();

  return {
    processed,
    pendingBefore,
    pendingAfter: pendingAfterRow?.value ?? 0,
    selected: pending.length,
    limit,
    classifier,
    skipReason: processed === 0 && failed > 0 ? "classification_failed" : null,
  };
};

export type SentimentBacklogStats = {
  pendingCount: number;
  oldestPendingCreatedAt: number | null;
  lastClassifiedAt: number | null;
  topBacklogChannels: Array<{
    channelId: string;
    channelName: string;
    pendingCount: number;
  }>;
};

export const getSentimentBacklogStats = async (): Promise<SentimentBacklogStats> => {
  const [pendingSummary, lastClassified, topBacklogChannels] = await Promise.all([
    db
      .select({
        pendingCount: sql<number>`count(*)`,
        oldestPendingCreatedAt: sql<number | null>`min(${discordMessages.createdAt})`,
      })
      .from(discordMessages)
      .leftJoin(messageSentiment, eq(messageSentiment.messageId, discordMessages.id))
      .where(and(isNull(messageSentiment.id), isNull(discordMessages.deletedAt), nonEmptyDiscordMessage))
      .get(),
    db
      .select({
        classifiedAt: messageSentiment.classifiedAt,
      })
      .from(messageSentiment)
      .orderBy(desc(messageSentiment.classifiedAt))
      .limit(1)
      .get(),
    db
      .select({
        channelId: discordChannels.discordChannelId,
        channelName: discordChannels.name,
        pendingCount: sql<number>`count(*)`,
      })
      .from(discordMessages)
      .innerJoin(discordChannels, eq(discordChannels.id, discordMessages.channelId))
      .leftJoin(messageSentiment, eq(messageSentiment.messageId, discordMessages.id))
      .where(and(isNull(messageSentiment.id), isNull(discordMessages.deletedAt), nonEmptyDiscordMessage))
      .groupBy(discordChannels.discordChannelId, discordChannels.name)
      .orderBy(desc(sql<number>`count(*)`), discordChannels.name)
      .limit(5)
      .all(),
  ]);

  return {
    pendingCount: pendingSummary?.pendingCount ?? 0,
    oldestPendingCreatedAt: pendingSummary?.oldestPendingCreatedAt ?? null,
    lastClassifiedAt: lastClassified?.classifiedAt?.getTime() ?? null,
    topBacklogChannels: topBacklogChannels.map((item) => ({
      channelId: item.channelId,
      channelName: item.channelName,
      pendingCount: item.pendingCount,
    })),
  };
};
