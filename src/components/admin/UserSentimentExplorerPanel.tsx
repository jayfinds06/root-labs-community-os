import { useEffect, useMemo, useState } from "react";
import {
  ChartColumn,
  Clock3,
  Link2,
  RefreshCcw,
  Search,
  Sparkles,
  UserRound,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  fetchUserInsightDetail,
  fetchUserInsights,
  type UserInsightDetailResponse,
  type UserInsightsResponse,
} from "@/utils/api";

type UserSentimentExplorerPanelProps = {
  initialQuery?: string;
  initialUserId?: string;
  onApplyQuery: (query: string) => void;
  onSelectUser: (userId?: string) => void;
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

const getMeterTone = (value: number): string => {
  if (value >= 68) return "text-emerald-300";
  if (value <= 38) return "text-red-300";
  return "text-amber-200";
};

const normalizeUserId = (value?: string): string | undefined => {
  if (!value) return undefined;
  const trimmed = value.trim();
  return /^\d+$/.test(trimmed) ? trimmed : undefined;
};

const DetailMetric = ({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) => (
  <div className="rounded-[16px] border border-white/8 bg-white/[0.02] px-3 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
    <p className="text-[0.62rem] uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
    <p className="mt-1.5 text-[1rem] font-semibold tracking-[-0.03em] text-foreground">{value}</p>
    <p className="mt-1 text-[0.74rem] leading-5 text-muted-foreground">{detail}</p>
  </div>
);

export const UserSentimentExplorerPanel = ({
  initialQuery = "",
  initialUserId,
  onApplyQuery,
  onSelectUser,
}: UserSentimentExplorerPanelProps) => {
  const [draftQuery, setDraftQuery] = useState(initialQuery);
  const [refreshNonce, setRefreshNonce] = useState(0);
  const [data, setData] = useState<UserInsightsResponse | null>(null);
  const [detail, setDetail] = useState<UserInsightDetailResponse["item"] | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [error, setError] = useState("");
  const [detailError, setDetailError] = useState("");

  useEffect(() => {
    setDraftQuery(initialQuery);
  }, [initialQuery]);

  const normalizedInitialUserId = useMemo(
    () => normalizeUserId(initialUserId),
    [initialUserId],
  );

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");

    fetchUserInsights({ q: initialQuery, limit: 48 })
      .then((response) => {
        if (!active) return;
        setData(response);
      })
      .catch((fetchError) => {
        if (!active) return;
        setError(fetchError instanceof Error ? fetchError.message : "Unable to load user insights.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [initialQuery, refreshNonce]);

  useEffect(() => {
    if (!data?.items.length) {
      setSelectedUserId(undefined);
      return;
    }

    if (
      normalizedInitialUserId &&
      data.items.some((item) => item.userId === normalizedInitialUserId)
    ) {
      setSelectedUserId(normalizedInitialUserId);
      return;
    }

    setSelectedUserId((current) => {
      if (current && data.items.some((item) => item.userId === current)) {
        return current;
      }

      return data.items[0]?.userId;
    });
  }, [data?.items, normalizedInitialUserId]);

  useEffect(() => {
    if (!selectedUserId) {
      setDetail(null);
      return;
    }

    let active = true;
    setLoadingDetail(true);
    setDetailError("");

    fetchUserInsightDetail({
      id: selectedUserId,
      q: initialQuery,
      detailLimit: 8,
    })
      .then((response) => {
        if (!active) return;
        setDetailError("");
        setDetail(response.item);
      })
      .catch((fetchError) => {
        if (!active) return;
        setDetail(null);
        setDetailError(
          fetchError instanceof Error ? fetchError.message : "Unable to load user detail.",
        );
      })
      .finally(() => {
        if (active) setLoadingDetail(false);
      });

    return () => {
      active = false;
    };
  }, [initialQuery, refreshNonce, selectedUserId]);

  useEffect(() => {
    if (!data?.items.length) {
      if (normalizedInitialUserId) {
        onSelectUser(undefined);
      }
      return;
    }

    if (
      !normalizedInitialUserId ||
      !data.items.some((item) => item.userId === normalizedInitialUserId)
    ) {
      onSelectUser(data.items[0]?.userId);
    }
  }, [data?.items, normalizedInitialUserId, onSelectUser]);

  return (
    <div className="grid gap-5">
      <Card className="ui-shell gap-0 overflow-hidden rounded-[30px] border-0 py-0">
        <CardHeader className="relative overflow-hidden border-b border-white/8 px-6 py-5 sm:px-8 sm:py-5">
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(7,10,10,0.9),rgba(4,5,5,0.96))]" />
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_14%_0%,rgba(88,255,170,0.05),transparent_24%)]" />
          <div className="relative grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px] xl:items-end">
            <div className="space-y-2.5">
              <div className="ui-kicker">People explorer</div>
              <div className="max-w-4xl space-y-2">
                <CardTitle className="max-w-3xl text-[1.45rem] leading-[1.08] tracking-[-0.045em] text-white sm:text-[1.75rem]">
                  Track who is posting, how they trend, and who is driving TikTok sharing.
                </CardTitle>
                <CardDescription className="max-w-2xl text-[0.84rem] leading-6 text-white/58">
                  Member activity, sentiment rollups, and TikTok links in one restrained explorer surface.
                </CardDescription>
              </div>
              <div className="flex flex-wrap items-center gap-4 text-[0.72rem] uppercase tracking-[0.16em] text-muted-foreground">
                <span>{loading ? "Updating data" : "Live explorer"}</span>
                <span className="h-1 w-1 rounded-full bg-emerald-300/55" />
                <span>{initialQuery ? `Filter: ${initialQuery}` : "All members"}</span>
              </div>
            </div>

            <div className="relative overflow-hidden rounded-[22px] border border-white/8 bg-[linear-gradient(180deg,rgba(8,11,11,0.58),rgba(4,5,5,0.78))] p-3 shadow-[0_14px_34px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.04)] backdrop-blur-2xl">
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_0%_0%,rgba(88,255,170,0.06),transparent_32%)]" />
              <div className="relative space-y-2">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={draftQuery}
                    onChange={(event) => setDraftQuery(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        onApplyQuery(draftQuery.trim());
                      }
                    }}
                    placeholder="Search people, channels, or message text"
                    className="h-11 rounded-[16px] border-white/8 bg-black/20 pl-10 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] placeholder:text-white/34 focus-visible:border-white/12 focus-visible:bg-black/24"
                  />
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    className="min-w-[120px] rounded-[14px] shadow-[0_10px_24px_rgba(18,60,42,0.16)]"
                    onClick={() => onApplyQuery(draftQuery.trim())}
                  >
                    Apply filters
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="rounded-[14px] border-white/8 bg-white/[0.02]"
                    onClick={() => setRefreshNonce((current) => current + 1)}
                    disabled={loading || loadingDetail}
                  >
                    <RefreshCcw className={cn("size-4", (loading || loadingDetail) && "animate-spin")} />
                    Refresh
                  </Button>
                  <span className="ml-auto text-[0.68rem] uppercase tracking-[0.16em] text-muted-foreground">
                    {initialQuery ? "Filtered" : "Unfiltered"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </CardHeader>
      </Card>

      {error ? (
        <Card className="border-destructive/30 bg-destructive/10">
          <CardContent className="p-4 text-sm text-destructive">{error}</CardContent>
        </Card>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.05fr)_minmax(360px,0.95fr)] xl:items-start">
        <Card className="ui-panel rounded-[30px] border-0 bg-transparent shadow-none">
          <CardHeader className="border-b border-border/60 pb-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="ui-kicker">Member rollup</div>
                <CardTitle className="mt-2 text-[1.32rem] tracking-[-0.03em]">Per-user summary</CardTitle>
                <CardDescription className="mt-1 text-[0.8rem] leading-5">
                  Choose a member to inspect sentiment mix, recent posts, and TikTok activity.
                </CardDescription>
              </div>
              <Badge variant="outline" className="rounded-full bg-background/70">
                {(data?.items.length ?? 0).toLocaleString()} rows
              </Badge>
            </div>
          </CardHeader>

          <CardContent className="space-y-2 pt-4">
            {loading ? (
              <div className="rounded-[20px] border border-border/60 bg-background/45 px-4 py-10 text-center text-sm text-muted-foreground">
                Loading member insights...
              </div>
            ) : data?.items.length ? (
              data.items.map((item) => {
                const isSelected = item.userId === selectedUserId;
                return (
                  <button
                    key={item.userId}
                    type="button"
                    className={cn(
                      "w-full rounded-[20px] border px-3.5 py-3 text-left transition-all duration-200",
                      isSelected
                        ? "border-white/14 bg-[radial-gradient(circle_at_top_left,rgba(88,255,170,0.12),transparent_32%),linear-gradient(180deg,rgba(255,255,255,0.09),rgba(255,255,255,0.03))] shadow-[inset_0_1px_0_rgba(255,255,255,0.09),0_14px_34px_rgba(0,0,0,0.26),0_0_0_1px_rgba(88,255,170,0.05)] backdrop-blur-xl"
                        : "border-border/60 bg-background/45 hover:border-border hover:bg-background/58",
                    )}
                    onClick={() => {
                      setSelectedUserId(item.userId);
                      onSelectUser(item.userId);
                    }}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-start gap-2.5">
                        <Avatar size="md">
                          <AvatarImage src={item.avatarUrl ?? undefined} alt={item.displayName} />
                          <AvatarFallback>
                            {item.displayName.slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <p className="truncate text-[0.92rem] font-medium text-foreground">{item.displayName}</p>
                            <Badge variant="outline" className="rounded-full bg-background/70 px-2 py-0 text-[0.68rem]">
                              @{item.username}
                            </Badge>
                          </div>
                          <p className="mt-1 line-clamp-2 text-[0.78rem] leading-5 text-muted-foreground">
                            {item.summary}
                          </p>
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <div className={cn("text-[0.78rem] font-medium", getMeterTone(item.sentimentMeter))}>
                          {item.sentimentMeter}/100
                        </div>
                        <div className="text-[0.62rem] uppercase tracking-[0.14em] text-muted-foreground">sentiment</div>
                      </div>
                    </div>

                    <div className="mt-2.5 grid gap-2 sm:grid-cols-4">
                      <div className="rounded-[16px] border border-border/60 bg-background/70 px-2.5 py-2">
                        <div className="text-[0.64rem] uppercase tracking-[0.14em] text-muted-foreground">
                          Messages
                        </div>
                        <div className="mt-1 text-[0.95rem] font-semibold text-foreground">
                          {item.messageCount.toLocaleString()}
                        </div>
                      </div>
                      <div className="rounded-[16px] border border-border/60 bg-background/70 px-2.5 py-2">
                        <div className="text-[0.64rem] uppercase tracking-[0.14em] text-muted-foreground">
                          Pending
                        </div>
                        <div className="mt-1 text-[0.95rem] font-semibold text-foreground">
                          {item.pendingCount.toLocaleString()}
                        </div>
                      </div>
                      <div className="rounded-[16px] border border-border/60 bg-background/70 px-2.5 py-2">
                        <div className="text-[0.64rem] uppercase tracking-[0.14em] text-muted-foreground">
                          TikTok links
                        </div>
                        <div className="mt-1 text-[0.95rem] font-semibold text-foreground">
                          {item.tiktokLinkCount.toLocaleString()}
                        </div>
                      </div>
                      <div className="rounded-[16px] border border-border/60 bg-background/70 px-2.5 py-2">
                        <div className="text-[0.64rem] uppercase tracking-[0.14em] text-muted-foreground">
                          Last active
                        </div>
                        <div className="mt-1 text-[0.72rem] font-medium leading-5 text-foreground">
                          {formatTimestamp(item.lastMessageAt)}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })
            ) : (
              <div className="rounded-[20px] border border-dashed border-border/60 bg-background/40 px-4 py-10 text-center">
                <p className="font-medium text-foreground">No members match this scope</p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  Try a broader search or refresh after more Discord messages land.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="ui-panel rounded-[30px] border-0 bg-transparent shadow-none xl:sticky xl:top-24">
          <CardContent className="grid gap-3.5 pt-3 xl:max-h-[calc(100vh-7.5rem)] xl:overflow-y-auto">
            {detailError ? (
              <div className="rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {detailError}
              </div>
            ) : null}

            {loadingDetail ? (
              <div className="rounded-[20px] border border-border/60 bg-background/45 px-4 py-10 text-center text-sm text-muted-foreground">
                Loading member detail...
              </div>
            ) : detail ? (
              <>
                <div className="rounded-[20px] border border-white/12 bg-[radial-gradient(circle_at_top_left,rgba(88,255,170,0.08),transparent_34%),linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.03))] p-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_14px_30px_rgba(0,0,0,0.2)] backdrop-blur-xl">
                  <div className="flex items-start gap-2.5">
                    <Avatar size="md">
                      <AvatarImage src={detail.avatarUrl ?? undefined} alt={detail.displayName} />
                      <AvatarFallback>{detail.displayName.slice(0, 2).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <h3 className="text-[0.92rem] font-semibold text-foreground">{detail.displayName}</h3>
                        <Badge variant="outline" className="rounded-full bg-background/70 px-2 py-0 text-[0.68rem]">
                          @{detail.username}
                        </Badge>
                        <Badge variant="outline" className="rounded-full bg-background/70 px-2 py-0 text-[0.68rem]">
                          {detail.guildName}
                        </Badge>
                      </div>
                      <p className="mt-1.5 line-clamp-3 text-[0.78rem] leading-5 text-muted-foreground">
                        {detail.summary}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <DetailMetric
                    label="Messages"
                    value={detail.messageCount.toLocaleString()}
                    detail={`${detail.classifiedCount.toLocaleString()} classified and ${detail.pendingCount.toLocaleString()} pending.`}
                  />
                  <DetailMetric
                    label="Sentiment"
                    value={`${detail.sentimentMeter}/100`}
                    detail="Higher is more positive across the current scope."
                  />
                  <DetailMetric
                    label="TikTok links"
                    value={detail.tiktokLinkCount.toLocaleString()}
                    detail="Messages from this member containing TikTok URLs."
                  />
                  <DetailMetric
                    label="Avg confidence"
                    value={`${detail.avgConfidence}%`}
                    detail={`Latest activity ${formatTimestamp(detail.lastMessageAt)}.`}
                  />
                </div>

                <div className="grid gap-2.5 sm:grid-cols-3">
                  <div className="rounded-[16px] border border-border/60 bg-background/45 p-2.5">
                    <div className="flex items-center gap-2 text-[0.74rem] text-muted-foreground">
                      <Sparkles className="size-4" />
                      Positive
                    </div>
                    <div className="mt-1 text-[0.98rem] font-semibold text-foreground">
                      {detail.positiveCount.toLocaleString()}
                    </div>
                  </div>
                  <div className="rounded-[16px] border border-border/60 bg-background/45 p-2.5">
                    <div className="flex items-center gap-2 text-[0.74rem] text-muted-foreground">
                      <ChartColumn className="size-4" />
                      Neutral
                    </div>
                    <div className="mt-1 text-[0.98rem] font-semibold text-foreground">
                      {detail.neutralCount.toLocaleString()}
                    </div>
                  </div>
                  <div className="rounded-[16px] border border-border/60 bg-background/45 p-2.5">
                    <div className="flex items-center gap-2 text-[0.74rem] text-muted-foreground">
                      <UserRound className="size-4" />
                      Negative
                    </div>
                    <div className="mt-1 text-[0.98rem] font-semibold text-foreground">
                      {detail.negativeCount.toLocaleString()}
                    </div>
                  </div>
                </div>

                <div className="grid gap-3 lg:grid-cols-2">
                  <div className="rounded-[18px] border border-border/60 bg-background/45 p-3.5">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-[0.84rem] font-medium text-foreground">Top channels</p>
                        <p className="text-[0.74rem] text-muted-foreground">Where this member posts the most.</p>
                      </div>
                    </div>
                    <div className="mt-2.5 grid max-h-40 gap-2 overflow-y-auto pr-1">
                      {detail.topChannels.length ? (
                        detail.topChannels.map((channel) => (
                          <div
                            key={channel.channelId}
                            className="flex items-center justify-between gap-3 rounded-[16px] border border-border/60 bg-background/70 px-2.5 py-2"
                          >
                            <div>
                              <p className="text-[0.8rem] font-medium text-foreground">{channel.channelName}</p>
                              <p className="text-[0.72rem] text-muted-foreground">
                                {channel.messageCount.toLocaleString()} messages
                              </p>
                            </div>
                            <Badge variant="outline" className="rounded-full bg-background/70 px-2 py-0 text-[0.68rem]">
                              {channel.tiktokLinkCount.toLocaleString()} TikTok
                            </Badge>
                          </div>
                        ))
                      ) : (
                        <p className="text-sm text-muted-foreground">No channel activity available.</p>
                      )}
                    </div>
                  </div>

                  <div className="rounded-[18px] border border-border/60 bg-background/45 p-3.5">
                    <p className="text-[0.84rem] font-medium text-foreground">Keywords</p>
                    <div className="mt-2.5 flex max-h-40 flex-wrap gap-1.5 overflow-y-auto pr-1">
                      {detail.topKeywords.length ? (
                        detail.topKeywords.map((keyword) => (
                          <Badge
                            key={keyword.keyword}
                            variant="outline"
                            className="rounded-full bg-background/70 px-2 py-0 text-[0.68rem]"
                          >
                            {keyword.keyword} · {keyword.count}
                          </Badge>
                        ))
                      ) : (
                        <p className="text-sm text-muted-foreground">No extracted keywords yet.</p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="grid gap-3">
                  <div className="rounded-[18px] border border-border/60 bg-background/45 p-3.5">
                    <p className="text-[0.84rem] font-medium text-foreground">Recent messages</p>
                    <div className="mt-2.5 grid max-h-56 gap-2 overflow-y-auto pr-1">
                      {detail.recentMessages.map((message) => (
                        <div
                          key={message.id}
                          className="rounded-[16px] border border-border/60 bg-background/70 px-2.5 py-2"
                        >
                          <div className="flex flex-wrap items-center gap-1.5">
                            <Badge variant="outline" className="rounded-full bg-background px-2 py-0 text-[0.68rem]">
                              {message.channelName}
                            </Badge>
                            <Badge variant="outline" className="rounded-full bg-background px-2 py-0 text-[0.68rem]">
                              {message.label}
                            </Badge>
                            {message.containsTikTokLink ? (
                              <Badge variant="secondary" className="rounded-full px-2 py-0 text-[0.68rem]">
                                TikTok link
                              </Badge>
                            ) : null}
                            <span className="text-[0.68rem] text-muted-foreground">
                              {formatTimestamp(message.createdAt)}
                            </span>
                          </div>
                          <p className="mt-1.5 line-clamp-3 text-[0.76rem] leading-5 text-muted-foreground">
                            {message.content}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-[18px] border border-border/60 bg-background/45 p-3.5">
                    <div className="flex items-center gap-2">
                      <Link2 className="size-4 text-muted-foreground" />
                      <p className="text-[0.84rem] font-medium text-foreground">Recent TikTok posts</p>
                    </div>
                    <div className="mt-2.5 grid max-h-52 gap-2 overflow-y-auto pr-1">
                      {detail.recentTikTokMessages.length ? (
                        detail.recentTikTokMessages.map((message) => (
                          <div
                            key={message.id}
                            className="rounded-[16px] border border-border/60 bg-background/70 px-2.5 py-2"
                          >
                            <div className="flex flex-wrap items-center gap-1.5">
                              <Badge variant="outline" className="rounded-full bg-background px-2 py-0 text-[0.68rem]">
                                {message.channelName}
                              </Badge>
                              <span className="text-[0.68rem] text-muted-foreground">
                                {formatTimestamp(message.createdAt)}
                              </span>
                            </div>
                            <p className="mt-1.5 line-clamp-3 text-[0.76rem] leading-5 text-muted-foreground">
                              {message.content}
                            </p>
                          </div>
                        ))
                      ) : (
                        <div className="rounded-[16px] border border-dashed border-border/60 bg-background/60 px-3 py-3 text-[0.8rem] text-muted-foreground">
                          No TikTok links found for this member in the current scope.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="rounded-[20px] border border-dashed border-border/60 bg-background/40 px-4 py-10 text-center">
                <Clock3 className="mx-auto size-5 text-muted-foreground" />
                <p className="mt-3 font-medium text-foreground">Select a member</p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  Pick someone from the rollup list to inspect their summary and recent posts.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
