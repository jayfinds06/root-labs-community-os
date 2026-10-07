import type {
  ExplorerResourceKey,
  SentimentLabel,
  SentimentMessageSort,
  SentimentWindow,
} from "./utils/api";

export type DashboardSearch = {
  tab: "overview" | "explorer" | "settings";
  explorerView?: "datasets" | "people";
  resource?: ExplorerResourceKey;
  rowId?: string;
  userId?: string;
  q?: string;
  sentimentLabel?: Exclude<SentimentLabel, "all">;
};

export type SentimentRouteSearch = {
  window: SentimentWindow;
  label: SentimentLabel;
  channel: string;
  q: string;
  sort: SentimentMessageSort;
  cursor: string;
};

const explorerResourceOptions: ExplorerResourceKey[] = [
  "discord-guilds",
  "discord-channels",
  "discord-members",
  "discord-messages",
  "channel-hourly-snapshots",
  "channel-daily-snapshots",
  "overview-snapshots",
];

const sentimentLabelOptions: Array<Exclude<SentimentLabel, "all">> = [
  "positive",
  "neutral",
  "negative",
  "pending",
];

const getSearchValue = (
  input: Record<string, unknown> | URLSearchParams,
  key: string,
): string | undefined => {
  if (input instanceof URLSearchParams) {
    return input.get(key) ?? undefined;
  }

  const value = input[key];
  return typeof value === "string" ? value : undefined;
};

const decodeSearchString = (value: string | undefined): string | undefined => {
  const trimmed = value?.trim();
  if (!trimmed) {
    return undefined;
  }

  if (trimmed.startsWith("\"") && trimmed.endsWith("\"")) {
    try {
      const parsed = JSON.parse(trimmed) as unknown;
      return typeof parsed === "string" ? parsed.trim() : trimmed;
    } catch {
      return trimmed.slice(1, -1).trim();
    }
  }

  return trimmed;
};

const normalizeOptionalString = (value: string | undefined): string | undefined => {
  const trimmed = decodeSearchString(value);
  if (!trimmed || trimmed === "undefined" || trimmed === "null") {
    return undefined;
  }
  return trimmed;
};

export const normalizeDashboardSearch = (
  input: Record<string, unknown> | URLSearchParams,
): DashboardSearch => {
  const tabValue = getSearchValue(input, "tab");
  const resourceValue = getSearchValue(input, "resource");
  const rowId = normalizeOptionalString(getSearchValue(input, "rowId")) ?? "";
  const q = normalizeOptionalString(getSearchValue(input, "q")) ?? "";
  const sentimentLabel = getSearchValue(input, "sentimentLabel");

  return {
    tab:
      tabValue === "explorer" || tabValue === "settings"
        ? tabValue
        : "overview",
    explorerView:
      getSearchValue(input, "explorerView") === "people"
        ? "people"
        : getSearchValue(input, "explorerView") === "datasets"
          ? "datasets"
          : undefined,
    resource: explorerResourceOptions.includes(resourceValue as ExplorerResourceKey)
      ? (resourceValue as ExplorerResourceKey)
      : undefined,
    rowId: rowId || undefined,
    userId: normalizeOptionalString(getSearchValue(input, "userId")),
    q: q || undefined,
    sentimentLabel: sentimentLabelOptions.includes(sentimentLabel as Exclude<SentimentLabel, "all">)
      ? (sentimentLabel as Exclude<SentimentLabel, "all">)
      : undefined,
  };
};

export const normalizeSentimentSearch = (
  input: Record<string, unknown> | URLSearchParams,
): SentimentRouteSearch => {
  const windowValue = normalizeOptionalString(getSearchValue(input, "window"));
  const labelValue = normalizeOptionalString(getSearchValue(input, "label"));
  const channelValue = normalizeOptionalString(getSearchValue(input, "channel"));
  const qValue = normalizeOptionalString(getSearchValue(input, "q"));
  const sortValue = normalizeOptionalString(getSearchValue(input, "sort"));
  const cursorValue = normalizeOptionalString(getSearchValue(input, "cursor"));

  return {
    window: windowValue === "24h" || windowValue === "14d" ? windowValue : "7d",
    label:
      labelValue === "positive" ||
      labelValue === "neutral" ||
      labelValue === "negative" ||
      labelValue === "pending"
        ? labelValue
        : "all",
    channel: channelValue || "all",
    q: qValue || "",
    sort: sortValue === "risk" ? "risk" : "newest",
    cursor: cursorValue || "",
  };
};
