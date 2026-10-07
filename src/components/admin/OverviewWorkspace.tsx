import { useState, type ReactNode } from "react";
import {
  ArrowUpRight,
  CalendarRange,
  CircleHelp,
  Download,
  MessageSquare,
  ShieldAlert,
  Users,
  Waypoints,
} from "lucide-react";
import { DateRangePicker } from "@/components/admin/DateRangePicker";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type {
  OverviewResponse,
  SentimentLabel,
  SentimentChannelsResponse,
  SentimentMessagesResponse,
} from "@/utils/api";

type SurfaceTone = "neutral" | "positive" | "warning" | "critical";

type OverviewWorkspaceProps = {
  overview: OverviewResponse | null;
  loading: boolean;
  error: string;
  sentimentChannels: SentimentChannelsResponse | null;
  sentimentMessages: SentimentMessagesResponse | null;
  overviewRange: {
    from: string;
    to: string;
  };
  onOverviewRangeChange: (
    next:
      | {
          from: string;
          to: string;
        }
      | ((current: { from: string; to: string }) => {
          from: string;
          to: string;
        }),
  ) => void;
  onOpenSentiment: (input?: {
    channelId?: string;
    label?: SentimentLabel;
  }) => void;
};

type DrilldownState =
  | {
      title: string;
      description: string;
      kind: "users";
      items: Array<{
        primary: string;
        avatarUrl?: string | null;
        secondary: string;
        tertiary?: string;
        links?: string[];
      }>;
    }
  | {
      title: string;
      description: string;
      kind: "channels";
      items: Array<{
        channelId: string;
        primary: string;
        secondary: string;
        tertiary?: string;
      }>;
    }
  | {
      title: string;
      description: string;
      kind: "messages";
      items: Array<{
        id: string;
        primary: string;
        secondary: string;
        tertiary?: string;
      }>;
    }
  | {
      title: string;
      description: string;
      kind: "explanation";
      blocks: Array<{
        label: string;
        value: string;
        detail: string;
      }>;
    };

const chipToneStyles: Record<SurfaceTone, string> = {
  neutral: "border-border/70 bg-background/60 text-muted-foreground",
  positive: "border-emerald-500/18 bg-emerald-500/6 text-emerald-50",
  warning: "border-amber-500/18 bg-amber-500/6 text-amber-50",
  critical: "border-red-500/20 bg-red-500/7 text-red-50",
};

const formatTrend = (delta: number, pct: number): string => {
  const direction = delta > 0 ? "+" : delta < 0 ? "-" : "";
  return `${direction}${Math.abs(delta).toLocaleString()} (${pct.toFixed(1)}%)`;
};

const formatTimestamp = (value: number | null): string => {
  if (!value) return "Not available";
  return new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const formatDateRange = (from: number, to: number): string => {
  const start = new Date(from).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
  const end = new Date(Math.max(from, to - 1)).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
  return `${start} - ${end}`;
};

const getInitials = (value: string): string =>
  value
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("") || "?";

const formatLinkLabel = (value: string): string => {
  if (value.length <= 72) return value;
  return `${value.slice(0, 69)}...`;
};

const formatSentimentClassifierDetail = (
  sentiment: {
    provider: string;
    classifiedMessages: number;
  },
): string =>
  `${sentiment.provider}. ${sentiment.classifiedMessages.toLocaleString()} classified messages currently shape the score.`;

const formatSentimentEdgeCases = (
  sentiment: {
    edgeCases: string[];
  },
  limit: number,
): string => sentiment.edgeCases.slice(0, limit).join(" ");

const toFilenamePart = (value: string): string =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "export";

const downloadJson = (filename: string, payload: unknown): void => {
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = "noopener";
  anchor.click();
  URL.revokeObjectURL(url);
};

const getHealthTone = (score: number): SurfaceTone => {
  if (score >= 80) return "positive";
  if (score >= 65) return "warning";
  return "critical";
};

const getBacklogTone = (pendingCount: number): SurfaceTone => {
  if (pendingCount === 0) return "positive";
  if (pendingCount <= 25) return "warning";
  return "critical";
};

const getTrendTone = (delta: number, betterWhenHigher = true): SurfaceTone => {
  if (delta === 0) return "neutral";
  const improved = betterWhenHigher ? delta > 0 : delta < 0;
  return improved ? "positive" : "critical";
};

const CompactStatus = ({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: SurfaceTone;
}) => (
  <div
    className={cn(
      "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[0.62rem] font-medium uppercase tracking-[0.16em]",
      chipToneStyles[tone],
    )}
  >
    <span className="text-muted-foreground">{label}</span>
    <span className="h-1 w-1 rounded-full bg-current opacity-60" />
    <span className="text-foreground">{value}</span>
  </div>
);

const MetricCard = ({
  label,
  value,
  change,
  note,
  tone = "neutral",
  onClick,
  labelHint,
}: {
  label: string;
  value: string;
  change: string;
  note: string;
  tone?: SurfaceTone;
  onClick?: () => void;
  labelHint?: ReactNode;
}) => (
  <button
    type="button"
    disabled={!onClick}
    className={cn(
      "rounded-2xl border border-border/70 bg-background/52 p-4 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] transition-colors",
      onClick ? "hover:border-primary/20 hover:bg-background/60" : "cursor-default",
    )}
    onClick={onClick}
  >
    <div className="flex items-start justify-between gap-3">
      <div className="flex items-center gap-1.5">
        <p className="text-[0.66rem] uppercase tracking-[0.18em] text-muted-foreground">
          {label}
        </p>
        {labelHint}
      </div>
      <span
        className={cn(
          "rounded-full border px-2 py-0.5 text-[0.62rem] uppercase tracking-[0.14em]",
          chipToneStyles[tone],
        )}
      >
        {change}
      </span>
    </div>
    <p className="mt-3 text-[1.8rem] font-semibold tracking-[-0.05em] text-foreground">
      {value}
    </p>
    <p className="mt-1 text-sm text-muted-foreground">{note}</p>
  </button>
);

const QueueRow = ({
  title,
  subtitle,
  meta,
  badge,
  tone = "neutral",
  onClick,
}: {
  title: string;
  subtitle: string;
  meta: string;
  badge: string;
  tone?: SurfaceTone;
  onClick?: () => void;
}) => (
  <button
    type="button"
    disabled={!onClick}
    className={cn(
      "w-full rounded-2xl border border-border/70 bg-background/48 px-4 py-3 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.02)] transition-colors",
      onClick ? "hover:border-primary/20 hover:bg-background/58" : "cursor-default",
    )}
    onClick={onClick}
  >
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0 space-y-1">
        <p className="truncate font-medium text-foreground">{title}</p>
        <p className="text-sm text-muted-foreground">{subtitle}</p>
      </div>
      <span
        className={cn(
          "shrink-0 rounded-full border px-2 py-0.5 text-[0.62rem] uppercase tracking-[0.14em]",
          chipToneStyles[tone],
        )}
      >
        {badge}
      </span>
    </div>
    <div className="mt-3 border-t border-border/60 pt-2 text-xs uppercase tracking-[0.14em] text-muted-foreground">
      {meta}
    </div>
  </button>
);

const EmptyState = ({
  icon,
  title,
  body,
}: {
  icon: ReactNode;
  title: string;
  body: string;
}) => (
  <div className="rounded-2xl border border-dashed border-border/70 bg-background/38 px-5 py-8 text-center">
    <div className="mx-auto flex size-10 items-center justify-center rounded-xl border border-border/70 bg-background/60 text-foreground/82">
      {icon}
    </div>
    <p className="mt-3 font-medium text-foreground">{title}</p>
    <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">{body}</p>
  </div>
);

const LoadingGrid = ({ count, label }: { count: number; label: string }) => (
  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
    {Array.from({ length: count }).map((_, index) => (
      <div
        key={`${label}-${index}`}
        className="rounded-2xl border border-border/70 bg-background/52 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]"
      >
        <Skeleton className="h-3 w-24" />
        <Skeleton className="mt-4 h-8 w-28" />
        <Skeleton className="mt-3 h-4 w-full" />
      </div>
    ))}
  </div>
);

const buildDrilldownExport = (
  drilldown: DrilldownState,
  range: { from: string; to: string },
  generatedAt: number,
) => {
  const base = {
    exportedAt: new Date().toISOString(),
    generatedAt,
    range,
    title: drilldown.title,
    description: drilldown.description,
    kind: drilldown.kind,
  };

  switch (drilldown.kind) {
    case "users":
      return { ...base, items: drilldown.items };
    case "channels":
      return { ...base, items: drilldown.items };
    case "messages":
      return { ...base, items: drilldown.items };
    case "explanation":
      return { ...base, blocks: drilldown.blocks };
  }
};

export const OverviewWorkspace = ({
  overview,
  loading,
  error,
  sentimentChannels,
  sentimentMessages,
  overviewRange,
  onOverviewRangeChange,
  onOpenSentiment,
}: OverviewWorkspaceProps) => {
  const [drilldown, setDrilldown] = useState<DrilldownState | null>(null);

  const selectedRangeLabel = overview
    ? formatDateRange(overview.range.from, overview.range.to)
    : "Selected range";
  const updatedAt = overview ? formatTimestamp(overview.generatedAt) : "Refreshing";
  const backlogCount = sentimentChannels?.totals.pending ?? 0;
  const backlogTone = getBacklogTone(backlogCount);
  const healthTone = overview
    ? getHealthTone(overview.rangeMetrics.healthScore.value)
    : "neutral";
  const sentimentPreviewChannels = (sentimentChannels?.channels ?? []).slice(0, 3);
  const sentimentPreviewCount = sentimentMessages?.items.length ?? 0;
  const pendingClassificationChannels =
    overview?.ops.sentimentBacklog.topBacklogChannels ?? [];
  const flaggedChannelReasons = new Map(
    (overview?.drilldowns.flaggedChannels ?? []).map((channel) => [
      channel.channelId,
      channel.reason,
    ]),
  );

  const topHeadline = overview
    ? `${overview.rangeMetrics.channelsNeedingAttention.value.toLocaleString()} channel${overview.rangeMetrics.channelsNeedingAttention.value === 1 ? "" : "s"} need review.`
    : "Loading community state.";
  const topBody = overview
    ? overview.funnel[0]?.detail ??
      "Review flagged channels first, then clear backlog pressure."
    : "Fetching the latest community snapshot.";
  const nextAction = overview
    ? overview.attentionChannels[0]
      ? `Start with ${overview.attentionChannels[0].channelName}.`
      : backlogCount > 0
        ? "Clear classification backlog."
        : "No urgent triage items right now."
    : "Preparing next steps.";

  const overviewMetrics: Array<{
    label: string;
    value: string;
    change: string;
    note: string;
    tone: SurfaceTone;
    onClick: () => void;
    labelHint?: ReactNode;
  }> = overview
    ? [
        {
          label: "TikTok posts shared",
          value: overview.rangeMetrics.totalTikTokLinks.value.toLocaleString(),
          change: formatTrend(
            overview.rangeMetrics.totalTikTokLinks.trend.delta,
            overview.rangeMetrics.totalTikTokLinks.trend.pct,
          ),
          note: "Tracked TikTok links.",
          tone: getTrendTone(overview.rangeMetrics.totalTikTokLinks.trend.delta),
          onClick: () =>
            setDrilldown({
              title: "TikTok posts shared",
              description: `Creators responsible for tracked TikTok posts shared in ${selectedRangeLabel}.`,
              kind: "users",
              items: overview.drilldowns.creatorsPosting.map((creator) => ({
                primary: creator.displayName,
                avatarUrl: creator.avatarUrl,
                secondary: `${creator.videoCount.toLocaleString()} tracked shares`,
                tertiary: `Last posted ${formatTimestamp(creator.lastPostedAt)}`,
                links: creator.links,
              })),
            }),
        },
        {
          label: "Unique creators",
          value: overview.rangeMetrics.uniqueTikTokPosters.value.toLocaleString(),
          change: formatTrend(
            overview.rangeMetrics.uniqueTikTokPosters.trend.delta,
            overview.rangeMetrics.uniqueTikTokPosters.trend.pct,
          ),
          note: "Distinct members posting TikTok links.",
          tone: getTrendTone(overview.rangeMetrics.uniqueTikTokPosters.trend.delta),
          onClick: () =>
            setDrilldown({
              title: "Creators posting",
              description: `Members who posted tracked TikTok links during ${selectedRangeLabel}.`,
              kind: "users",
              items: overview.drilldowns.creatorsPosting.map((creator) => ({
                primary: creator.displayName,
                avatarUrl: creator.avatarUrl,
                secondary: `${creator.videoCount.toLocaleString()} tracked shares`,
                tertiary: `Last posted ${formatTimestamp(creator.lastPostedAt)}`,
                links: creator.links,
              })),
            }),
        },
        {
          label: "Sentiment score",
          value: `${overview.rangeMetrics.sentimentScore.value}/100`,
          change: `${overview.explainers.sentiment.positiveMessages.toLocaleString()} pos / ${overview.explainers.sentiment.negativeMessages.toLocaleString()} neg`,
          note: "Based on classified messages.",
          tone: getHealthTone(overview.rangeMetrics.sentimentScore.value),
          labelHint: (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-flex size-4 items-center justify-center rounded-full text-muted-foreground/80">
                    <CircleHelp className="size-3.5" />
                  </span>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-xs space-y-1 px-3 py-2 text-xs leading-5">
                  <p>{overview.explainers.sentiment.formula}</p>
                  <p>
                    {overview.explainers.sentiment.provider}.{" "}
                    {overview.explainers.sentiment.classifiedMessages.toLocaleString()} classified
                    messages currently shape the score.
                  </p>
                  <p>{formatSentimentEdgeCases(overview.explainers.sentiment, 2)}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ),
          onClick: () =>
            setDrilldown({
              title: "Sentiment score",
              description: overview.explainers.sentiment.summary,
              kind: "explanation",
              blocks: [
                {
                  label: "Formula",
                  value: `${overview.explainers.sentiment.score}/100`,
                  detail: overview.explainers.sentiment.formula,
                },
                {
                  label: "Classifier",
                  value: overview.explainers.sentiment.provider,
                  detail: formatSentimentClassifierDetail(overview.explainers.sentiment),
                },
                ...overview.explainers.sentiment.edgeCases.map((edgeCase, index) => ({
                  label: `Edge case ${index + 1}`,
                  value: "Handling",
                  detail: edgeCase,
                })),
              ],
            }),
        },
        {
          label: "Health score",
          value: overview.rangeMetrics.healthScore.value.toLocaleString(),
          change:
            overview.rangeMetrics.healthScore.value >= 80
              ? "Stable"
              : overview.rangeMetrics.healthScore.value >= 65
                ? "Watch"
                : "At risk",
          note: "Activity, sentiment, and queue pressure.",
          tone: getHealthTone(overview.rangeMetrics.healthScore.value),
          onClick: () =>
            setDrilldown({
              title: "Health score breakdown",
              description: overview.explainers.health.summary,
              kind: "explanation",
              blocks: overview.explainers.health.drivers.map((driver) => ({
                label: driver.label,
                value: `${driver.value}`,
                detail: driver.detail,
              })),
            }),
        },
        {
          label: "Active users",
          value: overview.rangeMetrics.activeUsers.value.toLocaleString(),
          change: formatTrend(
            overview.rangeMetrics.activeUsers.trend.delta,
            overview.rangeMetrics.activeUsers.trend.pct,
          ),
          note: "Members posting in range.",
          tone: getTrendTone(overview.rangeMetrics.activeUsers.trend.delta),
          onClick: () =>
            setDrilldown({
              title: "Active users",
              description: `Members who posted during ${selectedRangeLabel}.`,
              kind: "users",
              items: overview.drilldowns.activeUsers.map((user) => ({
                primary: user.displayName,
                avatarUrl: user.avatarUrl,
                secondary: `${user.messageCount.toLocaleString()} messages in ${user.topChannelName}`,
                tertiary: `Last post ${formatTimestamp(user.lastMessageAt)}`,
              })),
            }),
        },
        {
          label: "Negative rate",
          value: `${overview.rangeMetrics.negativeMessageRate.value}%`,
          change: `${overview.drilldowns.negativeMessages.length.toLocaleString()} flagged`,
          note: "Share of messages classified negative.",
          tone: getTrendTone(
            overview.rangeMetrics.negativeMessageRate.trend.delta,
            false,
          ),
          onClick: () =>
            setDrilldown({
              title: "Negative messages",
              description: `Messages flagged negative in ${selectedRangeLabel}.`,
              kind: "messages",
              items: overview.drilldowns.negativeMessages.map((message) => ({
                id: message.id,
                primary: `${message.author} in ${message.channelName}`,
                secondary: message.content,
                tertiary: message.rationale,
              })),
            }),
        },
      ]
    : [];

  const summaryChips = overview
    ? [
        {
          label: "Health",
          value: `${overview.rangeMetrics.healthScore.value}`,
          tone: healthTone,
        },
        {
          label: "Channels",
          value: `${overview.rangeMetrics.channelsNeedingAttention.value.toLocaleString()} flagged`,
          tone:
            overview.rangeMetrics.channelsNeedingAttention.value > 0
              ? ("warning" as const)
              : ("positive" as const),
        },
        {
          label: "Creators",
          value: `${overview.rangeMetrics.activeUsers.value} active / ${overview.rangeMetrics.inactiveUsers.value} quiet`,
          tone:
            overview.rangeMetrics.inactiveUsers.value > 0
              ? ("warning" as const)
              : ("positive" as const),
        },
        {
          label: "Backlog",
          value: `${backlogCount.toLocaleString()} waiting`,
          tone: backlogTone,
        },
        {
          label: "Negative",
          value: `${overview.rangeMetrics.negativeMessageRate.value}%`,
          tone: getTrendTone(
            overview.rangeMetrics.negativeMessageRate.trend.delta,
            false,
          ),
        },
      ]
    : [];

  return (
    <div className="grid gap-5">
      <section className="grid gap-3 rounded-2xl border border-border/70 bg-background/82 px-4 py-4 shadow-[0_18px_44px_rgba(0,0,0,0.28)] sm:px-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <p className="ui-kicker">Community operations</p>
            <h2 className="text-[1.55rem] font-semibold tracking-[-0.045em] text-foreground">
              Overview
            </h2>
            <p className="text-sm text-muted-foreground">
              Updated {updatedAt}
            </p>
          </div>
        </div>

        {/* Keep controls inside the top system row so the range feels part of the snapshot, not a separate panel. */}
        <div className="grid gap-3 rounded-2xl border border-border/70 bg-background/54 px-4 py-3 lg:grid-cols-[minmax(0,1.15fr)_auto] lg:items-end">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <CompactStatus label="Window" value={selectedRangeLabel} />
              {summaryChips.map((chip) => (
                <CompactStatus
                  key={chip.label}
                  label={chip.label}
                  value={chip.value}
                  tone={chip.tone}
                />
              ))}
            </div>
            <div className="space-y-1">
              <h3 className="text-[1.15rem] font-semibold tracking-[-0.03em] text-foreground">
                {topHeadline}
              </h3>
              <p className="text-sm text-muted-foreground">{topBody}</p>
              <p className="text-sm text-foreground/88">{nextAction}</p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-[minmax(0,260px)_auto]">
            <div className="grid gap-1.5">
              <label className="text-[0.66rem] uppercase tracking-[0.18em] text-muted-foreground">
                Date range
              </label>
              <DateRangePicker
                value={overviewRange}
                onChange={(next) => onOverviewRangeChange(next)}
              />
            </div>
            <div className="flex items-end gap-2">
              <Button
                type="button"
                variant="outline"
                className="h-10 rounded-xl border-border/70 bg-background/68 px-3"
                onClick={() => onOpenSentiment()}
              >
                <MessageSquare className="size-4" />
                Sentiment
              </Button>
              <Button
                type="button"
                className="h-10 rounded-xl px-3"
                onClick={() => onOpenSentiment()}
              >
                <ArrowUpRight className="size-4" />
                Review
              </Button>
            </div>
          </div>
        </div>
      </section>

      {error ? (
        <div className="rounded-2xl border border-destructive/35 bg-destructive/12 px-4 py-3 text-sm text-destructive">
          <div className="flex items-center gap-2">
            <ShieldAlert className="size-4" />
            <span>{error}</span>
          </div>
        </div>
      ) : null}

      {loading ? (
        <LoadingGrid count={6} label="overview-metric" />
      ) : (
        /* The KPI strip is a single summary system: same height, same grammar, one scan path. */
        <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
          {overviewMetrics.map((metric) => (
            <MetricCard
              key={metric.label}
              label={metric.label}
              value={metric.value}
              change={metric.change}
              note={metric.note}
              tone={metric.tone}
              onClick={metric.onClick}
              labelHint={metric.labelHint}
            />
          ))}
        </section>
      )}

      {overview ? (
        <div className="grid gap-5 min-[1520px]:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.82fr)]">
          <section className="grid gap-4">
            <div className="rounded-2xl border border-border/70 bg-background/52 px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div>
                  <p className="text-[0.68rem] uppercase tracking-[0.18em] text-muted-foreground">
                    Triage
                  </p>
                  <h3 className="mt-1 text-[1.1rem] font-semibold tracking-[-0.03em] text-foreground">
                    Review channels first
                  </h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Highest-signal attention area from the current overview window.
                  </p>
                </div>
                <Badge variant="outline" className="rounded-full border-border/70 bg-background/60">
                  {overview.attentionChannels.length.toLocaleString()} flagged
                </Badge>
              </div>
            </div>

            <div className="grid gap-3">
              {overview.attentionChannels.length ? (
                overview.attentionChannels.map((channel, index) => (
                  <button
                    type="button"
                    key={channel.channelId}
                    className="rounded-2xl border border-border/70 bg-background/50 px-4 py-4 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.02)] transition-colors hover:border-primary/22 hover:bg-background/58"
                    onClick={() => onOpenSentiment({ channelId: channel.channelId })}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-[0.62rem] uppercase tracking-[0.18em] text-muted-foreground">
                            {`0${index + 1}`.slice(-2)}
                          </span>
                          <p className="truncate font-medium text-foreground">
                            {channel.channelName}
                          </p>
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {channel.messageCount.toLocaleString()} messages, {channel.classifiedTotal.toLocaleString()} analyzed
                        </p>
                        <p className="mt-2 text-sm text-foreground/84">
                          {flaggedChannelReasons.get(channel.channelId) ??
                            "Open the sentiment queue to inspect the contributing messages."}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full border border-red-500/18 bg-red-500/7 px-2 py-0.5 text-[0.62rem] uppercase tracking-[0.14em] text-red-50">
                          {channel.negativeRate.toFixed(1)}% neg
                        </span>
                        <span className="rounded-full border border-border/70 bg-background/60 px-2 py-0.5 text-[0.62rem] uppercase tracking-[0.14em] text-foreground">
                          {channel.pendingCount.toLocaleString()} pending
                        </span>
                      </div>
                    </div>
                    <div className="mt-3 grid gap-2 sm:grid-cols-3">
                      <div className="rounded-xl border border-border/70 bg-background/62 px-3 py-2 text-sm text-muted-foreground">
                        Total negative{" "}
                        <span className="font-medium text-foreground">
                          {channel.negativeRate.toFixed(1)}%
                        </span>
                      </div>
                      <div className="rounded-xl border border-border/70 bg-background/62 px-3 py-2 text-sm text-muted-foreground">
                        Classified sample{" "}
                        <span className="font-medium text-foreground">
                          {channel.classifiedNegativeRate.toFixed(1)}%
                        </span>
                      </div>
                      <div className="rounded-xl border border-border/70 bg-background/62 px-3 py-2 text-sm text-muted-foreground">
                        Next action{" "}
                        <span className="font-medium text-foreground">
                          Open queue
                        </span>
                      </div>
                    </div>
                  </button>
                ))
              ) : (
                <EmptyState
                  icon={<MessageSquare className="size-5" />}
                  title="No channels are flagged"
                  body="The current window does not show any channels over the attention threshold."
                />
              )}
            </div>

            <section className="rounded-2xl border border-border/70 bg-background/48 px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-[0.68rem] uppercase tracking-[0.18em] text-muted-foreground">
                    Sentiment workspace
                  </p>
                  <h3 className="mt-1 text-[1rem] font-semibold tracking-[-0.03em] text-foreground">
                    Open the dedicated queue for ranked channels and message triage
                  </h3>
                </div>
                <div className="flex flex-wrap gap-2">
                  <QueueRow
                    title="Negative"
                    subtitle={`${(sentimentChannels?.totals.negative ?? 0).toLocaleString()} messages in the current review window`}
                    meta="Open negative queue"
                    badge="review"
                    tone="critical"
                    onClick={() => onOpenSentiment({ label: "negative" })}
                  />
                </div>
              </div>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-border/60 pt-3">
                <div className="flex flex-wrap gap-2">
                  <CompactStatus
                    label="Preview"
                    value={`${sentimentPreviewCount.toLocaleString()} records`}
                  />
                  <CompactStatus
                    label="Top queue"
                    value={sentimentPreviewChannels[0]?.channelName ?? "No channels"}
                    tone={sentimentPreviewChannels[0] ? "warning" : "neutral"}
                  />
                </div>
                <Button
                  type="button"
                  size="sm"
                  className="rounded-xl"
                  onClick={() => onOpenSentiment()}
                >
                  Open sentiment workspace
                  <ArrowUpRight className="size-4" />
                </Button>
              </div>
            </section>
          </section>

          <aside className="grid gap-4 min-[1520px]:sticky min-[1520px]:top-[calc(var(--header-height)+1.25rem)] min-[1520px]:h-fit">
            <section className="rounded-2xl border border-border/70 bg-background/52 px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[0.68rem] uppercase tracking-[0.18em] text-muted-foreground">
                    Backlog
                  </p>
                  <h3 className="mt-1 text-[1.05rem] font-semibold tracking-[-0.03em] text-foreground">
                    Pending classification
                  </h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Support queue behind the primary triage flow.
                  </p>
                </div>
                <Badge variant="outline" className="rounded-full border-border/70 bg-background/60">
                  {backlogCount.toLocaleString()} waiting
                </Badge>
              </div>

              <div className="mt-4 space-y-2">
                {pendingClassificationChannels.length ? (
                  pendingClassificationChannels.map((channel) => (
                    <QueueRow
                      key={channel.channelId}
                      title={channel.channelName}
                      subtitle={`${channel.pendingCount.toLocaleString()} messages still unclassified`}
                      meta="Open pending queue"
                      badge={`${channel.pendingCount.toLocaleString()}`}
                      tone={backlogTone}
                      onClick={() =>
                        onOpenSentiment({
                          channelId: channel.channelId,
                          label: "pending",
                        })
                      }
                    />
                  ))
                ) : (
                  <EmptyState
                    icon={<CalendarRange className="size-5" />}
                    title="Backlog is clear"
                    body="There are no pending sentiment classifications in the current snapshot."
                  />
                )}
              </div>
            </section>

            <section className="rounded-2xl border border-border/70 bg-background/48 px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
              <p className="text-[0.68rem] uppercase tracking-[0.18em] text-muted-foreground">
                What changed
              </p>
              <div className="mt-3 space-y-2">
                <QueueRow
                  title="Flagged channels"
                  subtitle={`${overview.rangeMetrics.channelsNeedingAttention.value.toLocaleString()} channels crossed the attention threshold`}
                  meta={formatTrend(
                    overview.rangeMetrics.channelsNeedingAttention.trend.delta,
                    overview.rangeMetrics.channelsNeedingAttention.trend.pct,
                  )}
                  badge="attention"
                  tone={
                    overview.rangeMetrics.channelsNeedingAttention.value > 0
                      ? "warning"
                      : "positive"
                  }
                  onClick={() =>
                    setDrilldown({
                      title: "Flagged channels",
                      description: "Channels that crossed the overview attention threshold.",
                      kind: "channels",
                      items: overview.drilldowns.flaggedChannels.map((channel) => ({
                        channelId: channel.channelId,
                        primary: channel.channelName,
                        secondary: `${channel.negativeRate.toFixed(1)}% negative of total messages`,
                        tertiary: channel.reason,
                      })),
                    })
                  }
                />
                <QueueRow
                  title="Inactive users"
                  subtitle={`${overview.rangeMetrics.inactiveUsers.value.toLocaleString()} members went quiet`}
                  meta={formatTrend(
                    overview.rangeMetrics.inactiveUsers.trend.delta,
                    overview.rangeMetrics.inactiveUsers.trend.pct,
                  )}
                  badge="members"
                  tone={getTrendTone(
                    overview.rangeMetrics.inactiveUsers.trend.delta,
                    false,
                  )}
                  onClick={() =>
                    setDrilldown({
                      title: "Inactive users",
                      description: `Known members with prior activity but no posts in ${selectedRangeLabel}.`,
                      kind: "users",
                      items: overview.drilldowns.inactiveUsers.map((user) => ({
                        primary: user.displayName,
                        avatarUrl: user.avatarUrl,
                        secondary: `${user.historicalMessageCount.toLocaleString()} historical messages`,
                        tertiary: `Last active ${formatTimestamp(user.lastMessageAt)}`,
                      })),
                    })
                  }
                />
              </div>
            </section>
          </aside>
        </div>
      ) : null}

      <Sheet open={Boolean(drilldown)} onOpenChange={(open) => !open && setDrilldown(null)}>
        <SheetContent className="w-full overflow-y-auto border-l border-border/70 bg-background/96 backdrop-blur-xl sm:max-w-2xl">
          {drilldown ? (
            <div className="grid gap-5 px-5 pb-5 pt-6 sm:px-6 sm:pb-6">
              <SheetHeader>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="text-[0.68rem] font-medium uppercase tracking-[0.22em] text-muted-foreground">
                      Overview detail
                    </div>
                    <SheetTitle className="text-[1.4rem] font-semibold tracking-[-0.04em] text-foreground">
                      {drilldown.title}
                    </SheetTitle>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="rounded-xl border-border/70 bg-background/68"
                    onClick={() => {
                      const payload = buildDrilldownExport(
                        drilldown,
                        overviewRange,
                        overview?.generatedAt ?? Date.now(),
                      );
                      downloadJson(
                        `overview-${toFilenamePart(drilldown.title)}.json`,
                        payload,
                      );
                    }}
                  >
                    <Download className="size-4" />
                    Export JSON
                  </Button>
                </div>
                <p className="text-sm leading-6 text-muted-foreground">
                  {drilldown.description}
                </p>
              </SheetHeader>

              {drilldown.kind === "users" ? (
                <div className="grid gap-2">
                  {drilldown.items.length ? (
                    drilldown.items.map((item) => (
                      <div
                        key={`${drilldown.title}-${item.primary}-${item.secondary}`}
                        className="rounded-2xl border border-border/70 bg-background/52 px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]"
                      >
                        <div className="flex items-start gap-3">
                          <Avatar className="mt-0.5 h-10 w-10 border border-border/70">
                            <AvatarImage src={item.avatarUrl ?? undefined} alt={item.primary} />
                            <AvatarFallback>{getInitials(item.primary)}</AvatarFallback>
                          </Avatar>
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-foreground">{item.primary}</p>
                            <p className="mt-1 text-sm text-muted-foreground">{item.secondary}</p>
                          </div>
                        </div>
                        {item.tertiary ? (
                          <p className="mt-3 border-t border-border/60 pt-2 text-sm text-muted-foreground">
                            {item.tertiary}
                          </p>
                        ) : null}
                        {item.links?.length ? (
                          <div className="mt-3 grid gap-2 border-t border-border/60 pt-3">
                            {item.links.map((link) => (
                              <a
                                key={link}
                                href={link}
                                target="_blank"
                                rel="noreferrer"
                                className="rounded-xl border border-border/70 bg-background/64 px-3 py-2 text-sm text-foreground transition-colors hover:border-primary/24 hover:bg-background/72 hover:text-primary"
                              >
                                {formatLinkLabel(link)}
                              </a>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    ))
                  ) : (
                    <EmptyState
                      icon={<Users className="size-5" />}
                      title="No people found"
                      body="There is no matching activity for this drilldown yet."
                    />
                  )}
                </div>
              ) : null}

              {drilldown.kind === "channels" ? (
                <div className="grid gap-2">
                  {drilldown.items.map((item) => (
                    <button
                      key={item.channelId}
                      type="button"
                      className="rounded-2xl border border-border/70 bg-background/52 px-4 py-3 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] transition-colors hover:border-primary/20 hover:bg-background/60"
                      onClick={() => onOpenSentiment({ channelId: item.channelId })}
                    >
                      <p className="font-medium text-foreground">{item.primary}</p>
                      <p className="mt-1 text-sm text-muted-foreground">{item.secondary}</p>
                      {item.tertiary ? (
                        <p className="mt-3 border-t border-border/60 pt-2 text-sm text-muted-foreground">
                          {item.tertiary}
                        </p>
                      ) : null}
                    </button>
                  ))}
                </div>
              ) : null}

              {drilldown.kind === "messages" ? (
                <div className="grid gap-2">
                  {drilldown.items.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className="rounded-2xl border border-border/70 bg-background/52 px-4 py-3 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] transition-colors hover:border-primary/20 hover:bg-background/60"
                      onClick={() => onOpenSentiment({ label: "negative" })}
                    >
                      <p className="font-medium text-foreground">{item.primary}</p>
                      <p className="mt-2 text-sm leading-6 text-foreground/88">
                        {item.secondary}
                      </p>
                      {item.tertiary ? (
                        <p className="mt-3 border-t border-border/60 pt-2 text-sm text-muted-foreground">
                          Why: {item.tertiary}
                        </p>
                      ) : null}
                    </button>
                  ))}
                </div>
              ) : null}

              {drilldown.kind === "explanation" ? (
                <div className="grid gap-2">
                  {drilldown.blocks.map((block) => (
                    <div
                      key={`${block.label}-${block.value}`}
                      className="rounded-2xl border border-border/70 bg-background/52 px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <p className="text-[0.66rem] uppercase tracking-[0.18em] text-muted-foreground">
                          {block.label}
                        </p>
                        <p className="text-sm font-medium text-foreground">{block.value}</p>
                      </div>
                      <p className="mt-3 border-t border-border/60 pt-2 text-sm text-muted-foreground">
                        {block.detail}
                      </p>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
};
