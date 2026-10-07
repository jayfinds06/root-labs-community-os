import { and, desc, eq, gte, like, lt, or, sql } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import { db } from "../db/client";
import {
  channelDailySnapshots,
  channelHourlySnapshots,
  discordChannels,
  discordGuilds,
  discordMembers,
  discordMessages,
  messageSentiment,
  overviewSnapshots,
} from "../db/schema";
import { endOfLocalDayFromInput, startOfLocalDayFromInput } from "./dashboard";

export type ExplorerResourceKey =
  | "discord-guilds"
  | "discord-channels"
  | "discord-members"
  | "discord-messages"
  | "channel-hourly-snapshots"
  | "channel-daily-snapshots"
  | "overview-snapshots";

type ExplorerValue = string | number | boolean | null | string[];

export type ExplorerResourceDefinition = {
  key: ExplorerResourceKey;
  label: string;
  description: string;
  defaultSort: { field: string; dir: "desc" };
  allowedIncludes: string[];
  columns: Array<{
    key: string;
    label: string;
    type: "string" | "number" | "boolean" | "datetime" | "json";
    defaultVisible: boolean;
  }>;
  filters: Array<{
    key: string;
    label: string;
    type: "text" | "boolean" | "datetime" | "select";
    param: string;
    options?: Array<{ value: string; label: string }>;
  }>;
};

export type ExplorerResourcesResponse = {
  generatedAt: number;
  resources: ExplorerResourceDefinition[];
};

export type ExplorerListResponse = {
  resource: ExplorerResourceKey;
  generatedAt: number;
  items: Array<{
    id: string;
    values: Record<string, ExplorerValue>;
  }>;
  pageInfo: {
    limit: number;
    nextCursor: string | null;
    hasNextPage: boolean;
  };
};

export type ExplorerDetailResponse = {
  resource: ExplorerResourceKey;
  generatedAt: number;
  item: {
    id: string;
    values: Record<string, ExplorerValue>;
    joins: Record<string, Record<string, ExplorerValue> | null>;
  } | null;
};

type CursorPayload = {
  value: string | number | null;
  id: number;
};

const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 50;

const resourceDefinitions: ExplorerResourceDefinition[] = [
  {
    key: "discord-guilds",
    label: "Guilds",
    description: "Tracked Discord guild metadata.",
    defaultSort: { field: "updatedAt", dir: "desc" },
    allowedIncludes: [],
    columns: [
      { key: "name", label: "Name", type: "string", defaultVisible: true },
      { key: "discordGuildId", label: "Discord ID", type: "string", defaultVisible: true },
      { key: "lastBackfillAt", label: "Last Backfill", type: "datetime", defaultVisible: true },
      { key: "updatedAt", label: "Updated", type: "datetime", defaultVisible: true },
    ],
    filters: [{ key: "q", label: "Search", type: "text", param: "q" }],
  },
  {
    key: "discord-channels",
    label: "Channels",
    description: "Monitored channel inventory.",
    defaultSort: { field: "updatedAt", dir: "desc" },
    allowedIncludes: ["guild"],
    columns: [
      { key: "name", label: "Channel", type: "string", defaultVisible: true },
      { key: "guildName", label: "Guild", type: "string", defaultVisible: true },
      { key: "isMonitored", label: "Monitored", type: "boolean", defaultVisible: true },
      { key: "discordChannelId", label: "Discord ID", type: "string", defaultVisible: true },
      { key: "updatedAt", label: "Updated", type: "datetime", defaultVisible: true },
    ],
    filters: [
      { key: "q", label: "Search", type: "text", param: "q" },
      { key: "guildId", label: "Guild ID", type: "text", param: "guildId" },
      {
        key: "isMonitored",
        label: "Monitored",
        type: "select",
        param: "isMonitored",
        options: [
          { value: "true", label: "Yes" },
          { value: "false", label: "No" },
        ],
      },
    ],
  },
  {
    key: "discord-members",
    label: "Members",
    description: "Known message authors and member profiles.",
    defaultSort: { field: "updatedAt", dir: "desc" },
    allowedIncludes: ["guild"],
    columns: [
      { key: "displayName", label: "Display Name", type: "string", defaultVisible: true },
      { key: "username", label: "Username", type: "string", defaultVisible: true },
      { key: "guildName", label: "Guild", type: "string", defaultVisible: true },
      { key: "isBot", label: "Bot", type: "boolean", defaultVisible: true },
      { key: "updatedAt", label: "Updated", type: "datetime", defaultVisible: true },
    ],
    filters: [
      { key: "q", label: "Search", type: "text", param: "q" },
      { key: "guildId", label: "Guild ID", type: "text", param: "guildId" },
      {
        key: "isBot",
        label: "Bot",
        type: "select",
        param: "isBot",
        options: [
          { value: "true", label: "Yes" },
          { value: "false", label: "No" },
        ],
      },
    ],
  },
  {
    key: "discord-messages",
    label: "Messages",
    description: "Ingested messages with sentiment context.",
    defaultSort: { field: "createdAt", dir: "desc" },
    allowedIncludes: ["guild", "channel", "author", "sentiment"],
    columns: [
      { key: "createdAt", label: "Created", type: "datetime", defaultVisible: true },
      { key: "channelName", label: "Channel", type: "string", defaultVisible: true },
      { key: "authorName", label: "Author", type: "string", defaultVisible: true },
      { key: "label", label: "Sentiment", type: "string", defaultVisible: true },
      { key: "provider", label: "Provider", type: "string", defaultVisible: true },
      { key: "contentPreview", label: "Preview", type: "string", defaultVisible: true },
    ],
    filters: [
      { key: "q", label: "Search", type: "text", param: "q" },
      { key: "guildId", label: "Guild ID", type: "text", param: "guildId" },
      { key: "channelId", label: "Channel", type: "select", param: "channelId" },
      { key: "authorId", label: "Author ID", type: "text", param: "authorId" },
      { key: "from", label: "From", type: "datetime", param: "from" },
      { key: "to", label: "To", type: "datetime", param: "to" },
      {
        key: "sentimentLabel",
        label: "Sentiment",
        type: "select",
        param: "sentimentLabel",
        options: [
          { value: "positive", label: "Positive" },
          { value: "neutral", label: "Neutral" },
          { value: "negative", label: "Negative" },
          { value: "pending", label: "Pending" },
        ],
      },
      {
        key: "isDeleted",
        label: "Deleted",
        type: "select",
        param: "isDeleted",
        options: [
          { value: "true", label: "Yes" },
          { value: "false", label: "No" },
        ],
      },
    ],
  },
  {
    key: "channel-hourly-snapshots",
    label: "Hourly",
    description: "Per-channel hourly rollups.",
    defaultSort: { field: "bucketStart", dir: "desc" },
    allowedIncludes: ["channel", "guild"],
    columns: [
      { key: "bucketStart", label: "Bucket", type: "datetime", defaultVisible: true },
      { key: "channelName", label: "Channel", type: "string", defaultVisible: true },
      { key: "messageCount", label: "Messages", type: "number", defaultVisible: true },
      { key: "activeUserCount", label: "Users", type: "number", defaultVisible: true },
      { key: "negativeCount", label: "Negative", type: "number", defaultVisible: true },
    ],
    filters: [
      { key: "guildId", label: "Guild ID", type: "text", param: "guildId" },
      { key: "channelId", label: "Channel", type: "select", param: "channelId" },
      { key: "from", label: "From", type: "datetime", param: "from" },
      { key: "to", label: "To", type: "datetime", param: "to" },
    ],
  },
  {
    key: "channel-daily-snapshots",
    label: "Daily",
    description: "Per-channel daily rollups.",
    defaultSort: { field: "bucketStart", dir: "desc" },
    allowedIncludes: ["channel", "guild"],
    columns: [
      { key: "bucketStart", label: "Bucket", type: "datetime", defaultVisible: true },
      { key: "channelName", label: "Channel", type: "string", defaultVisible: true },
      { key: "messageCount", label: "Messages", type: "number", defaultVisible: true },
      { key: "activeUserCount", label: "Users", type: "number", defaultVisible: true },
      { key: "negativeCount", label: "Negative", type: "number", defaultVisible: true },
    ],
    filters: [
      { key: "guildId", label: "Guild ID", type: "text", param: "guildId" },
      { key: "channelId", label: "Channel", type: "select", param: "channelId" },
      { key: "from", label: "From", type: "datetime", param: "from" },
      { key: "to", label: "To", type: "datetime", param: "to" },
    ],
  },
  {
    key: "overview-snapshots",
    label: "Overview",
    description: "Computed overview summary buckets.",
    defaultSort: { field: "bucketStart", dir: "desc" },
    allowedIncludes: [],
    columns: [
      { key: "granularity", label: "Granularity", type: "string", defaultVisible: true },
      { key: "bucketStart", label: "Bucket", type: "datetime", defaultVisible: true },
      { key: "totalMessages", label: "Messages", type: "number", defaultVisible: true },
      { key: "activeUsers", label: "Users", type: "number", defaultVisible: true },
      { key: "healthScore", label: "Health", type: "number", defaultVisible: true },
    ],
    filters: [
      { key: "from", label: "From", type: "datetime", param: "from" },
      { key: "to", label: "To", type: "datetime", param: "to" },
      {
        key: "granularity",
        label: "Granularity",
        type: "select",
        param: "granularity",
        options: [
          { value: "hourly", label: "Hourly" },
          { value: "daily", label: "Daily" },
        ],
      },
    ],
  },
];

const resourceMap = new Map(resourceDefinitions.map((item) => [item.key, item]));

const parseLimit = (searchParams: URLSearchParams): number => {
  const value = Number(searchParams.get("limit") ?? DEFAULT_LIMIT);
  if (!Number.isFinite(value) || value <= 0) return DEFAULT_LIMIT;
  return Math.min(MAX_LIMIT, value);
};

const parseBoolean = (value: string | null): boolean | null => {
  if (value === "true") return true;
  if (value === "false") return false;
  return null;
};

const encodeCursor = (payload: CursorPayload): string => {
  return Buffer.from(JSON.stringify(payload)).toString("base64url");
};

const decodeCursor = (value: string | null): CursorPayload | null => {
  if (!value) return null;
  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as CursorPayload;
    if (typeof parsed.id !== "number") return null;
    return parsed;
  } catch {
    return null;
  }
};

const buildCursorCondition = (
  sortColumn: unknown,
  idColumn: unknown,
  cursor: CursorPayload | null,
): SQL<unknown> | undefined => {
  if (!cursor) return undefined;
  return sql`(${sortColumn} < ${cursor.value} OR (${sortColumn} = ${cursor.value} AND ${idColumn} < ${cursor.id}))`;
};

const buildTextSearch = (columns: unknown[], query: string | null): SQL<unknown> | undefined => {
  if (!query) return undefined;
  const normalized = `%${query}%`;
  const clauses = columns.map((column) => like(column as never, normalized));
  return or(...clauses);
};

const toPreview = (value: string | null | undefined): string => {
  const normalized = (value ?? "").trim();
  if (!normalized) return "(empty)";
  return normalized.length > 120 ? `${normalized.slice(0, 117)}...` : normalized;
};

const fromDate = (value: Date | null | undefined): number | null => {
  return value ? value.getTime() : null;
};

const getResource = (resource: string | null): ExplorerResourceDefinition => {
  const found = resource ? resourceMap.get(resource as ExplorerResourceKey) : null;
  if (!found) {
    throw new Error("Unknown explorer resource.");
  }
  return found;
};

const getChannelFilterOptions = async (): Promise<Array<{ value: string; label: string }>> => {
  const rows = await db.select({
    id: discordChannels.id,
    name: discordChannels.name,
    guildName: discordGuilds.name,
    isMonitored: discordChannels.isMonitored,
  })
    .from(discordChannels)
    .innerJoin(discordGuilds, eq(discordGuilds.id, discordChannels.guildId))
    .orderBy(desc(discordChannels.isMonitored), discordGuilds.name, discordChannels.name)
    .all();

  return rows.map((item) => ({
    value: String(item.id),
    label: `${item.name} (${item.guildName})${item.isMonitored ? "" : " · unmonitored"}`,
  }));
};

export const getExplorerResources = async (): Promise<ExplorerResourcesResponse> => {
  const channelOptions = await getChannelFilterOptions();

  return {
    generatedAt: Date.now(),
    resources: resourceDefinitions.map((resource) => ({
      ...resource,
      filters: resource.filters.map((filter) =>
        filter.param === "channelId"
          ? { ...filter, options: channelOptions }
          : filter
      ),
    })),
  };
};

export const getExplorerList = async (
  resourceKey: string | null,
  searchParams: URLSearchParams,
): Promise<ExplorerListResponse> => {
  const resource = getResource(resourceKey);
  const limit = parseLimit(searchParams);
  const cursor = decodeCursor(searchParams.get("cursor"));
  const q = searchParams.get("q");
  const from = startOfLocalDayFromInput(searchParams.get("from") ?? "");
  const to = endOfLocalDayFromInput(searchParams.get("to") ?? "");

  if (resource.key === "discord-guilds") {
    const where = and(
      buildTextSearch([discordGuilds.name, discordGuilds.discordGuildId], q),
      buildCursorCondition(discordGuilds.updatedAt, discordGuilds.id, cursor),
    );
    const rows = await db.select().from(discordGuilds)
      .where(where)
      .orderBy(desc(discordGuilds.updatedAt), desc(discordGuilds.id))
      .limit(limit + 1)
      .all();
    const hasNextPage = rows.length > limit;
    const visibleRows = hasNextPage ? rows.slice(0, limit) : rows;
    return {
      resource: resource.key,
      generatedAt: Date.now(),
      items: visibleRows.map((item) => ({
        id: String(item.id),
        values: {
          name: item.name,
          discordGuildId: item.discordGuildId,
          lastBackfillAt: fromDate(item.lastBackfillAt),
          updatedAt: fromDate(item.updatedAt),
        },
      })),
      pageInfo: {
        limit,
        nextCursor: hasNextPage
          ? encodeCursor({ value: visibleRows[visibleRows.length - 1]!.updatedAt.getTime(), id: visibleRows[visibleRows.length - 1]!.id })
          : null,
        hasNextPage,
      },
    };
  }

  if (resource.key === "discord-channels") {
    const guildId = searchParams.get("guildId");
    const isMonitored = parseBoolean(searchParams.get("isMonitored"));
    const where = and(
      buildTextSearch([discordChannels.name, discordChannels.discordChannelId, discordGuilds.name], q),
      guildId ? eq(discordChannels.guildId, Number(guildId)) : undefined,
      isMonitored === null ? undefined : eq(discordChannels.isMonitored, isMonitored),
      buildCursorCondition(discordChannels.updatedAt, discordChannels.id, cursor),
    );
    const rows = await db.select({
      id: discordChannels.id,
      name: discordChannels.name,
      discordChannelId: discordChannels.discordChannelId,
      isMonitored: discordChannels.isMonitored,
      updatedAt: discordChannels.updatedAt,
      guildName: discordGuilds.name,
    })
      .from(discordChannels)
      .innerJoin(discordGuilds, eq(discordGuilds.id, discordChannels.guildId))
      .where(where)
      .orderBy(desc(discordChannels.updatedAt), desc(discordChannels.id))
      .limit(limit + 1)
      .all();
    const hasNextPage = rows.length > limit;
    const visibleRows = hasNextPage ? rows.slice(0, limit) : rows;
    return {
      resource: resource.key,
      generatedAt: Date.now(),
      items: visibleRows.map((item) => ({
        id: String(item.id),
        values: {
          name: item.name,
          guildName: item.guildName,
          isMonitored: item.isMonitored,
          discordChannelId: item.discordChannelId,
          updatedAt: fromDate(item.updatedAt),
        },
      })),
      pageInfo: {
        limit,
        nextCursor: hasNextPage
          ? encodeCursor({ value: visibleRows[visibleRows.length - 1]!.updatedAt.getTime(), id: visibleRows[visibleRows.length - 1]!.id })
          : null,
        hasNextPage,
      },
    };
  }

  if (resource.key === "discord-members") {
    const guildId = searchParams.get("guildId");
    const isBot = parseBoolean(searchParams.get("isBot"));
    const where = and(
      buildTextSearch([discordMembers.displayName, discordMembers.username, discordGuilds.name], q),
      guildId ? eq(discordMembers.guildId, Number(guildId)) : undefined,
      isBot === null ? undefined : eq(discordMembers.isBot, isBot),
      buildCursorCondition(discordMembers.updatedAt, discordMembers.id, cursor),
    );
    const rows = await db.select({
      id: discordMembers.id,
      displayName: discordMembers.displayName,
      username: discordMembers.username,
      isBot: discordMembers.isBot,
      updatedAt: discordMembers.updatedAt,
      guildName: discordGuilds.name,
    })
      .from(discordMembers)
      .innerJoin(discordGuilds, eq(discordGuilds.id, discordMembers.guildId))
      .where(where)
      .orderBy(desc(discordMembers.updatedAt), desc(discordMembers.id))
      .limit(limit + 1)
      .all();
    const hasNextPage = rows.length > limit;
    const visibleRows = hasNextPage ? rows.slice(0, limit) : rows;
    return {
      resource: resource.key,
      generatedAt: Date.now(),
      items: visibleRows.map((item) => ({
        id: String(item.id),
        values: {
          displayName: item.displayName ?? item.username,
          username: item.username,
          guildName: item.guildName,
          isBot: item.isBot,
          updatedAt: fromDate(item.updatedAt),
        },
      })),
      pageInfo: {
        limit,
        nextCursor: hasNextPage
          ? encodeCursor({ value: visibleRows[visibleRows.length - 1]!.updatedAt.getTime(), id: visibleRows[visibleRows.length - 1]!.id })
          : null,
        hasNextPage,
      },
    };
  }

  if (resource.key === "discord-messages") {
    const guildId = searchParams.get("guildId");
    const channelId = searchParams.get("channelId");
    const authorId = searchParams.get("authorId");
    const sentimentLabel = searchParams.get("sentimentLabel");
    const isDeleted = parseBoolean(searchParams.get("isDeleted"));
    const where = and(
      buildTextSearch([
        discordMessages.content,
        discordChannels.name,
        discordMembers.displayName,
        discordMembers.username,
      ], q),
      guildId ? eq(discordMessages.guildId, Number(guildId)) : undefined,
      channelId ? eq(discordMessages.channelId, Number(channelId)) : undefined,
      authorId ? eq(discordMessages.authorId, Number(authorId)) : undefined,
      from !== null ? gte(discordMessages.createdAt, new Date(from)) : undefined,
      to !== null ? lt(discordMessages.createdAt, new Date(to)) : undefined,
      sentimentLabel === "pending"
        ? sql`${messageSentiment.label} is null`
        : sentimentLabel
          ? eq(messageSentiment.label, sentimentLabel)
          : undefined,
      isDeleted === null
        ? undefined
        : isDeleted
          ? sql`${discordMessages.deletedAt} is not null`
          : sql`${discordMessages.deletedAt} is null`,
      buildCursorCondition(discordMessages.createdAt, discordMessages.id, cursor),
    );
    const rows = await db.select({
      id: discordMessages.id,
      createdAt: discordMessages.createdAt,
      content: discordMessages.content,
      deletedAt: discordMessages.deletedAt,
      channelName: discordChannels.name,
      authorName: discordMembers.displayName,
      username: discordMembers.username,
      label: messageSentiment.label,
      provider: messageSentiment.provider,
    })
      .from(discordMessages)
      .innerJoin(discordChannels, eq(discordChannels.id, discordMessages.channelId))
      .innerJoin(discordMembers, eq(discordMembers.id, discordMessages.authorId))
      .leftJoin(messageSentiment, eq(messageSentiment.messageId, discordMessages.id))
      .where(where)
      .orderBy(desc(discordMessages.createdAt), desc(discordMessages.id))
      .limit(limit + 1)
      .all();
    const hasNextPage = rows.length > limit;
    const visibleRows = hasNextPage ? rows.slice(0, limit) : rows;
    return {
      resource: resource.key,
      generatedAt: Date.now(),
      items: visibleRows.map((item) => ({
        id: String(item.id),
        values: {
          createdAt: fromDate(item.createdAt),
          channelName: item.channelName,
          authorName: item.authorName ?? item.username,
          label: item.label ?? "pending",
          provider: item.provider ?? "pending",
          isDeleted: Boolean(item.deletedAt),
          contentPreview: toPreview(item.content),
        },
      })),
      pageInfo: {
        limit,
        nextCursor: hasNextPage
          ? encodeCursor({ value: visibleRows[visibleRows.length - 1]!.createdAt.getTime(), id: visibleRows[visibleRows.length - 1]!.id })
          : null,
        hasNextPage,
      },
    };
  }

  if (resource.key === "channel-hourly-snapshots" || resource.key === "channel-daily-snapshots") {
    const table = resource.key === "channel-hourly-snapshots" ? channelHourlySnapshots : channelDailySnapshots;
    const guildId = searchParams.get("guildId");
    const channelId = searchParams.get("channelId");
    const where = and(
      guildId ? eq(discordChannels.guildId, Number(guildId)) : undefined,
      channelId ? eq(table.channelId, Number(channelId)) : undefined,
      from !== null ? gte(table.bucketStart, new Date(from)) : undefined,
      to !== null ? lt(table.bucketStart, new Date(to)) : undefined,
      buildCursorCondition(table.bucketStart, table.id, cursor),
    );
    const rows = await db.select({
      id: table.id,
      bucketStart: table.bucketStart,
      messageCount: table.messageCount,
      activeUserCount: table.activeUserCount,
      positiveCount: table.positiveCount,
      neutralCount: table.neutralCount,
      negativeCount: table.negativeCount,
      channelName: discordChannels.name,
      guildName: discordGuilds.name,
    })
      .from(table)
      .innerJoin(discordChannels, eq(discordChannels.id, table.channelId))
      .innerJoin(discordGuilds, eq(discordGuilds.id, discordChannels.guildId))
      .where(where)
      .orderBy(desc(table.bucketStart), desc(table.id))
      .limit(limit + 1)
      .all();
    const hasNextPage = rows.length > limit;
    const visibleRows = hasNextPage ? rows.slice(0, limit) : rows;
    return {
      resource: resource.key,
      generatedAt: Date.now(),
      items: visibleRows.map((item) => ({
        id: String(item.id),
        values: {
          bucketStart: fromDate(item.bucketStart),
          channelName: item.channelName,
          guildName: item.guildName,
          messageCount: item.messageCount,
          activeUserCount: item.activeUserCount,
          positiveCount: item.positiveCount,
          neutralCount: item.neutralCount,
          negativeCount: item.negativeCount,
        },
      })),
      pageInfo: {
        limit,
        nextCursor: hasNextPage
          ? encodeCursor({ value: visibleRows[visibleRows.length - 1]!.bucketStart.getTime(), id: visibleRows[visibleRows.length - 1]!.id })
          : null,
        hasNextPage,
      },
    };
  }

  const granularity = searchParams.get("granularity");
  const where = and(
    granularity ? eq(overviewSnapshots.granularity, granularity) : undefined,
    from !== null ? gte(overviewSnapshots.bucketStart, new Date(from)) : undefined,
    to !== null ? lt(overviewSnapshots.bucketStart, new Date(to)) : undefined,
    buildCursorCondition(overviewSnapshots.bucketStart, overviewSnapshots.id, cursor),
  );
  const rows = await db.select().from(overviewSnapshots)
    .where(where)
    .orderBy(desc(overviewSnapshots.bucketStart), desc(overviewSnapshots.id))
    .limit(limit + 1)
    .all();
  const hasNextPage = rows.length > limit;
  const visibleRows = hasNextPage ? rows.slice(0, limit) : rows;
  return {
    resource: resource.key,
    generatedAt: Date.now(),
    items: visibleRows.map((item) => ({
      id: String(item.id),
      values: {
        granularity: item.granularity,
        bucketStart: fromDate(item.bucketStart),
        totalMessages: item.totalMessages,
        activeUsers: item.activeUsers,
        negativeRate: item.negativeRate,
        healthScore: item.healthScore,
      },
    })),
    pageInfo: {
      limit,
      nextCursor: hasNextPage
        ? encodeCursor({ value: visibleRows[visibleRows.length - 1]!.bucketStart.getTime(), id: visibleRows[visibleRows.length - 1]!.id })
        : null,
      hasNextPage,
    },
  };
};

export const getExplorerDetail = async (
  resourceKey: string | null,
  rowId: string | null,
): Promise<ExplorerDetailResponse> => {
  const resource = getResource(resourceKey);
  const id = Number(rowId);
  if (!Number.isFinite(id)) {
    throw new Error("Invalid explorer row id.");
  }

  if (resource.key === "discord-guilds") {
    const item = await db.select().from(discordGuilds).where(eq(discordGuilds.id, id)).get();
    return {
      resource: resource.key,
      generatedAt: Date.now(),
      item: item
        ? {
          id: String(item.id),
          values: {
            name: item.name,
            discordGuildId: item.discordGuildId,
            lastBackfillAt: fromDate(item.lastBackfillAt),
            createdAt: fromDate(item.createdAt),
            updatedAt: fromDate(item.updatedAt),
          },
          joins: {},
        }
        : null,
    };
  }

  if (resource.key === "discord-channels") {
    const item = await db.select({
      id: discordChannels.id,
      name: discordChannels.name,
      discordChannelId: discordChannels.discordChannelId,
      isMonitored: discordChannels.isMonitored,
      createdAt: discordChannels.createdAt,
      updatedAt: discordChannels.updatedAt,
      guildId: discordGuilds.id,
      guildName: discordGuilds.name,
      discordGuildId: discordGuilds.discordGuildId,
    })
      .from(discordChannels)
      .innerJoin(discordGuilds, eq(discordGuilds.id, discordChannels.guildId))
      .where(eq(discordChannels.id, id))
      .get();
    return {
      resource: resource.key,
      generatedAt: Date.now(),
      item: item
        ? {
          id: String(item.id),
          values: {
            name: item.name,
            discordChannelId: item.discordChannelId,
            isMonitored: item.isMonitored,
            createdAt: fromDate(item.createdAt),
            updatedAt: fromDate(item.updatedAt),
          },
          joins: {
            guild: {
              id: item.guildId,
              name: item.guildName,
              discordGuildId: item.discordGuildId,
            },
          },
        }
        : null,
    };
  }

  if (resource.key === "discord-members") {
    const item = await db.select({
      id: discordMembers.id,
      displayName: discordMembers.displayName,
      username: discordMembers.username,
      discordUserId: discordMembers.discordUserId,
      avatarUrl: discordMembers.avatarUrl,
      isBot: discordMembers.isBot,
      createdAt: discordMembers.createdAt,
      updatedAt: discordMembers.updatedAt,
      guildId: discordGuilds.id,
      guildName: discordGuilds.name,
      discordGuildId: discordGuilds.discordGuildId,
    })
      .from(discordMembers)
      .innerJoin(discordGuilds, eq(discordGuilds.id, discordMembers.guildId))
      .where(eq(discordMembers.id, id))
      .get();
    return {
      resource: resource.key,
      generatedAt: Date.now(),
      item: item
        ? {
          id: String(item.id),
          values: {
            displayName: item.displayName ?? item.username,
            username: item.username,
            discordUserId: item.discordUserId,
            avatarUrl: item.avatarUrl,
            isBot: item.isBot,
            createdAt: fromDate(item.createdAt),
            updatedAt: fromDate(item.updatedAt),
          },
          joins: {
            guild: {
              id: item.guildId,
              name: item.guildName,
              discordGuildId: item.discordGuildId,
            },
          },
        }
        : null,
    };
  }

  if (resource.key === "discord-messages") {
    const item = await db.select({
      id: discordMessages.id,
      discordMessageId: discordMessages.discordMessageId,
      content: discordMessages.content,
      rawJson: discordMessages.rawJson,
      createdAt: discordMessages.createdAt,
      editedAt: discordMessages.editedAt,
      deletedAt: discordMessages.deletedAt,
      guildId: discordGuilds.id,
      guildName: discordGuilds.name,
      channelId: discordChannels.id,
      channelName: discordChannels.name,
      authorId: discordMembers.id,
      authorName: discordMembers.displayName,
      username: discordMembers.username,
      label: messageSentiment.label,
      confidence: messageSentiment.confidence,
      rationale: messageSentiment.rationale,
      provider: messageSentiment.provider,
      keywordsJson: messageSentiment.keywordsJson,
      classifiedAt: messageSentiment.classifiedAt,
    })
      .from(discordMessages)
      .innerJoin(discordGuilds, eq(discordGuilds.id, discordMessages.guildId))
      .innerJoin(discordChannels, eq(discordChannels.id, discordMessages.channelId))
      .innerJoin(discordMembers, eq(discordMembers.id, discordMessages.authorId))
      .leftJoin(messageSentiment, eq(messageSentiment.messageId, discordMessages.id))
      .where(eq(discordMessages.id, id))
      .get();
    return {
      resource: resource.key,
      generatedAt: Date.now(),
      item: item
        ? {
          id: String(item.id),
          values: {
            discordMessageId: item.discordMessageId,
            content: item.content,
            rawJson: item.rawJson,
            createdAt: fromDate(item.createdAt),
            editedAt: fromDate(item.editedAt),
            deletedAt: fromDate(item.deletedAt),
          },
          joins: {
            guild: {
              id: item.guildId,
              name: item.guildName,
            },
            channel: {
              id: item.channelId,
              name: item.channelName,
            },
            author: {
              id: item.authorId,
              name: item.authorName ?? item.username,
              username: item.username,
            },
            sentiment: item.label
              ? {
                label: item.label,
                confidence: item.confidence ?? 0,
                rationale: item.rationale,
                provider: item.provider,
                keywordsJson: item.keywordsJson,
                classifiedAt: fromDate(item.classifiedAt),
              }
              : null,
          },
        }
        : null,
    };
  }

  if (resource.key === "channel-hourly-snapshots" || resource.key === "channel-daily-snapshots") {
    const table = resource.key === "channel-hourly-snapshots" ? channelHourlySnapshots : channelDailySnapshots;
    const item = await db.select({
      id: table.id,
      bucketStart: table.bucketStart,
      messageCount: table.messageCount,
      activeUserCount: table.activeUserCount,
      positiveCount: table.positiveCount,
      neutralCount: table.neutralCount,
      negativeCount: table.negativeCount,
      updatedAt: table.updatedAt,
      channelId: discordChannels.id,
      channelName: discordChannels.name,
      guildId: discordGuilds.id,
      guildName: discordGuilds.name,
    })
      .from(table)
      .innerJoin(discordChannels, eq(discordChannels.id, table.channelId))
      .innerJoin(discordGuilds, eq(discordGuilds.id, discordChannels.guildId))
      .where(eq(table.id, id))
      .get();
    return {
      resource: resource.key,
      generatedAt: Date.now(),
      item: item
        ? {
          id: String(item.id),
          values: {
            bucketStart: fromDate(item.bucketStart),
            messageCount: item.messageCount,
            activeUserCount: item.activeUserCount,
            positiveCount: item.positiveCount,
            neutralCount: item.neutralCount,
            negativeCount: item.negativeCount,
            updatedAt: fromDate(item.updatedAt),
          },
          joins: {
            channel: {
              id: item.channelId,
              name: item.channelName,
            },
            guild: {
              id: item.guildId,
              name: item.guildName,
            },
          },
        }
        : null,
    };
  }

  const item = await db.select().from(overviewSnapshots).where(eq(overviewSnapshots.id, id)).get();
  return {
    resource: resource.key,
    generatedAt: Date.now(),
    item: item
      ? {
        id: String(item.id),
        values: {
          granularity: item.granularity,
          bucketStart: fromDate(item.bucketStart),
          totalMessages: item.totalMessages,
          activeUsers: item.activeUsers,
          negativeRate: item.negativeRate,
          healthScore: item.healthScore,
          updatedAt: fromDate(item.updatedAt),
        },
        joins: {},
      }
      : null,
  };
};
