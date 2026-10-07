import type { CSSProperties, FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import {
  IconActivityHeartbeat,
  IconArrowUpRight,
  IconBolt,
  IconChartBar,
  IconDatabase,
  IconHelp,
  IconLayoutDashboard,
  IconMessageCircle,
  IconRefresh,
  IconSettings,
  IconTrash,
} from "@tabler/icons-react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import {
  Command,
  LoaderCircle,
  LogIn,
  MessageSquare,
  RefreshCcw,
} from "lucide-react";
import { toast } from "sonner";
import logoSrc from "../public/logo.webp";
import { AppSidebar, type SidebarResourceItem } from "@/components/app-sidebar";
import { DataExplorerPanel } from "@/components/admin/DataExplorerPanel";
import { OverviewWorkspace } from "@/components/admin/OverviewWorkspace";
import { SettingsPanel } from "@/components/admin/SettingsPanel";
import { SentimentWorkspace } from "@/components/admin/SentimentWorkspace";
import { UserSentimentExplorerPanel } from "@/components/admin/UserSentimentExplorerPanel";
import {
  OverviewChatSheet,
  type OverviewChatContext,
  type OverviewChatMessage,
  type OverviewChatThreadSummary,
} from "@/components/admin/OverviewChatPanel";
import { SiteHeader } from "@/components/site-header";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
import { Label } from "@/components/ui/label";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  type DashboardSearch,
  normalizeDashboardSearch,
  normalizeSentimentSearch,
} from "./admin-route-search";
import { signIn, signOut, useSession } from "./lib/auth-client";
import {
  fetchAdminUsers,
  fetchAdminChatStream,
  fetchOverview,
  fetchSyncSettings,
  fetchSentimentChannels,
  fetchSentimentMessages,
  fetchUserInsights,
  resetDiscordData,
  triggerDiscordSync,
  updateAdminUser,
  updateSyncSettings,
  createAdminUser,
  deleteAdminUser,
  type AdminChatResponse,
  type AdminChatStreamEvent,
  type AdminUser,
  type OverviewResponse,
  type SentimentChannelsResponse,
  type SentimentLabel,
  type SentimentMessageSort,
  type SentimentMessagesResponse,
  type SentimentWindow,
  type SyncSettingsResponse,
  type UserInsightsResponse,
} from "./utils/api";

type DashboardTab = "overview" | "sentiment" | "explorer" | "settings";

type LoginForm = {
  email: string;
  password: string;
};

type ChatThread = {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messages: OverviewChatMessage[];
};

const defaultLogin: LoginForm = {
  email: "",
  password: "",
};

const THINKING_TEXT = "Thinking...";

const buildTopContentPreview = (
  overview: OverviewResponse,
): OverviewChatContext["topContent"] => {
  const shareCounts = new Map<string, number>();

  for (const creator of overview.drilldowns.creatorsPosting) {
    for (const url of creator.links) {
      shareCounts.set(url, (shareCounts.get(url) ?? 0) + 1);
    }
  }

  return Array.from(shareCounts.entries())
    .map(([url, shareCount]) => ({
      url,
      shareCount,
      source: "discord-link-shares" as const,
    }))
    .sort((left, right) => right.shareCount - left.shareCount || left.url.localeCompare(right.url))
    .slice(0, 3);
};

const buildOverviewChatContext = (
  overview: OverviewResponse,
): OverviewChatContext => ({
  generatedAt: overview.generatedAt,
  healthScore: overview.rangeMetrics.healthScore.value,
  monitoredChannels: overview.ops.monitoredChannels,
  guildCount: overview.ops.guildCount,
  backlogCount: overview.ops.sentimentBacklog.pendingCount,
  activeCreatorCount: overview.rangeMetrics.activeUsers.value,
  inactiveCreatorCount: overview.rangeMetrics.inactiveUsers.value,
  topContent: buildTopContentPreview(overview),
  syncExecutionMode: overview.ops.sync.executionMode,
  syncInProgress: overview.ops.sync.inProgress,
  attentionChannels: overview.attentionChannels.slice(0, 4).map((channel) => ({
    channelId: channel.channelId,
    channelName: channel.channelName,
    negativeRate: channel.negativeRate,
    negativeDelta: channel.negativeDelta,
    pendingCount: channel.pendingCount,
  })),
});

const toDateInputValue = (value: Date): string => {
  const year = value.getFullYear();
  const month = `${value.getMonth() + 1}`.padStart(2, "0");
  const day = `${value.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const parseAdminChatStreamEvent = (chunk: string): AdminChatStreamEvent | null => {
  const raw = chunk.trim();
  if (!raw) return null;
  const jsonLine = raw
    .split("\n")
    .find((line) => line.startsWith("data: "))
    ?.replace(/^data:\s*/, "");

  if (!jsonLine) return null;

  try {
    return JSON.parse(jsonLine) as AdminChatStreamEvent;
  } catch {
    return null;
  }
};

const CHAT_THREADS_STORAGE_KEY = "rl-discord-admin-chat-threads-v1";
const CHAT_THREADS_LIMIT = 40;

const tabLabels: Record<DashboardTab, string> = {
  overview: "Overview",
  sentiment: "Sentiment",
  explorer: "Explorer",
  settings: "Settings",
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

const normalizeThreadTitle = (value: string): string => {
  const compact = value.trim().replace(/\s+/g, " ");
  if (!compact) {
    return "New thread";
  }

  return compact.length > 56 ? `${compact.slice(0, 53)}...` : compact;
};

const deriveThreadTitle = (messages: OverviewChatMessage[]): string => {
  const firstQuestion = messages.find(
    (message) => message.role === "user" && message.content.trim().length > 0,
  );
  return firstQuestion ? normalizeThreadTitle(firstQuestion.content) : "New thread";
};

const createChatThread = (messages: OverviewChatMessage[] = []): ChatThread => {
  const now = Date.now();
  return {
    id: crypto.randomUUID(),
    title: deriveThreadTitle(messages),
    createdAt: now,
    updatedAt: now,
    messages,
  };
};

const isChatRole = (value: unknown): value is OverviewChatMessage["role"] =>
  value === "user" || value === "assistant";

const isChatStatus = (value: unknown): value is OverviewChatMessage["status"] =>
  value === undefined || value === "streaming" || value === "done" || value === "error";

const parseStoredChatThreads = (rawValue: string | null): ChatThread[] => {
  if (!rawValue) {
    return [];
  }

  try {
    const parsed = JSON.parse(rawValue);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .flatMap((item) => {
        if (!item || typeof item !== "object") {
          return [];
        }

        const threadRecord = item as Record<string, unknown>;
        const rawMessages = Array.isArray(threadRecord.messages) ? threadRecord.messages : [];

        const messages = rawMessages.flatMap((rawMessage) => {
          if (!rawMessage || typeof rawMessage !== "object") {
            return [];
          }

          const messageRecord = rawMessage as Record<string, unknown>;
          if (
            !isChatRole(messageRecord.role) ||
            typeof messageRecord.id !== "string" ||
            typeof messageRecord.content !== "string" ||
            typeof messageRecord.createdAt !== "number" ||
            !isChatStatus(messageRecord.status)
          ) {
            return [];
          }

          return [
            {
              id: messageRecord.id,
              role: messageRecord.role,
              content: messageRecord.content,
              createdAt: messageRecord.createdAt,
              status: messageRecord.status,
              citations: Array.isArray(messageRecord.citations)
                ? (messageRecord.citations as OverviewChatMessage["citations"])
                : undefined,
              answer:
                messageRecord.answer && typeof messageRecord.answer === "object"
                  ? (messageRecord.answer as OverviewChatMessage["answer"])
                  : undefined,
            },
          ];
        });

        const createdAt =
          typeof threadRecord.createdAt === "number" ? threadRecord.createdAt : Date.now();
        const updatedAt =
          typeof threadRecord.updatedAt === "number" ? threadRecord.updatedAt : createdAt;
        const title =
          typeof threadRecord.title === "string"
            ? normalizeThreadTitle(threadRecord.title)
            : deriveThreadTitle(messages);

        return [
          {
            id:
              typeof threadRecord.id === "string" && threadRecord.id.length
                ? threadRecord.id
                : crypto.randomUUID(),
            title,
            createdAt,
            updatedAt,
            messages,
          },
        ];
      })
      .slice(0, CHAT_THREADS_LIMIT);
  } catch {
    return [];
  }
};

const sortChatThreads = (threads: ChatThread[]): ChatThread[] =>
  [...threads].sort((a, b) => b.updatedAt - a.updatedAt);

const toChatThreadSummary = (thread: ChatThread): OverviewChatThreadSummary => {
  const latestMessage = [...thread.messages].reverse().find((message) => message.content.trim());
  return {
    id: thread.id,
    title: thread.title,
    updatedAt: thread.updatedAt,
    messageCount: thread.messages.length,
    preview: latestMessage ? latestMessage.content.replace(/\s+/g, " ").trim() : "",
  };
};

const downloadJson = (filename: string, payload: unknown) => {
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
};

type AdminDashboardProps = {
  workspace?: "dashboard" | "sentiment";
};

const AdminDashboard = ({
  workspace = "dashboard",
}: AdminDashboardProps) => {
  const navigate = useNavigate();
  const session = useSession();
  const currentUser = session.data?.user;
  const isSentimentWorkspace = workspace === "sentiment";
  const locationSearch = useRouterState({
    select: (state) => state.location.searchStr,
  });
  const dashboardSearch = normalizeDashboardSearch(new URLSearchParams(locationSearch));
  const sentimentSearch = normalizeSentimentSearch(new URLSearchParams(locationSearch));

  const [loginForm, setLoginForm] = useState<LoginForm>(defaultLogin);
  const [loginError, setLoginError] = useState("");
  const [loggingIn, setLoggingIn] = useState(false);

  const [activeTab, setActiveTab] = useState<DashboardTab>(dashboardSearch.tab);
  const [refreshKey, setRefreshKey] = useState(0);
  const [clearDialogOpen, setClearDialogOpen] = useState(false);

  const [overview, setOverview] = useState<OverviewResponse | null>(null);
  const [overviewError, setOverviewError] = useState("");
  const [loadingOverview, setLoadingOverview] = useState(false);
  const [overviewRange, setOverviewRange] = useState(() => {
    const now = new Date();
    const from = new Date(now);
    from.setDate(now.getDate() - 6);
    return {
      from: toDateInputValue(from),
      to: toDateInputValue(now),
    };
  });
  const [userInsights, setUserInsights] = useState<UserInsightsResponse | null>(null);
  const [loadingUserInsights, setLoadingUserInsights] = useState(false);

  const [sentimentChannels, setSentimentChannels] =
    useState<SentimentChannelsResponse | null>(null);
  const [sentimentMessages, setSentimentMessages] =
    useState<SentimentMessagesResponse | null>(null);
  const [sentimentError, setSentimentError] = useState("");
  const [loadingSentiment, setLoadingSentiment] = useState(false);
  const [sentimentCursorHistory, setSentimentCursorHistory] = useState<string[]>([]);
  const [syncSettings, setSyncSettings] = useState<SyncSettingsResponse | null>(null);
  const [savingSyncSettings, setSavingSyncSettings] = useState(false);
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([]);
  const [adminUsersTotal, setAdminUsersTotal] = useState(0);
  const [adminUsersSearch, setAdminUsersSearch] = useState("");
  const [adminUsersError, setAdminUsersError] = useState("");
  const [loadingAdminUsers, setLoadingAdminUsers] = useState(false);

  const [syncing, setSyncing] = useState(false);
  const [droppingAll, setDroppingAll] = useState(false);
  const [chatSheetOpen, setChatSheetOpen] = useState(false);
  const [chatDraft, setChatDraft] = useState("");
  const [chatThreads, setChatThreads] = useState<ChatThread[]>([]);
  const [activeChatThreadId, setActiveChatThreadId] = useState<string | null>(null);
  const [chatStorageReady, setChatStorageReady] = useState(false);
  const [chatError, setChatError] = useState("");
  const [sendingChat, setSendingChat] = useState(false);
  const [chatComposerFocusRequest, setChatComposerFocusRequest] = useState(0);

  useEffect(() => {
    const storedThreads = parseStoredChatThreads(
      window.localStorage.getItem(CHAT_THREADS_STORAGE_KEY),
    );
    const initialThreads = storedThreads.length ? sortChatThreads(storedThreads) : [createChatThread()];

    setChatThreads(initialThreads);
    setActiveChatThreadId(initialThreads[0]?.id ?? null);
    setChatStorageReady(true);
  }, []);

  useEffect(() => {
    if (!chatStorageReady) {
      return;
    }

    window.localStorage.setItem(CHAT_THREADS_STORAGE_KEY, JSON.stringify(chatThreads));
  }, [chatStorageReady, chatThreads]);

  const activeChatThread = activeChatThreadId
    ? chatThreads.find((thread) => thread.id === activeChatThreadId) ?? null
    : null;
  const chatMessages = activeChatThread?.messages ?? [];
  const chatThreadSummaries = chatThreads.map(toChatThreadSummary);

  const createAndActivateChatThread = () => {
    const nextThread = createChatThread();
    setChatThreads((current) =>
      sortChatThreads([nextThread, ...current]).slice(0, CHAT_THREADS_LIMIT),
    );
    setActiveChatThreadId(nextThread.id);
    setChatDraft("");
    setChatError("");
    return nextThread.id;
  };

  const updateThreadMessages = (
    threadId: string,
    updater: (messages: OverviewChatMessage[]) => OverviewChatMessage[],
  ) => {
    setChatThreads((current) => {
      let found = false;
      const nextThreads = current.map((thread) => {
        if (thread.id !== threadId) {
          return thread;
        }

        found = true;
        const nextMessages = updater(thread.messages);
        return {
          ...thread,
          messages: nextMessages,
          title: deriveThreadTitle(nextMessages),
          updatedAt: Date.now(),
        };
      });

      if (!found) {
        const nextMessages = updater([]);
        const createdAt = Date.now();
        return sortChatThreads([
          {
            id: threadId,
            title: deriveThreadTitle(nextMessages),
            createdAt,
            updatedAt: createdAt,
            messages: nextMessages,
          },
          ...nextThreads,
        ]).slice(0, CHAT_THREADS_LIMIT);
      }

      return sortChatThreads(nextThreads).slice(0, CHAT_THREADS_LIMIT);
    });
  };

  const handleThreadDelete = (threadId: string) => {
    const remaining = chatThreads.filter((thread) => thread.id !== threadId);
    if (!remaining.length) {
      const replacement = createChatThread();
      setChatThreads([replacement]);
      setActiveChatThreadId(replacement.id);
      setChatDraft("");
      setChatError("");
      return;
    }

    const sortedRemaining = sortChatThreads(remaining);
    setChatThreads(sortedRemaining);

    if (activeChatThreadId === threadId) {
      setActiveChatThreadId(sortedRemaining[0].id);
      setChatDraft("");
      setChatError("");
    }
  };

  const handleThreadSelect = (threadId: string) => {
    if (sendingChat || threadId === activeChatThreadId) {
      return;
    }

    setActiveChatThreadId(threadId);
    setChatDraft("");
    setChatError("");
  };

  useEffect(() => {
    if (isSentimentWorkspace) {
      setActiveTab("sentiment");
      return;
    }

    setActiveTab(dashboardSearch.tab);
  }, [dashboardSearch.tab, isSentimentWorkspace]);

  const openDashboardTab = (
    tab: Exclude<DashboardTab, "sentiment">,
    overrides?: Partial<DashboardSearch>,
  ) => {
    setActiveTab(tab);
    void navigate({
      to: "/dashboard",
      search: {
        tab,
        explorerView: overrides?.explorerView,
        resource: overrides?.resource,
        rowId: overrides?.rowId,
        userId: overrides?.userId,
        q: overrides?.q,
        sentimentLabel: overrides?.sentimentLabel,
      },
    });
  };

  const updateSentimentRouteSearch = (
    patch: Partial<typeof sentimentSearch>,
    options?: { resetCursor?: boolean },
  ) => {
    const shouldResetCursor =
      options?.resetCursor ??
      ("window" in patch ||
        "label" in patch ||
        "channel" in patch ||
        "q" in patch ||
        "sort" in patch);

    if (shouldResetCursor) {
      setSentimentCursorHistory([]);
    }

    void navigate({
      to: "/dashboard/sentiment",
      search: {
        ...sentimentSearch,
        ...patch,
        cursor: shouldResetCursor ? "" : (patch.cursor ?? sentimentSearch.cursor),
      },
    });
  };

  const sentimentView = isSentimentWorkspace
    ? {
        window: sentimentSearch.window,
        label: sentimentSearch.label,
        channelId: sentimentSearch.channel === "all" ? undefined : sentimentSearch.channel,
        q: sentimentSearch.q || undefined,
        sort: sentimentSearch.sort,
        cursor: sentimentSearch.cursor || undefined,
        limit: 50,
      }
    : {
        window: "7d" as SentimentWindow,
        label: "all" as SentimentLabel,
        channelId: undefined,
        q: undefined,
        sort: "risk" as SentimentMessageSort,
        cursor: undefined,
        limit: 6,
      };

  useEffect(() => {
    if (!currentUser) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        event.key.toLowerCase() !== "k" ||
        (!event.metaKey && !event.ctrlKey)
      ) {
        return;
      }

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
      if (!isSentimentWorkspace) {
        setActiveTab("overview");
      }
      setChatSheetOpen(true);
      setChatComposerFocusRequest((requestId) => requestId + 1);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentUser, isSentimentWorkspace]);

  useEffect(() => {
    if (!currentUser) return;

    let cancelled = false;
    setLoadingOverview(true);
    setOverviewError("");

    fetchOverview(overviewRange)
      .then((response) => {
        if (cancelled) return;
        setOverview(response);
      })
      .catch(() => {
        if (cancelled) return;
        setOverviewError("Unable to load overview metrics.");
      })
      .finally(() => {
        if (!cancelled) setLoadingOverview(false);
      });

    return () => {
      cancelled = true;
    };
  }, [currentUser, overviewRange, refreshKey]);

  useEffect(() => {
    if (!currentUser) return;

    let cancelled = false;
    setLoadingUserInsights(true);

    fetchUserInsights({ limit: 24 })
      .then((response) => {
        if (cancelled) return;
        setUserInsights(response);
      })
      .catch(() => {
        if (cancelled) return;
        setUserInsights(null);
      })
      .finally(() => {
        if (!cancelled) setLoadingUserInsights(false);
      });

    return () => {
      cancelled = true;
    };
  }, [currentUser, refreshKey]);

  useEffect(() => {
    if (!currentUser) return;

    let cancelled = false;
    setLoadingSentiment(true);
    setSentimentError("");

    Promise.all([
      fetchSentimentChannels(sentimentView.window, {
        channelId: sentimentView.channelId,
      }),
      fetchSentimentMessages({
        window: sentimentView.window,
        label: sentimentView.label,
        channelId: sentimentView.channelId,
        q: sentimentView.q,
        sort: sentimentView.sort,
        limit: sentimentView.limit,
        cursor: sentimentView.cursor,
      }),
    ])
      .then(([channels, messages]) => {
        if (cancelled) return;
        setSentimentChannels(channels);
        setSentimentMessages(messages);
      })
      .catch(() => {
        if (cancelled) return;
        setSentimentError("Unable to load sentiment data.");
      })
      .finally(() => {
        if (!cancelled) setLoadingSentiment(false);
      });

    return () => {
      cancelled = true;
    };
  }, [
    currentUser,
    refreshKey,
    sentimentView.channelId,
    sentimentView.cursor,
    sentimentView.label,
    sentimentView.limit,
    sentimentView.q,
    sentimentView.sort,
    sentimentView.window,
  ]);

  useEffect(() => {
    if (!currentUser) return;

    let cancelled = false;
    setLoadingAdminUsers(true);
    setAdminUsersError("");

    Promise.all([
      fetchSyncSettings(),
      fetchAdminUsers(adminUsersSearch),
    ])
      .then(([settings, usersResponse]) => {
        if (cancelled) return;
        setSyncSettings(settings);
        setAdminUsers(usersResponse.items);
        setAdminUsersTotal(usersResponse.total);
      })
      .catch((error) => {
        if (cancelled) return;
        setAdminUsersError(
          error instanceof Error ? error.message : "Unable to load admin settings.",
        );
      })
      .finally(() => {
        if (!cancelled) setLoadingAdminUsers(false);
      });

    return () => {
      cancelled = true;
    };
  }, [adminUsersSearch, currentUser, refreshKey]);

  useEffect(() => {
    if (!currentUser || !overview?.ops.sync.inProgress) {
      return;
    }

    const intervalId = window.setInterval(() => {
      setRefreshKey((current) => current + 1);
    }, 5000);

    return () => window.clearInterval(intervalId);
  }, [currentUser, overview?.ops.sync.inProgress]);

  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoggingIn(true);
    setLoginError("");

    try {
      const result = await signIn.email({
        email: loginForm.email,
        password: loginForm.password,
        callbackURL: isSentimentWorkspace ? "/dashboard/sentiment" : "/dashboard",
      });

      if (result?.error) {
        setLoginError(result.error.message ?? "Unable to sign in.");
        return;
      }

      toast.success("Signed in.");
    } catch {
      setLoginError("Unable to sign in.");
    } finally {
      setLoggingIn(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);

    try {
      const response = await triggerDiscordSync();
      if (!response.ok) {
        toast.error(response.reason ?? "Sync request was not accepted.");
        return;
      }

      toast.success("Sync requested.");
      setRefreshKey((current) => current + 1);
    } catch {
      toast.error("Unable to trigger sync.");
    } finally {
      setSyncing(false);
    }
  };

  const handleDropAll = async () => {
    setDroppingAll(true);

    try {
      const response = await resetDiscordData();
      if (!response.ok) {
        toast.error(response.reason ?? "Drop all request failed.");
        return;
      }

      const deletedTotal = response.deleted
        ? Object.values(response.deleted).reduce((sum, value) => sum + value, 0)
        : 0;

      setClearDialogOpen(false);
      toast.success(
        deletedTotal > 0
          ? `Dropped ${deletedTotal.toLocaleString()} stored Discord records.`
          : "Drop all completed.",
      );
      setRefreshKey((current) => current + 1);
    } catch {
      toast.error("Unable to drop all Discord data.");
    } finally {
      setDroppingAll(false);
    }
  };

  const refreshAdminSettings = async () => {
    const [settings, usersResponse] = await Promise.all([
      fetchSyncSettings(),
      fetchAdminUsers(adminUsersSearch),
    ]);

    setAdminUsersError("");
    setSyncSettings(settings);
    setAdminUsers(usersResponse.items);
    setAdminUsersTotal(usersResponse.total);
  };

  const handleSaveSyncSettings = async (cadenceMinutes: number) => {
    setSavingSyncSettings(true);

    try {
      const response = await updateSyncSettings({
        cadenceMinutes,
        allowRawDataAccess: syncSettings?.allowRawDataAccess,
      });
      setSyncSettings({
        cadenceMinutes: response.cadenceMinutes,
        allowRawDataAccess: response.allowRawDataAccess,
        limits: response.limits,
      });
      setRefreshKey((current) => current + 1);
    } finally {
      setSavingSyncSettings(false);
    }
  };

  const handleSaveRawDataAccess = async (allowRawDataAccess: boolean) => {
    setSavingSyncSettings(true);

    try {
      const response = await updateSyncSettings({
        cadenceMinutes: syncSettings?.cadenceMinutes,
        allowRawDataAccess,
      });
      setSyncSettings({
        cadenceMinutes: response.cadenceMinutes,
        allowRawDataAccess: response.allowRawDataAccess,
        limits: response.limits,
      });
      setRefreshKey((current) => current + 1);
    } finally {
      setSavingSyncSettings(false);
    }
  };

  const handleCreateAdminUser = async (input: {
    name: string;
    email: string;
    password: string;
    role: "admin" | "user";
  }) => {
    await createAdminUser(input);
    await refreshAdminSettings();
  };

  const handleUpdateAdminUser = async (input: {
    userId: string;
    name: string;
    email: string;
    role: "admin" | "user";
  }) => {
    await updateAdminUser(input);
    await refreshAdminSettings();
  };

  const handleDeleteAdminUser = async (userId: string) => {
    await deleteAdminUser(userId);
    await refreshAdminSettings();
  };

  const sidebarResources: SidebarResourceItem[] = [
    {
      name: "SentimentMeter",
      icon: IconActivityHeartbeat,
      value:
        loadingUserInsights && !userInsights
          ? "Loading"
          : `${userInsights?.summary.sentimentMeter ?? 50}/100`,
      gaugeValue: userInsights?.summary.sentimentMeter ?? 50,
      hint:
        userInsights
          ? `${userInsights.summary.positiveMessages.toLocaleString()} positive vs ${userInsights.summary.negativeMessages.toLocaleString()} negative classified messages.`
          : "Aggregated member sentiment across current Discord history.",
    },
    {
      name: "TikTok links",
      icon: IconChartBar,
      value:
        loadingUserInsights && !userInsights
          ? "Loading"
          : (userInsights?.summary.totalTikTokLinks ?? 0).toLocaleString(),
      hint: userInsights
        ? `${userInsights.summary.totalUsers.toLocaleString()} people contributed tracked TikTok posts.`
        : "Counting messages that include TikTok URLs.",
    },
  ];

  const syncRuntime = overview?.ops.sync ?? null;
  const syncPollIntervalMinutes = overview?.ops.pollIntervalMinutes ?? null;
  const syncInProgress = syncing || Boolean(syncRuntime?.inProgress);
  const syncStatusLabel = syncInProgress
    ? "Updating data"
    : syncRuntime?.lastFailureAt &&
        (!syncRuntime.lastSuccessAt || syncRuntime.lastFailureAt > syncRuntime.lastSuccessAt)
      ? "Update issue"
      : syncRuntime?.executionMode === "disabled"
        ? "Updates paused"
        : "Data current";
  const syncDetailLabel = syncInProgress
    ? "Refreshing the latest Discord activity and sentiment snapshot."
    : syncRuntime?.lastFailureReason
      ? "The latest refresh needs attention before the snapshot is fully current."
      : "The latest community snapshot is ready to review.";
  const lastSyncedAtLabel = formatTimestamp(syncRuntime?.lastSuccessAt ?? null);
  const settingsWorkerLabel =
    typeof syncPollIntervalMinutes === "number" && Number.isFinite(syncPollIntervalMinutes)
      ? `Worker cadence ${Math.round(syncPollIntervalMinutes)}m`
      : syncRuntime
        ? "Worker cadence unavailable"
        : "Worker status unavailable";
  const currentSection = isSentimentWorkspace ? "sentiment" : activeTab;
  const explorerView = dashboardSearch.explorerView ?? "datasets";
  const headerSubtitle =
    currentSection === "overview"
      ? "Community health, participation, and channels to review."
      : currentSection === "sentiment"
        ? "Risk-ranked channels, queue inspection, and explorer handoff."
        : currentSection === "explorer"
          ? explorerView === "people"
            ? "Per-user sentiment summaries, TikTok link counts, and live drilldown."
            : "Raw Discord rows and stored application state."
          : "Configure sync cadence and manage dashboard users.";
  const headerStatusLabel = overview
    ? `Updated ${formatTimestamp(overview.generatedAt)}`
    : loadingOverview && !isSentimentWorkspace
      ? "Loading snapshot"
      : "Snapshot unavailable";
  const explorerInitialState = useMemo(
    () =>
      activeTab === "explorer" && explorerView === "datasets"
        ? {
            resource: dashboardSearch.resource ?? "discord-messages",
            rowId: dashboardSearch.rowId,
            query: dashboardSearch.q,
            filters: dashboardSearch.sentimentLabel
              ? { sentimentLabel: dashboardSearch.sentimentLabel }
              : undefined,
          }
        : undefined,
    [
      activeTab,
      dashboardSearch.q,
      dashboardSearch.resource,
      dashboardSearch.rowId,
      dashboardSearch.sentimentLabel,
      explorerView,
    ],
  );

  const overviewChatContext: OverviewChatContext | null = overview
    ? buildOverviewChatContext(overview)
    : null;

  const submitChatQuestion = async (question: string) => {
    const trimmedQuestion = question.trim();
    if (!trimmedQuestion || sendingChat) {
      return;
    }

    const targetThreadId =
      activeChatThreadId && chatThreads.some((thread) => thread.id === activeChatThreadId)
        ? activeChatThreadId
        : createAndActivateChatThread();

    const userMessage: OverviewChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: trimmedQuestion,
      createdAt: Date.now(),
      status: "done",
    };
    const assistantMessageId = crypto.randomUUID();

    updateThreadMessages(targetThreadId, (current) => [
      ...current,
      userMessage,
      {
        id: assistantMessageId,
        role: "assistant",
        content: THINKING_TEXT,
        createdAt: Date.now() + 1,
        status: "streaming",
      },
    ]);
    setChatDraft("");
    setChatError("");
    setSendingChat(true);

    try {
      const response = await fetchAdminChatStream({
        question: trimmedQuestion,
        context: {
          window: sentimentView.window,
          channelId: sentimentView.channelId,
        },
      });

      const body = response.body;
      if (!body) {
        throw new Error("The chat stream did not return a response body.");
      }

      const reader = body.getReader();
      const decoder = new TextDecoder();
      let bufferedEvents = "";
      let streamedAnswer = "";
      let done = false;

      let citations: AdminChatResponse["citations"] = [];
      let evidence: AdminChatResponse["evidence"] = {};
      let guardrails: AdminChatResponse["guardrails"] = {
        readOnly: true,
        toolsUsed: [],
      };

      const applyStreamingChunk = (chunk: string) => {
        streamedAnswer = `${streamedAnswer}${chunk}`;
        updateThreadMessages(targetThreadId, (current) =>
          current.map((message) =>
            message.id === assistantMessageId
              ? {
                  ...message,
                  content: streamedAnswer,
                  status: "streaming",
                }
              : message,
          ),
        );
      };

      const applyFinalMessage = (status: "done" | "error", value = streamedAnswer) => {
        done = true;
        updateThreadMessages(targetThreadId, (current) =>
          current.map((message) =>
            message.id === assistantMessageId
              ? {
                  ...message,
                  content: value,
                  createdAt: message.createdAt,
                  status,
                  citations: citations.length ? citations : message.citations,
                  answer: {
                    answer: value,
                    citations,
                    evidence,
                    guardrails,
                  },
                }
              : message,
          ),
        );
      };

      const handleEvent = (event: AdminChatStreamEvent) => {
        if (done) return;

        if (event.type === "meta") {
          citations = event.citations;
          evidence = event.evidence;
          guardrails = event.guardrails;
          return;
        }

        if (event.type === "text") {
          applyStreamingChunk(event.value);
          return;
        }

        if (event.type === "done") {
          applyFinalMessage("done");
          return;
        }

        if (event.type === "error") {
          setChatError(event.message);
          toast.error(event.message);
          applyFinalMessage("error", event.message);
          return;
        }
      };

      try {
        while (true) {
          const { done: streamDone, value } = await reader.read();
          if (streamDone) break;
          if (!value) continue;

          bufferedEvents += decoder.decode(value, { stream: true });
          const events = bufferedEvents.split("\n\n");
          bufferedEvents = events.pop() ?? "";

          for (const eventChunk of events) {
            const event = parseAdminChatStreamEvent(eventChunk);
            if (!event) {
              continue;
            }
            handleEvent(event);
            if (done) break;
          }

          if (done) break;
        }

        if (bufferedEvents.trim()) {
          const event = parseAdminChatStreamEvent(bufferedEvents);
          if (event) {
            handleEvent(event);
          }
        }

        if (!done) {
          applyFinalMessage("done");
        }
      } catch (error) {
        throw error;
      } finally {
        reader.releaseLock();
      }
    } catch {
      setChatError("Unable to reach the copilot right now.");
      toast.error("Copilot request failed.");
      updateThreadMessages(targetThreadId, (current) =>
        current.map((message) =>
          message.id === assistantMessageId
            ? {
                ...message,
                content: "I couldn't reach the admin chat endpoint. Try again in a moment.",
                status: "error",
              }
            : message,
        ),
      );
    } finally {
      setSendingChat(false);
    }
  };

  const handlePromptSelect = (value: string) => {
    setChatDraft(value);
    void submitChatQuestion(value);
  };

  const resetChat = () => {
    if (!activeChatThread?.messages.length) {
      return;
    }

    createAndActivateChatThread();
  };

  const exportActiveChatThread = () => {
    if (!activeChatThread) {
      toast.error("No active chat thread to export.");
      return;
    }

    const payload = {
      exportedAt: Date.now(),
      workspace,
      thread: {
        id: activeChatThread.id,
        title: activeChatThread.title,
        createdAt: activeChatThread.createdAt,
        updatedAt: activeChatThread.updatedAt,
        messageCount: activeChatThread.messages.length,
      },
      messages: activeChatThread.messages.map((message) => ({
        id: message.id,
        role: message.role,
        content: message.content,
        createdAt: message.createdAt,
        status: message.status ?? "done",
        citations: message.citations ?? [],
        answer: message.answer ?? null,
      })),
    };

    const safeTitle = normalizeThreadTitle(activeChatThread.title)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "chat-thread";

    downloadJson(`rl-discord-chat-${safeTitle}.json`, payload);
    toast.success("Chat exported as JSON.");
  };

  if (session.isPending) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-6xl items-center px-4 py-8 sm:px-6">
        <Card className="w-full border-border/70 bg-card/90 shadow-xl shadow-black/10">
          <CardHeader>
            <CardTitle>Checking session</CardTitle>
            <CardDescription>Loading the admin workspace.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            <Skeleton className="h-5 w-44" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
          </CardContent>
        </Card>
      </main>
    );
  }

  if (!currentUser) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-md items-center px-4 py-8">
        <Card className="w-full overflow-hidden border-border/80 bg-card/96 shadow-[0_32px_84px_rgba(0,0,0,0.52)]">
          <CardHeader className="space-y-5 border-b border-border/80 bg-gradient-to-b from-white/[0.06] via-card to-card pb-8 text-center">
            <div className="flex justify-center">
              <img src={logoSrc} alt="Root Labs" className="h-12 w-auto" />
            </div>
            <div className="flex justify-center">
              <Badge variant="secondary" className="rounded-full px-3 py-1">
                Discord Ops
              </Badge>
            </div>
            <div className="space-y-2">
              <CardTitle className="font-display text-4xl tracking-[-0.05em]">
                Sign in
              </CardTitle>
              <CardDescription className="text-sm">
                Access the Root Labs community intelligence workspace.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="p-6">
            <form className="grid gap-5" onSubmit={handleLogin}>
              <div className="grid gap-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={loginForm.email}
                  onChange={(event) =>
                    setLoginForm((current) => ({
                      ...current,
                      email: event.target.value,
                    }))
                  }
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={loginForm.password}
                  onChange={(event) =>
                    setLoginForm((current) => ({
                      ...current,
                      password: event.target.value,
                    }))
                  }
                />
              </div>
              {loginError ? (
                <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                  {loginError}
                </div>
              ) : null}
              <Button type="submit" size="lg" disabled={loggingIn}>
                {loggingIn ? (
                  <>
                    <LoaderCircle className="size-4 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  <>
                    <LogIn className="size-4" />
                    Sign in
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <>
      <SidebarProvider
        defaultOpen
        style={{ "--header-height": "4.5rem" } as CSSProperties}
      >
        <AppSidebar
          primaryAction={{
            label: syncInProgress ? "Syncing..." : "Run sync",
            icon: syncInProgress ? IconRefresh : IconBolt,
            onClick: () => void handleSync(),
          }}
          utilityAction={{
            label: "Open chat",
            icon: IconMessageCircle,
            onClick: () => {
              if (!isSentimentWorkspace) {
                setActiveTab("overview");
              }
              setChatSheetOpen(true);
            },
          }}
          mainItems={[
            {
              title: "Overview",
              icon: IconLayoutDashboard,
              badge: overview ? `${overview.metrics.healthScore.value}` : "Live",
              isActive: !isSentimentWorkspace && activeTab === "overview",
              onClick: () => openDashboardTab("overview"),
            },
            {
              title: "Sentiment",
              icon: IconChartBar,
              badge: sentimentChannels
                ? `${sentimentChannels.totals.negative.toLocaleString()} neg`
                : "AI",
              isActive: isSentimentWorkspace,
              url: "/dashboard/sentiment",
            },
            {
              title: "Explorer",
              icon: IconDatabase,
              isActive: !isSentimentWorkspace && activeTab === "explorer",
              onClick: () => openDashboardTab("explorer"),
            },
            {
              title: "Settings",
              icon: IconSettings,
              badge: syncSettings ? `${syncSettings.cadenceMinutes}m` : "Admin",
              isActive: !isSentimentWorkspace && activeTab === "settings",
              onClick: () => openDashboardTab("settings"),
            },
          ]}
          secondaryItems={[
            {
              title: "Sync activity",
              icon: IconArrowUpRight,
              url: "/admin/sync",
              external: true,
            },
            {
              title: "Data reset",
              icon: IconTrash,
              onClick: () => setClearDialogOpen(true),
            },
            {
              title: "Support",
              icon: IconHelp,
              url: "mailto:ops@rootlabs.co",
              external: true,
            },
          ]}
          resources={sidebarResources}
          user={{
            name: currentUser.name || "Root Labs Admin",
            email: currentUser.email,
          }}
          onSignOut={() => void signOut()}
          syncStatusLabel={syncStatusLabel}
          syncDetailLabel={syncDetailLabel}
          lastSyncedAtLabel={lastSyncedAtLabel}
        />

        <SidebarInset className="min-w-0 overflow-x-clip bg-background">
          <SiteHeader
            title={tabLabels[currentSection]}
            subtitle={headerSubtitle}
            statusLabel={headerStatusLabel}
            actions={
              <>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="rounded-xl bg-card/82"
                    onClick={() => setRefreshKey((current) => current + 1)}
                    disabled={
                      (currentSection === "overview" && loadingOverview) ||
                      (currentSection === "sentiment" && loadingSentiment) ||
                      (currentSection === "settings" && loadingAdminUsers)
                    }
                >
                  <IconRefresh
                    className={cn(
                      "size-4",
                      (
                        (currentSection === "overview" && loadingOverview) ||
                        (currentSection === "sentiment" && loadingSentiment) ||
                        (currentSection === "settings" && loadingAdminUsers)
                      ) &&
                        "animate-spin",
                    )}
                  />
                  Refresh
                </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="rounded-xl border border-white/12 bg-white/[0.07] text-white"
                    onClick={() => {
                      if (!isSentimentWorkspace) {
                        setActiveTab("overview");
                      }
                      setChatSheetOpen(true);
                  }}
                >
                  <MessageSquare className="size-4" />
                  Chat
                  <span className="hidden items-center gap-1 rounded-full border border-white/10 bg-background/80 px-2 py-0.5 text-[0.68rem] text-foreground/80 md:inline-flex">
                    <Command className="size-3" />
                    <span>K</span>
                  </span>
                </Button>
              </>
            }
          />

          <main className="flex min-w-0 flex-1 flex-col gap-6 overflow-x-clip p-4 lg:p-6">
            {activeTab === "overview" ? (
              <OverviewWorkspace
                overview={overview}
                loading={loadingOverview}
                error={overviewError}
                sentimentChannels={sentimentChannels}
                sentimentMessages={sentimentMessages}
                overviewRange={overviewRange}
                onOverviewRangeChange={setOverviewRange}
                onOpenSentiment={(input) =>
                  updateSentimentRouteSearch(
                    {
                      channel: input?.channelId ?? "all",
                      label: input?.label ?? "all",
                    },
                    { resetCursor: true },
                  )
                }
              />
            ) : null}

            {isSentimentWorkspace ? (
              <SentimentWorkspace
                search={sentimentSearch}
                channels={sentimentChannels}
                messages={sentimentMessages}
                loading={loadingSentiment}
                error={sentimentError}
                canGoBack={sentimentCursorHistory.length > 0}
                onApplySearch={(query) => updateSentimentRouteSearch({ q: query }, { resetCursor: true })}
                onUpdateSearch={(patch) => updateSentimentRouteSearch(patch, { resetCursor: true })}
                onNextPage={() => {
                  if (!sentimentMessages?.pageInfo.nextCursor) return;
                  setSentimentCursorHistory((current) => [
                    ...current,
                    sentimentSearch.cursor,
                  ]);
                  updateSentimentRouteSearch(
                    { cursor: sentimentMessages.pageInfo.nextCursor },
                    { resetCursor: false },
                  );
                }}
                onPreviousPage={() => {
                  const previousCursor =
                    sentimentCursorHistory[sentimentCursorHistory.length - 1] ?? "";
                  setSentimentCursorHistory((current) => current.slice(0, -1));
                  updateSentimentRouteSearch(
                    { cursor: previousCursor },
                    { resetCursor: false },
                  );
                }}
                onOpenInExplorer={(messageId) => {
                  if (!messageId) return;
                  openDashboardTab("explorer", {
                    resource: "discord-messages",
                    rowId: messageId,
                    q: sentimentSearch.q || undefined,
                    sentimentLabel:
                      sentimentSearch.label !== "all" ? sentimentSearch.label : undefined,
                  });
                }}
              />
            ) : null}

            {activeTab === "explorer" ? (
              <div className="grid gap-6">
                <div className="ui-panel-muted rounded-[28px] p-4">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <div className="ui-kicker">Explorer</div>
                      <p className="mt-2 text-sm leading-6 text-muted-foreground">
                        {explorerView === "people"
                          ? "Inspect member-level sentiment, TikTok link activity, and summary rollups. Refresh this panel independently when you want a live read."
                          : (
                            <>
                              Use <span className="font-medium text-foreground">/</span> to focus
                              search, then inspect row detail and joins before changing ingestion
                              or labeling behavior.
                            </>
                          )}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        type="button"
                        variant={explorerView === "datasets" ? "secondary" : "outline"}
                        className={cn(
                          "rounded-xl",
                          explorerView !== "datasets" && "bg-background/70",
                        )}
                        onClick={() =>
                          openDashboardTab("explorer", {
                            explorerView: "datasets",
                            resource: dashboardSearch.resource,
                            rowId: dashboardSearch.rowId,
                            q: dashboardSearch.q,
                            sentimentLabel: dashboardSearch.sentimentLabel,
                          })
                        }
                      >
                        Datasets
                      </Button>
                      <Button
                        type="button"
                        variant={explorerView === "people" ? "secondary" : "outline"}
                        className={cn(
                          "rounded-xl",
                          explorerView !== "people" && "bg-background/70",
                        )}
                        onClick={() =>
                          openDashboardTab("explorer", {
                            explorerView: "people",
                            userId: dashboardSearch.userId,
                            q: dashboardSearch.q,
                          })
                        }
                      >
                        People
                      </Button>
                      {explorerView === "datasets" ? (
                        <Badge variant="outline" className="rounded-full bg-background/70">
                          Shortcut /
                        </Badge>
                      ) : null}
                    </div>
                  </div>
                </div>
                {explorerView === "people" ? (
                  <UserSentimentExplorerPanel
                    initialQuery={dashboardSearch.q}
                    initialUserId={dashboardSearch.userId}
                    onApplyQuery={(query) =>
                      openDashboardTab("explorer", {
                        explorerView: "people",
                        userId: dashboardSearch.userId,
                        q: query || undefined,
                      })
                    }
                    onSelectUser={(userId) =>
                      openDashboardTab("explorer", {
                        explorerView: "people",
                        userId,
                        q: dashboardSearch.q,
                      })
                    }
                  />
                ) : (
                  <DataExplorerPanel initialState={explorerInitialState} />
                )}
              </div>
            ) : null}

            {activeTab === "settings" ? (
              <SettingsPanel
                syncSettings={syncSettings}
                savingSyncSettings={savingSyncSettings}
                users={adminUsers}
                usersTotal={adminUsersTotal}
                usersLoading={loadingAdminUsers}
                usersError={adminUsersError}
                usersSearch={adminUsersSearch}
                loadingLabel={settingsWorkerLabel}
                onUsersSearchChange={setAdminUsersSearch}
                onRefreshUsers={refreshAdminSettings}
                onSaveSyncSettings={handleSaveSyncSettings}
                onSaveRawDataAccess={handleSaveRawDataAccess}
                onCreateUser={handleCreateAdminUser}
                onUpdateUser={handleUpdateAdminUser}
                onDeleteUser={handleDeleteAdminUser}
              />
            ) : null}
          </main>
        </SidebarInset>
      </SidebarProvider>

      <OverviewChatSheet
        open={chatSheetOpen}
        onOpenChange={setChatSheetOpen}
        context={overviewChatContext}
        currentUser={{
          name: currentUser?.name || "You",
          avatarUrl: currentUser?.image ?? null,
        }}
        assistant={{
          name: "Ops Copilot",
          avatarUrl: null,
        }}
        draft={chatDraft}
        messages={chatMessages}
        sending={sendingChat}
        error={chatError}
        onDraftChange={setChatDraft}
        onSubmit={() => void submitChatQuestion(chatDraft)}
        onPromptSelect={handlePromptSelect}
        onReset={resetChat}
        onExportJson={exportActiveChatThread}
        threads={chatThreadSummaries}
        activeThreadId={activeChatThreadId}
        onThreadSelect={handleThreadSelect}
        onThreadDelete={handleThreadDelete}
        onThreadCreate={createAndActivateChatThread}
        historyActionsDisabled={sendingChat}
        composerFocusRequest={chatComposerFocusRequest}
      />

      <AlertDialog open={clearDialogOpen} onOpenChange={setClearDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear stored Discord data?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes stored Discord snapshots, sentiment records, and ingested
              messages from the local app database.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => void handleDropAll()} disabled={droppingAll}>
              {droppingAll ? "Clearing..." : "Confirm clear"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default AdminDashboard;
