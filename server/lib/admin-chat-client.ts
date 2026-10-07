import { createAnthropic } from "@ai-sdk/anthropic";
import * as aiSdk from "ai";
import { z } from "zod";
import {
  ADMIN_CHAT_SYSTEM_PROMPT,
  buildAdminChatFallbackAnswer,
  buildAdminChatPromptPayload,
  type AdminChatPolicyInput,
} from "../services/admin-chat-policy";

const ADMIN_CHAT_MODEL_ID = "claude-haiku-4-5";

const adminChatSchema = z.object({
  answer: z.string().min(1),
  insufficientEvidence: z.boolean().optional(),
});

export type AdminChatInput = AdminChatPolicyInput;

export type AdminChatResult = {
  answer: string;
  citations: AdminChatInput["citations"];
  evidence: AdminChatInput["evidence"];
  guardrails: AdminChatInput["guardrails"];
};

export type AdminChatClient = {
  answerQuestion: (input: AdminChatInput) => Promise<AdminChatResult>;
  answerQuestionStream: (input: AdminChatInput) => Promise<AsyncIterable<string>>;
};

const TEXT_CHUNK_SIZE = 48;

const streamTextChunks = async function* (
  value: string,
): AsyncGenerator<string> {
  for (let index = 0; index < value.length; index += TEXT_CHUNK_SIZE) {
    yield value.slice(index, index + TEXT_CHUNK_SIZE);
  }
};

const streamFromResponseBody = async function* (
  body: ReadableStream<Uint8Array>,
): AsyncGenerator<string> {
  const decoder = new TextDecoder();
  const reader = body.getReader();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      yield decoder.decode(value, { stream: true });
    }
  } finally {
    reader.releaseLock();
  }
};

const createTextStreamFromString = (value: string): AsyncIterable<string> =>
  streamTextChunks(value || "");

export const createAdminChatClient = (apiKey: string | null): AdminChatClient => {
  const buildFallbackAnswer = (input: AdminChatInput): string =>
    buildAdminChatFallbackAnswer(input);
  const sanitizePromptPayload = (input: AdminChatInput): string =>
    buildAdminChatPromptPayload(input);

  if (!apiKey) {
    return {
      answerQuestion: async (input) => ({
        answer: buildFallbackAnswer(input),
        citations: input.citations,
        evidence: input.evidence,
        guardrails: input.guardrails,
      }),
      answerQuestionStream: async (input) =>
        createTextStreamFromString(buildFallbackAnswer(input)),
    };
  }

  const anthropic = createAnthropic({ apiKey });

  return {
    answerQuestion: async (input) => {
      if (input.insufficientEvidence) {
        return {
          answer: buildFallbackAnswer(input),
          citations: input.citations,
          evidence: input.evidence,
          guardrails: input.guardrails,
        };
      }

      try {
        const { object } = await aiSdk.generateObject({
          model: anthropic(ADMIN_CHAT_MODEL_ID),
          schema: adminChatSchema,
          temperature: 0.2,
          system: ADMIN_CHAT_SYSTEM_PROMPT,
          prompt: sanitizePromptPayload(input),
        });

        return {
          answer: object.answer.trim(),
          citations: input.citations,
          evidence: input.evidence,
          guardrails: input.guardrails,
        };
      } catch (error) {
        console.error("[admin.chat] llm synthesis failed", {
          model: ADMIN_CHAT_MODEL_ID,
          error: error instanceof Error ? error.message : String(error),
        });
        return {
          answer: buildFallbackAnswer(input),
          citations: input.citations,
          evidence: input.evidence,
          guardrails: input.guardrails,
        };
      }
    },
    answerQuestionStream: async (input) => {
      if (input.insufficientEvidence) {
        return createTextStreamFromString(buildFallbackAnswer(input));
      }

      try {
        if (typeof aiSdk.streamText !== "function") {
          return createTextStreamFromString(buildFallbackAnswer(input));
        }

        const streamResult = aiSdk.streamText({
          model: anthropic(ADMIN_CHAT_MODEL_ID),
          temperature: 0.2,
          system: ADMIN_CHAT_SYSTEM_PROMPT,
          prompt: sanitizePromptPayload(input),
        });
        const stream = (
          streamResult as {
            textStream?: AsyncIterable<string>;
            toTextStreamResponse?: () => Response;
          }
        ).textStream;
        if (stream) {
          return stream;
        }

        const toTextStreamResponse = (
          streamResult as { toTextStreamResponse?: () => Response }
        ).toTextStreamResponse;
        if (toTextStreamResponse) {
          const textResponse = toTextStreamResponse();
          if (textResponse.body) {
            return streamFromResponseBody(textResponse.body);
          }
        }

        return createTextStreamFromString(buildFallbackAnswer(input));
      } catch (error) {
        console.error("[admin.chat] llm stream failed", {
          model: ADMIN_CHAT_MODEL_ID,
          error: error instanceof Error ? error.message : String(error),
        });
        return createTextStreamFromString(buildFallbackAnswer(input));
      }
    },
  };
};
