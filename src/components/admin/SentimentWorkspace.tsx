import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Clock3,
  ExternalLink,
  Search,
  XCircle,
} from "lucide-react";
import type { SentimentRouteSearch } from "@/admin-route-search";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type {
  SentimentChannelsResponse,
  SentimentMessageContextResponse,
  SentimentMessagesResponse,
} from "@/utils/api";
import {
  fetchSentimentMessageContext,
  updateSentimentReviewStatus,
} from "@/utils/api";

type SurfaceTone = "neutral" | "positive" | "warning" | "critical";

type SentimentWorkspaceProps = {
  search: SentimentRouteSearch;
  channels: SentimentChannelsResponse | null;
  messages: SentimentMessagesResponse | null;
  loading: boolean;
  error: string;
  canGoBack: boolean;
  onApplySearch: (query: string) => void;
  onUpdateSearch: (patch: Partial<SentimentRouteSearch>) => void;
  onNextPage: () => void;
  onPreviousPage: () => void;
  onOpenInExplorer: (messageId: string) => void;
};

type SentimentMessageWithAttention = SentimentMessagesResponse["items"][number] & {
  attentionScore: number;
};

const sentimentWindowOptions = [
  { value: "24h", label: "Last 24h" },
  { value: "7d", label: "Last 7d" },
  { value: "14d", label: "Last 14d" },
] as const;

const sentimentLabelOptions = [
  { value: "all", label: "All labels" },
  { value: "positive", label: "Positive" },
  { value: "neutral", label: "Neutral" },
  { value: "negative", label: "Negative" },
  { value: "pending", label: "Pending" },
] as const;

const sentimentSortOptions = [
  { value: "risk", label: "Risk first" },
  { value: "newest", label: "Newest first" },
] as const;

const chipToneStyles: Record<SurfaceTone, string> = {
  neutral: "border-border/70 bg-background/60 text-muted-foreground",
  positive: "border-emerald-500/18 bg-emerald-500/6 text-emerald-50",
  warning: "border-amber-500/18 bg-amber-500/6 text-amber-50",
  critical: "border-red-500/20 bg-red-500/7 text-red-50",
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

const formatShortDate = (value: number): string =>
  new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });

const getMessageTone = (label: string): SurfaceTone => {
  if (label === "negative") return "critical";
  if (label === "pending") return "warning";
  if (label === "positive") return "positive";
  return "neutral";
};

const getReviewTone = (status: "pending" | "resolved"): SurfaceTone =>
  status === "resolved" ? "positive" : "warning";

const getAttentionScore = (item: SentimentMessagesResponse["items"][number]): number => {
  const base = item.label === "negative" ? 80 : item.label === "pending" ? 55 : 25;
  const reviewPenalty = item.reviewStatus === "pending" ? 15 : 0;
  return Math.round(base + reviewPenalty + Math.max(0, item.confidence - 40) * 0.35);
};

const statusBadgeVariant = (value: "pending" | "resolved"): "destructive" | "outline" | "secondary" =>
  value === "resolved" ? "outline" : "secondary";

const labelBadgeVariant = (label: string): "destructive" | "outline" | "secondary" => {
  if (label === "negative") return "destructive";
  if (label === "pending") return "secondary";
  return "outline";
};

const getReviewActionText = (status: "pending" | "resolved") =>
  status === "resolved" ? "Reopen" : "Resolve";

const CompactStat = ({
  label,
  value,
  tone,
  detail,
}: {
  label: string;
  value: string;
  tone: SurfaceTone;
  detail: string;
}) => (
  <div className="rounded-[1rem] border border-border/70 bg-background/52 px-3.5 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
    <p className="text-[0.62rem] uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
    <p className="mt-1.5 text-[1.6rem] font-semibold tracking-[-0.03em] text-foreground">{value}</p>
    <p className="mt-1.5 text-xs text-muted-foreground">{detail}</p>
    <span
      className={cn(
        "mt-2.5 inline-flex items-center rounded-full border px-2 py-0.5 text-[0.6rem] uppercase tracking-[0.14em]",
        chipToneStyles[tone],
      )}
    >
      {tone}
    </span>
  </div>
);

const FilterPill = ({ label, value }: { label: string; value: string }) => (
  <div className="flex items-center gap-2 rounded-full border border-border/70 bg-background/52 px-2.5 py-1 text-[0.58rem] uppercase tracking-[0.16em] text-muted-foreground">
    <span>{label}</span>
    <span className="h-1 w-1 rounded-full bg-muted-foreground/80" />
    <span className="font-medium text-foreground">{value}</span>
  </div>
);

const MessageItemCard = ({
  item,
  selected,
  onSelect,
  onResolve,
  onOpenInExplorer,
}: {
  item: SentimentMessageWithAttention;
  selected: boolean;
  onSelect: (id: string) => void;
  onResolve: () => void;
  onOpenInExplorer: () => void;
}) => (
  <button
    type="button"
    onClick={() => onSelect(item.id)}
    className={cn(
      "w-full rounded-[1rem] border border-border/70 bg-background/44 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.02)] transition-colors",
      selected
        ? "border-primary/24 bg-background/60 shadow-[inset_0_1px_0_rgba(255,255,255,0.03),0_0_0_1px_rgba(52,211,153,0.08)]"
        : "hover:border-border hover:bg-background/52",
    )}
  >
    <div className="space-y-2.5 p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 space-y-1">
          <p className="truncate text-sm font-medium leading-5 text-foreground">
            {item.author} <span className="text-muted-foreground">in</span> {item.channelName}
          </p>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.72rem] text-muted-foreground">
            <span>{formatTimestamp(item.createdAt)}</span>
            <span className="h-1 w-1 rounded-full bg-border/90" />
            <span>{item.provider}</span>
            <span className="h-1 w-1 rounded-full bg-border/90" />
            <span>{item.confidence.toFixed(0)}% confidence</span>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-1.5">
          <Badge variant={labelBadgeVariant(item.label)} className="rounded-full px-2 py-0 text-[0.65rem]">
            {item.label}
          </Badge>
          <Badge
            variant={statusBadgeVariant(item.reviewStatus)}
            className="rounded-full px-2 py-0 text-[0.65rem]"
          >
            {item.reviewStatus === "resolved" ? "Resolved" : "Needs action"}
          </Badge>
          <span
            className={cn(
              "rounded-full border px-2 py-0.5 text-[0.6rem] uppercase tracking-[0.14em]",
              chipToneStyles[getMessageTone(item.label)],
            )}
          >
            {Math.round(item.attentionScore)} score
          </span>
        </div>
      </div>
      <p className="line-clamp-2 text-sm leading-6 text-foreground/90">{item.content}</p>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/50 pt-2">
        <p className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
          {item.keywords.length ? item.keywords.join(", ") : item.rationale}
        </p>
        <div className="flex shrink-0 items-center gap-1.5">
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 px-3 text-xs"
            onClick={(event) => {
              event.stopPropagation();
              onResolve();
            }}
          >
            {getReviewActionText(item.reviewStatus)}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-8 px-2.5 text-xs"
            onClick={(event) => {
              event.stopPropagation();
              onOpenInExplorer();
            }}
          >
            Explorer
            <ExternalLink className="ml-1 size-3.5" />
          </Button>
        </div>
      </div>
    </div>
  </button>
);

const MessageQueueSection = ({
  title,
  description,
  badge,
  children,
  emptyText,
  isEmpty,
}: {
  title: string;
  description: string;
  badge: string;
  children: ReactNode;
  emptyText: string;
  isEmpty: boolean;
}) => (
  <section className="space-y-2.5">
    <div className="rounded-[1rem] border border-border/70 bg-background/46 px-3.5 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold tracking-[-0.02em] text-foreground">{title}</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
        </div>
        <Badge
          variant="outline"
          className="rounded-full border-border/70 bg-background/60 px-2 py-0 text-[0.65rem]"
        >
          {badge}
        </Badge>
      </div>
    </div>
    <div className="space-y-2">
      {children}
      {isEmpty ? (
        <p className="rounded-[0.9rem] border border-dashed border-border/60 px-4 py-4 text-sm text-muted-foreground">
          {emptyText}
        </p>
      ) : null}
    </div>
  </section>
);

export const SentimentWorkspace = ({
  search,
  channels,
  messages,
  loading,
  error,
  canGoBack,
  onApplySearch,
  onUpdateSearch,
  onNextPage,
  onPreviousPage,
  onOpenInExplorer,
}: SentimentWorkspaceProps) => {
  const searchRef = useRef<HTMLInputElement | null>(null);
  const [draftQuery, setDraftQuery] = useState(search.q);
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);
  const [messageContext, setMessageContext] = useState<SentimentMessageContextResponse | null>(null);
  const [loadingContext, setLoadingContext] = useState(false);
  const [reviewMutationPending, setReviewMutationPending] = useState(false);
  const [reviewOverrides, setReviewOverrides] = useState<Record<string, {
    reviewStatus: "pending" | "resolved";
    reviewedAt: number | null;
  }>>({});

  const trend = channels?.trend ?? [];
  const rankedChannels = channels?.channels ?? [];
  const channelOptions = channels?.availableChannels ?? [];
  const keywordShifts = channels?.keywordShifts ?? [];
  const totals = channels?.totals;
  const summary = messages?.summary;

  const messageItems: SentimentMessageWithAttention[] = useMemo(
    () =>
      (messages?.items ?? []).map((item) => {
        const override = reviewOverrides[item.id];
        const merged = override ? { ...item, ...override } : item;
        return {
          ...merged,
          attentionScore: getAttentionScore(merged),
        };
      }),
    [messages?.items, reviewOverrides],
  );

  const totalMessages = totals?.total ?? 0;
  const pendingCount = summary?.pendingCount ?? totals?.pending ?? 0;
  const negativeCount = totals?.negative ?? 0;
  const resolvedCount = messageItems.filter((item) => item.reviewStatus === "resolved").length;
  const needsAttentionItems = messageItems
    .filter((item) => item.reviewStatus === "pending")
    .sort((a, b) => b.attentionScore - a.attentionScore);

  const resolvedItems = messageItems
    .filter((item) => item.reviewStatus === "resolved")
    .slice(0, 6);

  const topChannel = rankedChannels[0] ?? null;
  const processingCoverage = totalMessages > 0 ? (totalMessages - pendingCount) / totalMessages : 1;
  const healthScore = Math.max(
    0,
    Math.min(
      100,
      Math.round(
        100 - pendingCount / Math.max(totalMessages, 1) * 45 - (negativeCount / Math.max(totalMessages, 1)) * 35,
      ),
    ),
  );

  const selectedMessage =
    messageItems.find((item) => item.id === selectedMessageId) ?? needsAttentionItems[0] ?? null;

  const stateTone = healthScore >= 80 ? "positive" : healthScore >= 60 ? "warning" : "critical";
  const stateSummary =
    totalMessages === 0
      ? "No sentiment volume in this window yet. Expand scope or widen filters."
      : `${pendingCount.toLocaleString()} message(s) still need review, ${negativeCount.toLocaleString()} negative in scope.`;

  const channelsForOps = rankedChannels
    .filter((channel) => channel.riskScore >= 55 || channel.pending > 0)
    .slice(0, 4);
  const selectedChannelOption = channelOptions.find((channel) => channel.channelId === search.channel);
  const inferredChannelOption = search.channel !== "all" && !selectedChannelOption
    ? (
        messageItems[0]
          ? {
              channelId: messageItems[0].channelId,
              channelName: messageItems[0].channelName,
            }
          : rankedChannels[0]
            ? {
                channelId: rankedChannels[0].channelId,
                channelName: rankedChannels[0].channelName,
              }
            : null
      )
    : null;
  const channelSelectValue = selectedChannelOption?.channelId ?? inferredChannelOption?.channelId ?? search.channel;

  useEffect(() => {
    setDraftQuery(search.q);
  }, [search.q]);

  useEffect(() => {
    if (
      search.channel === "all" ||
      selectedChannelOption ||
      !inferredChannelOption ||
      inferredChannelOption.channelId === search.channel
    ) {
      return;
    }

    onUpdateSearch({ channel: inferredChannelOption.channelId });
  }, [inferredChannelOption, onUpdateSearch, search.channel, selectedChannelOption]);

  useEffect(() => {
    const handleSlash = (event: KeyboardEvent) => {
      if (event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey) return;

      const target = event.target;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        (target instanceof HTMLElement && target.isContentEditable)
      ) {
        return;
      }

      event.preventDefault();
      searchRef.current?.focus();
    };

    window.addEventListener("keydown", handleSlash);
    return () => window.removeEventListener("keydown", handleSlash);
  }, []);

  useEffect(() => {
    if (!messageItems.length) {
      setSelectedMessageId(null);
      return;
    }

    if (!selectedMessageId || !messageItems.some((item) => item.id === selectedMessageId)) {
      setSelectedMessageId(messageItems[0].id);
    }
  }, [messageItems, selectedMessageId]);

  useEffect(() => {
    if (!selectedMessage?.id) {
      setMessageContext(null);
      return;
    }

    let cancelled = false;
    setLoadingContext(true);

    fetchSentimentMessageContext(selectedMessage.id)
      .then((response) => {
        if (!cancelled) {
          setMessageContext(response);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setMessageContext(null);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingContext(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [selectedMessage?.id]);

  const handleReviewToggle = async () => {
    if (!selectedMessage || reviewMutationPending) {
      return;
    }

    setReviewMutationPending(true);
    const nextStatus = selectedMessage.reviewStatus === "resolved" ? "pending" : "resolved";

    try {
      await updateSentimentReviewStatus({
        messageId: selectedMessage.id,
        status: nextStatus,
      });

      setMessageContext((current) =>
        current?.item?.id === selectedMessage.id
          ? {
              ...current,
              item: {
                ...current.item,
                reviewStatus: nextStatus,
                reviewedAt: nextStatus === "resolved" ? Date.now() : null,
              },
              context: current.context.map((item) =>
                item.id === selectedMessage.id ? { ...item, reviewStatus: nextStatus } : item,
              ),
            }
          : current,
      );

      setReviewOverrides((current) => ({
        ...current,
        [selectedMessage.id]: {
          reviewStatus: nextStatus,
          reviewedAt: nextStatus === "resolved" ? Date.now() : null,
        },
      }));
    } finally {
      setReviewMutationPending(false);
    }
  };

  const handleUpdateSearch = (patch: Partial<SentimentRouteSearch>) => {
    onUpdateSearch(patch);
  };

  return (
    <div className="grid gap-4">
      {/* Keep the overview compact so the queue remains the primary focus on laptop-sized screens. */}
      <section className="ui-shell rounded-[1.25rem] px-4 py-4 sm:px-5 sm:py-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="max-w-3xl space-y-2.5">
            <p className="ui-kicker">Sentiment review workbench</p>
            <h1 className="text-[1.7rem] font-semibold tracking-[-0.04em] text-foreground">
              Moderate and triage messages from a high-signal queue
            </h1>
            <p className="max-w-2xl text-sm text-muted-foreground">{stateSummary}</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Badge
              className={cn(
                "rounded-full border border-border/50 bg-background/60 px-2 py-0 text-[0.68rem]",
                chipToneStyles[stateTone],
              )}
            >
              Health {healthScore}
            </Badge>
            {selectedMessage ? (
              <>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => void handleReviewToggle()}
                  disabled={reviewMutationPending}
                >
                  {selectedMessage.reviewStatus === "resolved" ? "Reopen" : "Resolve"}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => onOpenInExplorer(selectedMessage.id)}
                >
                  Open in explorer
                  <ExternalLink className="ml-1 size-4" />
                </Button>
              </>
            ) : null}
          </div>
        </div>

        <div className="mt-3.5 flex flex-wrap gap-1.5">
          <FilterPill label="Window" value={search.window} />
          <FilterPill label="Label" value={search.label} />
          <FilterPill label="Pending" value={`${pendingCount.toLocaleString()} waiting`} />
          <FilterPill label="Top risk" value={topChannel ? `${topChannel.riskScore}/100` : "—"} />
          <FilterPill label="State" value={needsAttentionItems.length ? "Needs action" : "Clean"} />
        </div>

        <div className="mt-3.5 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
          <CompactStat
            label="Window volume"
            value={totalMessages.toLocaleString()}
            tone={stateTone}
            detail={`${Math.round(processingCoverage * 100)}% processed`}
          />
          <CompactStat
            label="Needs attention"
            value={needsAttentionItems.length.toLocaleString()}
            tone={pendingCount > 0 ? "warning" : "positive"}
            detail="Messages flagged for operator action."
          />
          <CompactStat
            label="Negative"
            value={negativeCount.toLocaleString()}
            tone={negativeCount > 0 ? "critical" : "positive"}
            detail={`${totalMessages > 0 ? Math.round((negativeCount / Math.max(totalMessages, 1)) * 100) : 0}% of volume`}
          />
          <CompactStat
            label="Resolved"
            value={resolvedCount.toLocaleString()}
            tone={resolvedCount > 0 ? "positive" : "neutral"}
            detail="From current loaded set."
          />
        </div>
      </section>

      {error ? (
        <div className="ui-panel rounded-[1rem] border-destructive/35 bg-destructive/12 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      <section className="sticky top-2 z-20">
        <div className="rounded-[1rem] border border-border/70 bg-background/82 px-3.5 py-3 shadow-[0_14px_34px_rgba(0,0,0,0.22)] backdrop-blur-sm">
          <div className="grid gap-2.5 md:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_1fr_1.4fr] xl:grid-cols-6">
            <div className="grid gap-2">
              <Label
                htmlFor="sentiment-window"
                className="text-[0.66rem] uppercase tracking-[0.2em] text-muted-foreground/80"
              >
                Window
              </Label>
              <Select
                value={search.window}
                onValueChange={(value) => handleUpdateSearch({ window: value as SentimentRouteSearch["window"] })}
              >
                <SelectTrigger id="sentiment-window" className="h-9 border-border/60 bg-background/75 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {sentimentWindowOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label
                htmlFor="sentiment-label"
                className="text-[0.66rem] uppercase tracking-[0.2em] text-muted-foreground/80"
              >
                Label
              </Label>
              <Select
                value={search.label}
                onValueChange={(value) => handleUpdateSearch({ label: value as SentimentRouteSearch["label"] })}
              >
                <SelectTrigger id="sentiment-label" className="h-9 border-border/60 bg-background/75 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {sentimentLabelOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label
                htmlFor="sentiment-channel"
                className="text-[0.66rem] uppercase tracking-[0.2em] text-muted-foreground/80"
              >
                Channel
              </Label>
              <Select
                value={channelSelectValue}
                onValueChange={(value) => handleUpdateSearch({ channel: value })}
              >
                <SelectTrigger id="sentiment-channel" className="h-9 border-border/60 bg-background/75 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All channels</SelectItem>
                  {channelOptions.map((channel) => (
                    <SelectItem key={channel.channelId} value={channel.channelId}>
                      {channel.channelName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label
                htmlFor="sentiment-sort"
                className="text-[0.66rem] uppercase tracking-[0.2em] text-muted-foreground/80"
              >
                Sort
              </Label>
              <Select
                value={search.sort}
                onValueChange={(value) => handleUpdateSearch({ sort: value as SentimentRouteSearch["sort"] })}
              >
                <SelectTrigger id="sentiment-sort" className="h-9 border-border/60 bg-background/75 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {sentimentSortOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2 lg:col-span-2 xl:col-span-2">
              <Label
                htmlFor="sentiment-search"
                className="text-[0.66rem] uppercase tracking-[0.2em] text-muted-foreground/80"
              >
                Search (/)
              </Label>
              <div className="flex gap-2">
                <div className="relative min-w-0 flex-1">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="sentiment-search"
                    ref={searchRef}
                    value={draftQuery}
                    className="h-9 border-border/60 bg-background/80 pl-9 text-sm"
                    placeholder="Author, channel, phrase"
                    onChange={(event) => setDraftQuery(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        onApplySearch(draftQuery);
                      }
                    }}
                  />
                </div>
                <Button type="button" size="sm" className="h-9 px-3" onClick={() => onApplySearch(draftQuery)}>
                  Apply
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(19rem,0.85fr)]">
        <div className="space-y-4">
          <MessageQueueSection
            title="Needs attention"
            description="Prioritized review queue for quick operator action."
            badge={`${needsAttentionItems.length} pending`}
            isEmpty={needsAttentionItems.length === 0}
            emptyText={loading ? "Loading review queue..." : "No items need action for this filter set."}
          >
            {needsAttentionItems.map((message) => (
              <MessageItemCard
                key={message.id}
                item={message}
                selected={selectedMessage?.id === message.id}
                onSelect={(id) => setSelectedMessageId(id)}
                onResolve={() => {
                  setSelectedMessageId(message.id);
                  void handleReviewToggle();
                }}
                onOpenInExplorer={() => onOpenInExplorer(message.id)}
              />
            ))}
          </MessageQueueSection>

          <details className="rounded-[1rem] border border-border/70 bg-background/42 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
            <summary className="cursor-pointer select-none px-3.5 py-3 text-[0.72rem] uppercase tracking-[0.16em] text-muted-foreground">
              Resolved recently
            </summary>
            <div className="space-y-2 px-3.5 pb-3.5">
              <p className="text-xs text-muted-foreground">Most recent resolved items from this load.</p>
              <div className="space-y-2">
                {resolvedItems.length ? (
                  resolvedItems.map((message) => (
                    <MessageItemCard
                      key={message.id}
                      item={message}
                      selected={selectedMessage?.id === message.id}
                      onSelect={(id) => setSelectedMessageId(id)}
                      onResolve={() => {
                        setSelectedMessageId(message.id);
                        void handleReviewToggle();
                      }}
                      onOpenInExplorer={() => onOpenInExplorer(message.id)}
                    />
                  ))
                ) : (
                  <p className="rounded-[0.9rem] border border-dashed border-border/60 p-4 text-sm text-muted-foreground">
                    No resolved items in this slice yet.
                  </p>
                )}
              </div>

              <div className="flex items-center justify-between gap-2 border-t border-border/50 pt-3">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={onPreviousPage}
                  disabled={!canGoBack || loading}
                >
                  <ChevronLeft className="size-4" />
                  Previous
                </Button>
                <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
                  Page size {messages?.pageInfo.limit ?? 50}
                </p>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={onNextPage}
                  disabled={!messages?.pageInfo.hasNextPage || loading}
                >
                  Next
                  <ChevronRight className="size-4" />
                </Button>
              </div>
            </div>
          </details>
        </div>

        <aside className="space-y-3.5 xl:sticky xl:top-28 xl:h-fit">
          {selectedMessage ? (
            <>
              {/* The inspector uses small field modules instead of one large card to keep metadata scannable. */}
              <section className="space-y-3 rounded-[1rem] border border-border/70 bg-background/46 p-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold tracking-[0.01em] text-foreground">Inspector</h3>
                  <Badge
                    variant="outline"
                    className={cn(
                      "rounded-full px-2 py-0 text-[0.65rem]",
                      chipToneStyles[getReviewTone(selectedMessage.reviewStatus)],
                    )}
                  >
                    <Clock3 className="mr-1 size-3" />
                    {selectedMessage.reviewStatus}
                  </Badge>
                </div>

                <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-2 text-sm text-muted-foreground">
                  <div className="rounded-[0.9rem] border border-border/70 bg-background/56 px-3 py-2">
                    <p className="text-xs uppercase tracking-[0.12em]">Author</p>
                    <p className="mt-1 text-foreground">{selectedMessage.author}</p>
                  </div>
                  <div className="rounded-[0.9rem] border border-border/70 bg-background/56 px-3 py-2">
                    <p className="text-xs uppercase tracking-[0.12em]">Channel</p>
                    <p className="mt-1 text-foreground">{selectedMessage.channelName}</p>
                  </div>
                  <div className="rounded-[0.9rem] border border-border/70 bg-background/56 px-3 py-2">
                    <p className="text-xs uppercase tracking-[0.12em]">Provider</p>
                    <p className="mt-1 text-foreground">{selectedMessage.provider}</p>
                  </div>
                  <div className="rounded-[0.9rem] border border-border/70 bg-background/56 px-3 py-2">
                    <p className="text-xs uppercase tracking-[0.12em]">Sentiment</p>
                    <p className="mt-1 text-foreground">{selectedMessage.label}</p>
                  </div>
                </div>

                <div className="rounded-[0.9rem] border border-border/70 bg-background/50 px-3 py-3">
                  <p className="text-sm leading-6 text-foreground">{selectedMessage.content}</p>
                </div>

                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => void handleReviewToggle()}
                    disabled={reviewMutationPending}
                    className="w-full"
                  >
                    {getReviewActionText(selectedMessage.reviewStatus)}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => onOpenInExplorer(selectedMessage.id)}
                    className="w-full"
                  >
                    Open in explorer
                    <ExternalLink className="ml-1 size-4" />
                  </Button>
                </div>
              </section>

              <details className="rounded-[1rem] border border-border/70 bg-background/42 p-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
                <summary className="cursor-pointer text-sm font-medium text-foreground">Classification context</summary>
                <div className="mt-3 space-y-3 text-sm text-muted-foreground">
                  <div className="grid gap-2 sm:grid-cols-3 xl:grid-cols-3">
                    <div className="rounded-[0.9rem] border border-border/70 bg-background/52 px-3 py-2">
                      <p className="text-[0.68rem] uppercase tracking-[0.14em] text-muted-foreground">Confidence</p>
                      <p className="mt-1 font-medium text-foreground">{selectedMessage.confidence.toFixed(0)}%</p>
                    </div>
                    <div className="rounded-[0.9rem] border border-border/70 bg-background/52 px-3 py-2">
                      <p className="text-[0.68rem] uppercase tracking-[0.14em] text-muted-foreground">Reactions</p>
                      <p className="mt-1 font-medium text-foreground">
                        {selectedMessage.reactionCount.toLocaleString()}
                      </p>
                    </div>
                    <div className="rounded-[0.9rem] border border-border/70 bg-background/52 px-3 py-2">
                      <p className="text-[0.68rem] uppercase tracking-[0.14em] text-muted-foreground">Reviewed</p>
                      <p className="mt-1 font-medium text-foreground">
                        {selectedMessage.reviewedAt ? formatTimestamp(selectedMessage.reviewedAt) : "Not yet"}
                      </p>
                    </div>
                  </div>
                  <div className="rounded-[0.9rem] border border-border/70 bg-background/52 px-3 py-3">
                    <p className="text-[0.68rem] uppercase tracking-[0.14em] text-muted-foreground">Rationale</p>
                    <p className="mt-2 leading-6">{selectedMessage.rationale}</p>
                  </div>
                  <div className="flex flex-wrap gap-2 pt-2">
                    {selectedMessage.keywords.map((keyword) => (
                      <span
                        key={keyword}
                        className="rounded-full border border-border/70 bg-background/60 px-2.5 py-1 text-[0.68rem] text-muted-foreground"
                      >
                        {keyword}
                      </span>
                    ))}
                  </div>
                </div>
              </details>

              <details className="rounded-[1rem] border border-border/70 bg-background/42 p-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]" open>
                <summary className="cursor-pointer text-sm font-medium text-foreground">Nearby context</summary>
                <div className="mt-3 space-y-2">
                  {loadingContext ? (
                    <div className="rounded-[0.9rem] border border-dashed border-border/60 px-3 py-4 text-sm text-muted-foreground">
                      Loading context...
                    </div>
                  ) : (messageContext?.context.length ?? 0) > 0 ? (
                    messageContext?.context.map((item) => (
                      <div
                        key={item.id}
                        className="rounded-[0.9rem] border border-border/70 bg-background/56 px-3 py-3 text-sm"
                      >
                        <div className="flex items-center justify-between gap-2 text-[0.68rem] uppercase tracking-[0.12em] text-muted-foreground">
                          <span>{item.author}</span>
                          <span>{formatTimestamp(item.createdAt)}</span>
                        </div>
                        <p className="mt-2 line-clamp-4 leading-6 text-foreground/90">{item.content}</p>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-[0.9rem] border border-dashed border-border/60 px-3 py-4 text-sm text-muted-foreground">
                      No context found for this message.
                    </div>
                  )}
                </div>
              </details>
            </>
          ) : (
            <section className="rounded-[1rem] border border-dashed border-border/60 bg-background/38 px-4 py-5 text-sm text-muted-foreground">
              Select a queue item to inspect details.
            </section>
          )}
        </aside>
      </div>

      <details className="rounded-[1rem] border border-border/70 bg-background/42 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
        <summary className="cursor-pointer px-3.5 py-3 font-medium text-foreground">
          Operational diagnostics <span className="ml-2 text-sm text-muted-foreground">(expand only when needed)</span>
        </summary>
        <div className="grid gap-3 px-3.5 pb-3.5 sm:grid-cols-2">
          <div className="space-y-2">
            <p className="text-sm font-medium text-foreground">High-risk channels</p>
            {channelsForOps.length ? (
              channelsForOps.map((channel) => (
                <button
                  key={channel.channelId}
                  type="button"
                  className="w-full rounded-[0.9rem] border border-border/70 bg-background/56 px-3 py-2.5 text-left hover:bg-background/62"
                  onClick={() => handleUpdateSearch({ channel: channel.channelId, label: "all" })}
                >
                  <div className="flex justify-between gap-3 text-sm">
                    <span className="text-foreground">{channel.channelName}</span>
                    <span
                      className={cn("font-medium", channel.riskScore >= 70 ? "text-red-300" : "text-emerald-300")}
                    >
                      {channel.riskScore}/100
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {channel.pending.toLocaleString()} pending · {channel.negative.toLocaleString()} negative · {channel.total.toLocaleString()} total
                  </p>
                </button>
              ))
            ) : (
              <div className="rounded-[0.9rem] border border-dashed border-border/60 px-3 py-4 text-sm text-muted-foreground">
                No channel pressure in this slice.
              </div>
            )}
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium text-foreground">Trend and volume</p>
            {trend.length ? (
              trend.slice(-5).map((point) => (
                <div
                  key={point.bucketStart}
                  className="rounded-[0.9rem] border border-border/70 bg-background/56 px-3 py-2.5 text-sm"
                >
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground">{formatShortDate(point.bucketStart)}</span>
                    <Badge variant="outline" className="rounded-full border-primary/15 bg-background/75">
                      {point.negativeRate.toFixed(1)}% neg
                    </Badge>
                  </div>
                  <p className="mt-1 text-foreground">
                    Total {point.total.toLocaleString()} · Pending {point.pending.toLocaleString()}
                  </p>
                </div>
              ))
            ) : (
              <div className="rounded-[0.9rem] border border-dashed border-border/60 px-3 py-4 text-sm text-muted-foreground">
                No trend buckets for this window.
              </div>
            )}
          </div>
        </div>
      </details>

      <details className="rounded-[1rem] border border-border/70 bg-background/42 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
        <summary className="cursor-pointer px-3.5 py-3 font-medium text-foreground">
          Keyword movement
        </summary>
        <div className="grid gap-2 px-3.5 pb-3.5">
          {keywordShifts.length ? (
            keywordShifts.slice(0, 8).map((shift) => (
              <div
                key={shift.keyword}
                className="rounded-[0.9rem] border border-border/70 bg-background/56 px-3 py-2 text-sm"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="text-foreground">{shift.keyword}</span>
                  <span
                    className={cn(
                      "rounded-full border px-2 py-1 text-xs uppercase tracking-[0.12em]",
                      shift.delta >= 0
                        ? "border-emerald-300/40 bg-emerald-500/10 text-emerald-100"
                        : "border-red-300/40 bg-red-500/10 text-red-100",
                    )}
                  >
                    {shift.delta >= 0 ? "+" : ""}
                    {shift.delta.toFixed(1)}
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Current {shift.current} vs Previous {shift.previous}
                </p>
              </div>
            ))
          ) : (
            <div className="rounded-[0.9rem] border border-dashed border-border/60 px-3 py-4 text-sm text-muted-foreground">
              No keyword movement data available.
            </div>
          )}
        </div>
      </details>

      <div className="flex justify-end">
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() =>
            onUpdateSearch({
              window: "7d",
              label: "all",
              channel: "all",
              sort: "risk",
              q: "",
            })
          }
        >
          <XCircle className="mr-1 size-4" />
          Reset filters
        </Button>
      </div>
    </div>
  );
};
