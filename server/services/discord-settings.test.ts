import { beforeEach, describe, expect, mock, test } from "bun:test";

const settingsStore = new Map<string, string>();
let requestedKey = "";

const insertValuesMock = mock((input: {
  key: string;
  value: string;
}) => ({
  onConflictDoUpdate: async (_config: unknown) => {
    settingsStore.set(input.key, input.value);
  },
}));

const dbMock = {
  select: () => ({
    from: () => ({
      where: () => ({
        get: async () => {
          const value = settingsStore.get(requestedKey);
          if (value === undefined) return undefined;
          return { value };
        },
      }),
    }),
  }),
  insert: () => ({
    values: insertValuesMock,
  }),
};

mock.module("../db/client", () => ({
  db: dbMock,
  sqliteClient: {
    query: () => ({
      all: () => [],
    }),
  },
}));

mock.module("../db/schema", () => ({
  appSettings: {
    value: "value",
    key: "key",
  },
}));

mock.module("drizzle-orm", () => ({
  eq: (_left: unknown, right: unknown) => {
    requestedKey = String(right);
    return "eq";
  },
}));

const {
  getAdminChatAllowRawDataAccess,
  saveAdminChatAllowRawDataAccess,
} = await import("./discord-settings");

describe("discord-settings", () => {
  beforeEach(() => {
    settingsStore.clear();
    requestedKey = "";
    insertValuesMock.mockClear();
  });

  test("raw data access defaults to false", async () => {
    const result = await getAdminChatAllowRawDataAccess();
    expect(result).toBe(false);
  });

  test("invalid stored raw data access values normalize to false", async () => {
    settingsStore.set("adminChat.allowRawDataAccess", "maybe");

    const result = await getAdminChatAllowRawDataAccess();
    expect(result).toBe(false);
  });

  test("raw data access persists and reads back", async () => {
    await saveAdminChatAllowRawDataAccess(true);

    expect(insertValuesMock).toHaveBeenCalled();
    settingsStore.clear();
    settingsStore.set("adminChat.allowRawDataAccess", "true");

    const result = await getAdminChatAllowRawDataAccess();
    expect(result).toBe(true);
  });
});
