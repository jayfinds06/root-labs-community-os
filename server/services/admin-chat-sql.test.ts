import { beforeEach, describe, expect, mock, test } from "bun:test";

const generateObjectMock = mock(async () => ({
  object: {
    sql: "SELECT id, content FROM discord_messages ORDER BY created_at DESC",
  },
}));

const anthropicModelMock = mock((modelId: string) => ({ modelId }));
const createAnthropicMock = mock(() => anthropicModelMock);
const queryAllMock = mock(() => [
  { id: "m-1", content: "hello" },
]);
const queryMock = mock(() => ({
  all: queryAllMock,
}));

mock.module("ai", () => ({
  generateObject: generateObjectMock,
}));

mock.module("@ai-sdk/anthropic", () => ({
  createAnthropic: createAnthropicMock,
}));

mock.module("../db/client", () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => ({
          get: async () => undefined,
        }),
      }),
    }),
    insert: () => ({
      values: () => ({
        onConflictDoUpdate: async () => undefined,
      }),
    }),
  },
  sqliteClient: {
    query: queryMock,
  },
}));

const {
  executeAdminChatSql,
  generateAdminChatSql,
} = await import("./admin-chat-sql");

describe("admin-chat-sql", () => {
  beforeEach(() => {
    generateObjectMock.mockClear();
    anthropicModelMock.mockClear();
    createAnthropicMock.mockClear();
    queryMock.mockClear();
    queryAllMock.mockClear();
    queryAllMock.mockImplementation(() => [{ id: "m-1", content: "hello" }]);
  });

  test("generates a read-only SQL statement with Anthropic when configured", async () => {
    const sql = await generateAdminChatSql("test-key", {
      question: "Show the latest stored messages.",
      contextSummary: { healthScore: 90 },
    });

    expect(sql).toBe("SELECT id, content FROM discord_messages ORDER BY created_at DESC");
    expect(createAnthropicMock).toHaveBeenCalledWith({ apiKey: "test-key" });
    expect(anthropicModelMock).toHaveBeenCalledWith("claude-haiku-4-5");
    const prompt = generateObjectMock.mock.calls[0]?.[0]?.prompt;
    expect(String(prompt)).toContain("\"schemaMap\"");
    expect(String(prompt)).toContain("\"author_id\"");
    expect(String(prompt)).toContain("\"discord_user_id\"");
    expect(String(prompt)).toContain("\"joinGuide\"");
    expect(String(prompt)).toContain("\"tableGuide\"");
    expect(String(prompt)).toContain("\"queryExamples\"");
  });

  test("returns null without Anthropic config", async () => {
    const sql = await generateAdminChatSql(null, {
      question: "Show the latest stored messages.",
    });

    expect(sql).toBeNull();
    expect(generateObjectMock).not.toHaveBeenCalled();
  });

  test("executes allowlisted select queries and returns normalized rows", async () => {
    const result = await executeAdminChatSql(
      "SELECT id, content FROM discord_messages ORDER BY created_at DESC LIMIT 5",
    );

    expect(queryMock).toHaveBeenCalled();
    expect(result.summary.tables).toEqual(["discord_messages"]);
    expect(result.summary.rowCount).toBe(1);
    expect(result.summary.truncated).toBe(false);
    expect(result.rows[0]).toEqual({ id: "m-1", content: "hello" });
  });

  test("rejects denied tables", async () => {
    await expect(executeAdminChatSql("SELECT id FROM user")).rejects.toThrow(
      "Table user is not allowed.",
    );
  });

  test("rejects mutating statements", async () => {
    await expect(
      executeAdminChatSql("DELETE FROM discord_messages WHERE id = '1'"),
    ).rejects.toThrow("Only SELECT statements are allowed.");
  });

  test("rejects multiple statements", async () => {
    await expect(
      executeAdminChatSql("SELECT id FROM discord_messages; SELECT id FROM discord_channels"),
    ).rejects.toThrow("Multiple SQL statements are not allowed.");
  });

  test("truncates oversized result sets", async () => {
    queryAllMock.mockImplementationOnce(() =>
      Array.from({ length: 26 }, (_, index) => ({
        id: `m-${index + 1}`,
      })),
    );

    const result = await executeAdminChatSql("SELECT id FROM discord_messages");

    expect(result.summary.rowCount).toBe(25);
    expect(result.summary.truncated).toBe(true);
    expect(result.rows).toHaveLength(25);
  });
});
