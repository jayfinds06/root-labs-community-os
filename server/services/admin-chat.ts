import { getDiscordOpsConfig } from "../config";
import { createAdminChatClient } from "../lib/admin-chat-client";
import type {
  AdminChatRequest,
  AdminChatResponse,
  AdminChatWindow,
} from "../../shared/admin-chat";
import { buildAdminChatBriefingBundle } from "./admin-chat-briefing";
import { executeAdminChatSql, generateAdminChatSql } from "./admin-chat-sql";
import { getAdminChatAllowRawDataAccess } from "./discord-settings";

export type AdminChatContext = {
  citations: AdminChatResponse["citations"];
  evidence: AdminChatResponse["evidence"];
  guardrails: AdminChatResponse["guardrails"];
};

const inferWindow = (
  question: string,
  requestedWindow?: AdminChatWindow,
): AdminChatWindow => {
  if (requestedWindow) {
    return requestedWindow;
  }
  if (/24h|24 hours|today|last day/i.test(question)) {
    return "24h";
  }
  if (/14d|14 days|two weeks|fortnight/i.test(question)) {
    return "14d";
  }
  return "7d";
};

const sanitizeMessageContent = (value: string): string => {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= 280) {
    return normalized;
  }
  return `${normalized.slice(0, 277)}...`;
};

const buildSqlContextSummary = (
  input: AdminChatResponse["evidence"],
): Record<string, unknown> => {
  return {
    briefing: input.briefing ?? {},
    messages: input.messages?.slice(0, 3) ?? [],
  };
};

const buildSqlEvidence = async (
  question: string,
  evidence: AdminChatResponse["evidence"],
): Promise<AdminChatResponse["evidence"]["sql"] | null> => {
  const config = getDiscordOpsConfig();

  try {
    const proposedSql = await generateAdminChatSql(config.anthropicApiKey, {
      question,
      contextSummary: buildSqlContextSummary(evidence),
    });
    if (!proposedSql) {
      return null;
    }

    const result = await executeAdminChatSql(proposedSql);
    return {
      tables: result.summary.tables,
      rowCount: result.summary.rowCount,
      truncated: result.summary.truncated,
      rows: result.rows,
    };
  } catch (error) {
    console.error("[admin.chat] raw sql retrieval failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
};

const buildChatContext = async (
  input: AdminChatRequest,
): Promise<AdminChatContext & { insufficientEvidence: boolean }> => {
  const window = inferWindow(input.question, input.context?.window);
  const briefing = await buildAdminChatBriefingBundle({ window });
  const toolsUsed = [
    "briefing",
    "overview",
    "sentiment-channels",
    "sentiment-messages",
  ];

  const response: AdminChatResponse = {
    answer: "",
    citations: [
      {
        source: "overview",
        label: "Briefing health and creator activity",
        generatedAt: briefing.generatedAt,
        meta: {
          window: briefing.window,
          healthScore: briefing.health.score,
          activeCreators: briefing.creatorActivity.activeCount,
          inactiveCreators: briefing.creatorActivity.inactiveCount,
          topContentItems: briefing.topContent.length,
        },
      },
      {
        source: "sentiment/channels",
        label: "Channel sentiment and keyword shifts",
        generatedAt: briefing.generatedAt,
        meta: {
          window: briefing.window,
          total: briefing.totals.total,
          negative: briefing.totals.negative,
          pending: briefing.totals.pending,
        },
      },
      {
        source: "overview",
        label: "Creator activity and top content",
        generatedAt: briefing.generatedAt,
        meta: {
          activeCreators: briefing.creatorActivity.activeCount,
          inactiveCreators: briefing.creatorActivity.inactiveCount,
          topContentItems: briefing.topContent.length,
          topContentSource: briefing.topContent[0]?.source ?? "none",
        },
      },
      {
        source: "sentiment/messages",
        label: "Flagged message evidence",
        generatedAt: briefing.generatedAt,
        meta: {
          window: briefing.window,
          count: briefing.flaggedMessages.length,
        },
      },
    ],
    evidence: {
      briefing,
      messages: briefing.flaggedMessages.slice(0, 6).map((item) => ({
        id: item.id,
        channelName: item.channelName,
        author: item.author,
        content: sanitizeMessageContent(item.content),
        createdAt: item.createdAt,
        label: item.label,
      })),
    },
    guardrails: {
      readOnly: true,
      toolsUsed,
    },
  };

  const asksForExamples = /example|examples|message|messages|quote|quotes|raw|show me/i.test(
    input.question,
  );
  let insufficientEvidence =
    briefing.sentimentByChannel.length === 0 &&
    briefing.flaggedMessages.length === 0 &&
    briefing.creatorActivity.activeCreators.length === 0 &&
    briefing.creatorActivity.inactiveCreators.length === 0 &&
    briefing.topContent.length === 0;

  if (asksForExamples && response.evidence.messages?.length === 0) {
    insufficientEvidence = true;
  }

  const allowRawDataAccess = await getAdminChatAllowRawDataAccess();
  if (allowRawDataAccess && insufficientEvidence) {
    const sqlEvidence = await buildSqlEvidence(input.question, response.evidence);
    if (sqlEvidence) {
      toolsUsed.push("sql:discord-raw");
      response.citations.push({
        source: "sql",
        label: "Raw SQL query summary",
        meta: {
          tables: sqlEvidence.tables.join(", "),
          rows: sqlEvidence.rowCount,
          truncated: sqlEvidence.truncated,
        },
      });
      response.evidence.sql = sqlEvidence;
      insufficientEvidence = false;
    }
  }

  return {
    citations: response.citations,
    evidence: response.evidence,
    guardrails: response.guardrails,
    insufficientEvidence,
  };
};

export const answerAdminChat = async (
  input: AdminChatRequest,
): Promise<AdminChatResponse> => {
  const prepared = await buildChatContext(input);
  const config = getDiscordOpsConfig();
  const client = createAdminChatClient(config.anthropicApiKey);

  return client.answerQuestion({
    question: input.question,
    citations: prepared.citations,
    evidence: prepared.evidence,
    guardrails: prepared.guardrails,
    insufficientEvidence: prepared.insufficientEvidence,
  });
};

export const answerAdminChatStream = async (
  input: AdminChatRequest,
): Promise<{
  context: AdminChatContext;
  stream: AsyncIterable<string>;
}> => {
  const prepared = await buildChatContext(input);
  const config = getDiscordOpsConfig();
  const client = createAdminChatClient(config.anthropicApiKey);
  const stream = await client.answerQuestionStream({
    question: input.question,
    citations: prepared.citations,
    evidence: prepared.evidence,
    guardrails: prepared.guardrails,
    insufficientEvidence: prepared.insufficientEvidence,
  });

  return {
    context: {
      citations: prepared.citations,
      evidence: prepared.evidence,
      guardrails: prepared.guardrails,
    },
    stream,
  };
};
