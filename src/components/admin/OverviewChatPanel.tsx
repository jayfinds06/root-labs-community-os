import type {
  ComponentProps,
  KeyboardEvent as ReactKeyboardEvent,
  ReactNode,
} from "react";
import { useEffect, useId, useRef, useState } from "react";
import {
  Bot,
  Check,
  ChevronDown,
  Copy,
  Download,
  LoaderCircle,
  MessageSquareMore,
  Plus,
  Search,
  SendHorizontal,
  Trash2,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import type { AdminChatCitation, AdminChatResponse } from "@/utils/api";

export type OverviewChatContext = {
  generatedAt: number;
  healthScore: number;
  monitoredChannels: number;
  guildCount: number;
  backlogCount: number;
  activeCreatorCount: number;
  inactiveCreatorCount: number;
  topContent: Array<{
    url: string;
    shareCount: number;
    source: "discord-link-shares";
  }>;
  syncExecutionMode: "direct" | "disabled";
  syncInProgress: boolean;
  attentionChannels: Array<{
    channelId: string;
    channelName: string;
    negativeRate: number;
    negativeDelta: number;
    pendingCount: number;
  }>;
};

export type OverviewChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: number;
  status?: "streaming" | "done" | "error";
  citations?: AdminChatCitation[];
  answer?: AdminChatResponse;
};

export type OverviewChatThreadSummary = {
  id: string;
  title: string;
  updatedAt: number;
  messageCount: number;
  preview: string;
};

type ChatIdentity = {
  name: string;
  avatarUrl?: string | null;
};

const fallbackChatIdentity = (assistant = false): ChatIdentity => ({
  name: assistant ? "Assistant" : "You",
  avatarUrl: null,
});

type SharedOverviewChatProps = {
  context: OverviewChatContext | null;
  draft: string;
  messages: OverviewChatMessage[];
  sending: boolean;
  error: string;
  className?: string;
  currentUser?: ChatIdentity | null;
  assistant?: ChatIdentity | null;
  onDraftChange: (value: string) => void;
  onSubmit: () => void;
  onPromptSelect: (value: string) => void;
  onReset?: () => void;
  onExportJson?: () => void;
  composerFocusRequest?: number;
};

type OverviewChatSheetProps = SharedOverviewChatProps & {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  threads: OverviewChatThreadSummary[];
  activeThreadId: string | null;
  onThreadSelect: (threadId: string) => void;
  onThreadDelete: (threadId: string) => void;
  onThreadCreate: () => void;
  historyActionsDisabled?: boolean;
};

const suggestedPrompts = [
  "Why does community health look different this week?",
  "Which channel needs the most attention right now?",
  "What is blocking sentiment freshness today?",
  "Give me the sharpest risk summary for the last 7 days.",
];

const formatTimestamp = (value: number): string =>
  new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

const getContextTimestampLabel = (
  context: OverviewChatContext | null,
): string | null => {
  return context?.generatedAt ? formatTimestamp(context.generatedAt) : null;
};

const formatMessageTime = (value: number): string =>
  new Date(value).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });

const isSameCalendarDay = (left: number, right: number): boolean => {
  const leftDate = new Date(left);
  const rightDate = new Date(right);

  return (
    leftDate.getFullYear() === rightDate.getFullYear() &&
    leftDate.getMonth() === rightDate.getMonth() &&
    leftDate.getDate() === rightDate.getDate()
  );
};

const formatDateDivider = (value: number): string => {
  const date = new Date(value);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  if (isSameCalendarDay(value, today.getTime())) return "Today";
  if (isSameCalendarDay(value, yesterday.getTime())) return "Yesterday";

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
};

const formatCitationMeta = (
  meta: Record<string, string | number | boolean | null> | undefined,
): string[] => {
  if (!meta) return [];
  return Object.entries(meta)
    .filter(([, value]) => value !== null && value !== "")
    .slice(0, 2)
    .map(([key, value]) => `${key}: ${String(value)}`);
};

const sourceLabelMap: Record<AdminChatCitation["source"], string> = {
  overview: "Overview",
  "sentiment/channels": "Sentiment channels",
  "sentiment/messages": "Sentiment messages",
  explorer: "Explorer",
  sql: "Raw SQL",
};

const ThinkingDots = () => (
  <div className="flex items-center gap-1.5">
    <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-muted-foreground/75 [animation-delay:0ms]" />
    <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-muted-foreground/75 [animation-delay:120ms]" />
    <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-muted-foreground/75 [animation-delay:240ms]" />
  </div>
);

const getInitials = (name: string): string => {
  const parts = name
    .split(/\s+/)
    .map((value) => value.trim())
    .filter(Boolean)
    .slice(0, 2);
  return parts.map((value) => value[0]?.toUpperCase() ?? "").join("") || "RL";
};

const ChatAvatar = ({
  identity,
  assistant = false,
  className,
}: {
  identity?: ChatIdentity | null;
  assistant?: boolean;
  className?: string;
}) => {
  const safeIdentity = identity ?? fallbackChatIdentity(assistant);

  return (
    <Avatar
      className={cn(
        "shrink-0 border border-white/10 shadow-[0_8px_20px_rgba(0,0,0,0.18)]",
        assistant ? "bg-white/[0.04]" : "bg-emerald-400/[0.08]",
        className,
      )}
    >
      <AvatarImage
        src={safeIdentity.avatarUrl ?? undefined}
        alt={safeIdentity.name}
      />
      <AvatarFallback
        className={cn(
          "text-[10px] font-medium",
          assistant
            ? "bg-white/[0.04] text-foreground/82"
            : "bg-emerald-400/18 text-emerald-50",
        )}
      >
        {assistant ? (
          <Bot className="size-3.5" />
        ) : (
          getInitials(safeIdentity.name)
        )}
      </AvatarFallback>
    </Avatar>
  );
};

const isThinking = (message: OverviewChatMessage) =>
  message.role === "assistant" &&
  message.status === "streaming" &&
  message.content === "Thinking...";

const markdownTokenPattern =
  /(\[[^\]]+\]\((https?:\/\/[^\s)]+)\)|`[^`\n]+`|\*\*[^*]+\*\*|\*[^*\n]+\*|https?:\/\/[^\s<]+)/;

const renderInlineMarkdown = (
  value: string,
  keyPrefix: string,
): ReactNode[] => {
  const nodes: ReactNode[] = [];
  let remaining = value;
  let index = 0;

  while (remaining.length) {
    const match = remaining.match(markdownTokenPattern);
    if (!match) {
      nodes.push(remaining);
      break;
    }

    const start = match.index ?? 0;
    if (start > 0) {
      nodes.push(remaining.slice(0, start));
    }

    const token = match[0];
    const key = `${keyPrefix}-${index}`;

    if (token.startsWith("[")) {
      const linkMatch = token.match(/^\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)$/);
      if (linkMatch) {
        nodes.push(
          <a
            key={key}
            href={linkMatch[2]}
            target="_blank"
            rel="noreferrer"
            className="font-medium underline decoration-foreground/25 underline-offset-4 transition-colors hover:decoration-foreground/60"
          >
            {linkMatch[1]}
          </a>,
        );
      } else {
        nodes.push(token);
      }
    } else if (token.startsWith("`")) {
      nodes.push(
        <code
          key={key}
          className="rounded-md bg-background/80 px-1.5 py-0.5 font-mono text-[0.85em]"
        >
          {token.slice(1, -1)}
        </code>,
      );
    } else if (token.startsWith("**")) {
      nodes.push(
        <strong key={key} className="font-semibold text-foreground">
          {renderInlineMarkdown(token.slice(2, -2), `${key}-strong`)}
        </strong>,
      );
    } else if (token.startsWith("*")) {
      nodes.push(
        <em key={key} className="italic">
          {renderInlineMarkdown(token.slice(1, -1), `${key}-em`)}
        </em>,
      );
    } else {
      nodes.push(
        <a
          key={key}
          href={token}
          target="_blank"
          rel="noreferrer"
          className="font-medium underline decoration-foreground/25 underline-offset-4 transition-colors hover:decoration-foreground/60"
        >
          {token}
        </a>,
      );
    }

    remaining = remaining.slice(start + token.length);
    index += 1;
  }

  return nodes;
};

const renderMarkdownParagraph = (value: string, keyPrefix: string) =>
  value.split("\n").map((line, lineIndex) => (
    <span key={`${keyPrefix}-line-${lineIndex}`}>
      {lineIndex > 0 ? <br /> : null}
      {renderInlineMarkdown(line, `${keyPrefix}-${lineIndex}`)}
    </span>
  ));

const CopyButton = ({
  value,
  label,
  className,
}: {
  value: string;
  label: string;
  className?: string;
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!value.trim()) return;

    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={() => void handleCopy()}
            className={cn(
              "inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[0.65rem] font-medium text-muted-foreground transition-colors hover:bg-background/70 hover:text-foreground",
              className,
            )}
          >
            {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
            <span>{copied ? "Copied" : label}</span>
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" sideOffset={8}>
          {copied ? "Copied" : "Copy response"}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

const ActionIconButton = ({
  label,
  children,
  ...props
}: ComponentProps<typeof Button> & {
  label: string;
  children: ReactNode;
}) => (
  <TooltipProvider>
    <Tooltip>
      <TooltipTrigger asChild>
        <Button {...props} aria-label={label}>
          {children}
          <span className="sr-only">{label}</span>
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom" sideOffset={8}>{label}</TooltipContent>
    </Tooltip>
  </TooltipProvider>
);

const AnimatedDisclosure = ({
  label,
  count,
  children,
}: {
  label: string;
  count: number;
  children: ReactNode;
}) => {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-lg border border-white/8 bg-white/[0.02] backdrop-blur-sm">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-3 px-2.5 py-1.5 text-left text-[11px] text-foreground/84"
        onClick={() => setOpen((current) => !current)}
      >
        <span className="font-medium">{label}</span>
        <span className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
          {count}
          <ChevronDown
            className={cn(
              "size-3 transition-transform duration-200 ease-out",
              open && "rotate-180",
            )}
          />
        </span>
      </button>
      <div
        className={cn(
          "grid overflow-hidden transition-[grid-template-rows,opacity] duration-200 ease-out",
          open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-70",
        )}
      >
        <div className="min-h-0 overflow-hidden border-t border-white/8">
          <div className="grid gap-1.5 px-2.5 py-2">{children}</div>
        </div>
      </div>
    </div>
  );
};

const scrollToLatest = (
  element: HTMLDivElement,
  options?: { durationMs?: number },
) => {
  const startTop = element.scrollTop;
  const targetTop = Math.max(element.scrollHeight - element.clientHeight, 0);
  const distance = targetTop - startTop;

  if (Math.abs(distance) < 4) {
    element.scrollTop = targetTop;
    return;
  }

  const durationMs = options?.durationMs ?? 420;
  const startedAt = performance.now();

  const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

  const tick = (now: number) => {
    const elapsed = now - startedAt;
    const progress = Math.min(elapsed / durationMs, 1);
    element.scrollTop = startTop + distance * easeOutCubic(progress);

    if (progress < 1) {
      window.requestAnimationFrame(tick);
    }
  };

  window.requestAnimationFrame(tick);
};

const CodeBlock = ({
  language,
  content,
}: {
  language?: string;
  content: string;
}) => (
  <div className="overflow-hidden rounded-xl border border-border/70 bg-background/75">
    <div className="flex items-center justify-between gap-2 border-b border-border/60 px-3 py-2">
      <span className="text-[0.65rem] font-medium uppercase tracking-[0.18em] text-muted-foreground">
        {language || "Code"}
      </span>
      <CopyButton value={content} label="Copy code" />
    </div>
    <pre className="overflow-x-auto px-3 py-3 text-[0.8rem] leading-6 text-foreground/90">
      <code>{content}</code>
    </pre>
  </div>
);

const renderMarkdownBlock = (value: string, keyPrefix: string): ReactNode[] => {
  const nodes: ReactNode[] = [];
  const fencedCodePattern = /```([a-zA-Z0-9_-]+)?\n?([\s\S]*?)```/g;
  let lastIndex = 0;
  let blockIndex = 0;

  const pushTextBlocks = (text: string) => {
    const sections = text
      .split(/\n{2,}/)
      .map((section) => section.trim())
      .filter(Boolean);

    sections.forEach((section, sectionIndex) => {
      const lines = section.split("\n");
      const listItems = lines.every((line) => /^[-*]\s+/.test(line));
      const orderedItems = lines.every((line) => /^\d+\.\s+/.test(line));
      const quoteLines = lines.every((line) => /^>\s?/.test(line));
      const headingMatch = section.match(/^(#{1,3})\s+(.+)$/);
      const key = `${keyPrefix}-${blockIndex}-${sectionIndex}`;

      if (headingMatch) {
        const level = headingMatch[1].length;
        nodes.push(
          <div
            key={key}
            className={cn(
              "font-semibold tracking-tight text-foreground",
              level === 1
                ? "text-base"
                : level === 2
                  ? "text-[0.95rem]"
                  : "text-sm",
            )}
          >
            {renderInlineMarkdown(headingMatch[2], `${key}-heading`)}
          </div>,
        );
        return;
      }

      if (quoteLines) {
        nodes.push(
          <blockquote
            key={key}
            className="border-l-2 border-foreground/10 pl-3 text-foreground/80"
          >
            {renderMarkdownParagraph(
              lines.map((line) => line.replace(/^>\s?/, "")).join("\n"),
              `${key}-quote`,
            )}
          </blockquote>,
        );
        return;
      }

      if (listItems) {
        nodes.push(
          <ul
            key={key}
            className="grid gap-1.5 pl-4 text-[13px] leading-6 text-inherit marker:text-muted-foreground"
          >
            {lines.map((line, lineIndex) => (
              <li key={`${key}-item-${lineIndex}`} className="list-disc">
                {renderInlineMarkdown(
                  line.replace(/^[-*]\s+/, ""),
                  `${key}-${lineIndex}`,
                )}
              </li>
            ))}
          </ul>,
        );
        return;
      }

      if (orderedItems) {
        nodes.push(
          <ol
            key={key}
            className="grid gap-1.5 pl-4 text-[13px] leading-6 text-inherit marker:text-muted-foreground"
          >
            {lines.map((line, lineIndex) => (
              <li key={`${key}-item-${lineIndex}`} className="list-decimal">
                {renderInlineMarkdown(
                  line.replace(/^\d+\.\s+/, ""),
                  `${key}-${lineIndex}`,
                )}
              </li>
            ))}
          </ol>,
        );
        return;
      }

      nodes.push(
        <p key={key} className="text-[13px] leading-6 text-inherit">
          {renderMarkdownParagraph(section, `${key}-paragraph`)}
        </p>,
      );
    });

    blockIndex += 1;
  };

  for (const match of value.matchAll(fencedCodePattern)) {
    const start = match.index ?? 0;
    if (start > lastIndex) {
      pushTextBlocks(value.slice(lastIndex, start));
    }
    nodes.push(
      <CodeBlock
        key={`${keyPrefix}-code-${blockIndex}`}
        language={match[1]}
        content={match[2].replace(/\n$/, "")}
      />,
    );
    blockIndex += 1;
    lastIndex = start + match[0].length;
  }

  if (lastIndex < value.length) {
    pushTextBlocks(value.slice(lastIndex));
  }

  return nodes.length
    ? nodes
    : [
        <p
          key={`${keyPrefix}-empty`}
          className="text-sm leading-relaxed text-inherit"
        >
          {renderMarkdownParagraph(value, `${keyPrefix}-fallback`)}
        </p>,
      ];
};

const MarkdownMessage = ({ content }: { content: string }) => (
  <div className="space-y-3 text-[13px] text-inherit">
    {renderMarkdownBlock(content, "message")}
  </div>
);

const MessageBubble = ({
  message,
  currentUser,
  assistant,
}: {
  message: OverviewChatMessage;
  currentUser: ChatIdentity;
  assistant: ChatIdentity;
}) => {
  const isAssistant = message.role === "assistant";
  const identity =
    (isAssistant ? assistant : currentUser) ??
    fallbackChatIdentity(isAssistant);
  const bubbleTone = isAssistant
    ? message.status === "error"
      ? {
          shell:
            "border-white/8 bg-[linear-gradient(180deg,rgba(15,10,11,0.96),rgba(8,7,8,0.985))] shadow-[0_16px_32px_rgba(0,0,0,0.28),inset_0_1px_0_rgba(255,255,255,0.05)]",
          glow: "from-rose-200/8 via-transparent to-transparent",
          prism:
            "bg-[radial-gradient(circle_at_78%_18%,rgba(255,170,182,0.05),transparent_32%)]",
          timestamp: "border-white/8 bg-white/[0.025]",
          divider: "border-white/8",
        }
      : {
          shell:
            "border-white/8 bg-[linear-gradient(180deg,rgba(10,12,13,0.95),rgba(5,7,8,0.985))] shadow-[0_16px_32px_rgba(0,0,0,0.28),inset_0_1px_0_rgba(255,255,255,0.05)]",
          glow: "from-emerald-200/8 via-transparent to-transparent",
          prism:
            "bg-[radial-gradient(circle_at_82%_18%,rgba(118,255,208,0.05),transparent_32%)]",
          timestamp: "border-white/8 bg-white/[0.025]",
          divider: "border-white/8",
        }
    : {
        shell:
          "border-emerald-300/10 bg-[linear-gradient(180deg,rgba(9,13,12,0.96),rgba(5,8,7,0.985))] shadow-[0_16px_32px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.05)]",
        glow: "from-emerald-200/10 via-transparent to-transparent",
        prism:
          "bg-[radial-gradient(circle_at_18%_18%,rgba(140,255,202,0.06),transparent_30%)]",
        timestamp: "border-white/8 bg-white/[0.025]",
        divider: "border-white/8",
      };

  return (
    <div
      className={cn(
        "flex w-full items-start gap-2.5",
        isAssistant ? "justify-start" : "justify-end",
      )}
    >
      {isAssistant ? (
        <ChatAvatar identity={identity} assistant className="mt-1 size-7" />
      ) : null}

      <div
        className={cn(
          "relative min-w-0 max-w-[34rem] overflow-hidden rounded-[22px] border px-4 py-3 backdrop-blur-[22px]",
          bubbleTone.shell,
        )}
      >
        <div
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute inset-x-4 top-0 h-10 rounded-b-[28px] bg-gradient-to-b opacity-80 blur-lg",
            bubbleTone.glow,
          )}
        />
        <div
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute inset-0 opacity-100",
            bubbleTone.prism,
          )}
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-[1px] rounded-[20px] border border-white/6"
        />

        <div className="relative z-10 mb-2 flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            {!isAssistant ? (
              <ChatAvatar identity={identity} className="size-6" />
            ) : null}
            <span className="truncate text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
              {isAssistant ? identity.name : "You"}
            </span>
          </div>
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-[11px] text-muted-foreground backdrop-blur-md",
              bubbleTone.timestamp,
            )}
          >
            {formatMessageTime(message.createdAt)}
          </span>
        </div>

        <div
          className={cn(
            "relative z-10 whitespace-pre-wrap text-[13px] leading-6 text-foreground/94",
            message.status === "error" && "text-destructive",
          )}
        >
          {isThinking(message) ? (
            <span className="inline-flex items-center gap-2 text-muted-foreground">
              <span>Thinking</span>
              <span className="sr-only">AI is generating a response</span>
              <ThinkingDots />
            </span>
          ) : isAssistant ? (
            <>
              <MarkdownMessage content={message.content} />
              {message.status === "streaming" ? (
                <span className="ml-1 inline-block h-3.5 w-0.5 animate-pulse bg-current align-middle" />
              ) : null}
            </>
          ) : (
            message.content
          )}
        </div>

        {!isThinking(message) ? (
          <div className="relative z-10 mt-3 flex items-center justify-end">
            {isAssistant && message.content.trim() ? (
              <CopyButton
                value={message.content}
                label="Copy"
                className="px-0 hover:bg-transparent"
              />
            ) : null}
          </div>
        ) : null}

        {isAssistant &&
        message.status === "done" &&
        (message.citations?.length ||
          message.answer?.evidence.messages?.length) ? (
          <div
            className={cn(
              "relative z-10 mt-2.5 space-y-2 border-t pt-2.5",
              bubbleTone.divider,
            )}
          >
            {message.citations?.length ? (
              <AnimatedDisclosure label="Sources" count={message.citations.length}>
                  {message.citations.map((citation, index) => (
                    <div
                      key={`${message.id}-${citation.label}-${index}`}
                      className="grid gap-0.5 rounded-md border border-white/8 bg-white/[0.015] px-2 py-1.5"
                    >
                      <div className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                        {sourceLabelMap[citation.source]}
                      </div>
                      <div className="text-[11px] text-foreground/84">
                        {citation.label}
                      </div>
                      {formatCitationMeta(citation.meta).length > 0 ? (
                        <div className="break-words text-[10px] leading-4 text-muted-foreground">
                          {formatCitationMeta(citation.meta).join(" · ")}
                        </div>
                      ) : null}
                    </div>
                  ))}
              </AnimatedDisclosure>
            ) : null}

            {message.answer?.evidence.messages?.length ? (
              <AnimatedDisclosure
                label="Message samples"
                count={Math.min(message.answer.evidence.messages.length, 3)}
              >
                  {message.answer.evidence.messages.slice(0, 3).map((item) => (
                    <div
                      key={item.id}
                      className="rounded-md border border-white/8 bg-white/[0.015] px-2 py-1.5"
                    >
                      <div className="flex flex-wrap items-center gap-1.5 text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                        <span>{item.channelName}</span>
                        <span>•</span>
                        <span>{item.author}</span>
                        {item.label ? (
                          <>
                            <span>•</span>
                            <span>{item.label}</span>
                          </>
                        ) : null}
                      </div>
                      <p className="mt-1 line-clamp-2 text-[11px] leading-5 text-foreground/76">
                        {item.content}
                      </p>
                    </div>
                  ))}
              </AnimatedDisclosure>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
};

const PromptChip = ({
  prompt,
  onSelect,
  disabled,
}: {
  prompt: string;
  onSelect: (value: string) => void;
  disabled: boolean;
}) => (
  <button
    type="button"
    className="rounded-full border border-border/60 bg-background px-3 py-1.5 text-left text-xs leading-snug text-foreground/80 transition-colors hover:bg-muted disabled:pointer-events-none disabled:opacity-50"
    onClick={() => onSelect(prompt)}
    disabled={disabled}
  >
    {prompt}
  </button>
);

const useChatFocusShortcut = (
  composerRef: React.RefObject<HTMLTextAreaElement | null>,
  focusMode: "desktop" | "sheet",
  enabled = true,
) => {
  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "/") return;
      const target = event.target;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        (target instanceof HTMLElement && target.isContentEditable)
      ) {
        return;
      }
      const isDesktop = window.matchMedia("(min-width: 1280px)").matches;
      if (
        (focusMode === "desktop" && !isDesktop) ||
        (focusMode === "sheet" && isDesktop)
      ) {
        return;
      }
      event.preventDefault();
      composerRef.current?.focus();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [composerRef, enabled, focusMode]);
};

const EmptyState = () => (
  <div className="flex h-full flex-col items-center justify-center gap-3 px-4 text-center">
    <div className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
      <MessageSquareMore className="size-5" />
    </div>
    <div className="space-y-1">
      <p className="text-sm font-medium">No messages yet</p>
      <p className="max-w-xs text-xs leading-relaxed text-muted-foreground">
        Ask a question about the dashboard.
      </p>
    </div>
  </div>
);

const Composer = ({
  id,
  composerRef,
  draft,
  sending,
  error,
  compact,
  showPrompts,
  onDraftChange,
  onSubmit,
  onPromptSelect,
}: {
  id: string;
  composerRef: React.RefObject<HTMLTextAreaElement | null>;
  draft: string;
  sending: boolean;
  error: string;
  compact?: boolean;
  showPrompts: boolean;
  onDraftChange: (value: string) => void;
  onSubmit: () => void;
  onPromptSelect: (value: string) => void;
}) => {
  const handleKeyDown = (event: ReactKeyboardEvent<HTMLTextAreaElement>) => {
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      event.preventDefault();
      onSubmit();
    }
  };

  return (
    <div className="shrink-0 border-t border-white/8 bg-[linear-gradient(180deg,rgba(5,8,8,0.94),rgba(2,4,4,0.98))] px-4 py-3">
      {showPrompts && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {suggestedPrompts.slice(0, compact ? 2 : 4).map((prompt) => (
            <PromptChip
              key={prompt}
              prompt={prompt}
              onSelect={onPromptSelect}
              disabled={sending}
            />
          ))}
        </div>
      )}

      <div className="rounded-[22px] border border-white/8 bg-[linear-gradient(180deg,rgba(7,11,11,0.98),rgba(3,6,6,0.995))] p-2 shadow-[0_-8px_24px_rgba(0,0,0,0.18),inset_0_1px_0_rgba(255,255,255,0.03)]">
        <div className="flex items-end gap-2">
          <textarea
            id={id}
            ref={composerRef}
            value={draft}
            onChange={(event) => onDraftChange(event.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
            placeholder="Ask about anything..."
            className="max-h-28 min-h-12 w-full resize-none overflow-y-auto rounded-[15px] border border-white/8 bg-black/30 px-3 py-2 text-[14px] leading-5.5 text-foreground outline-none transition-colors placeholder:text-muted-foreground/90 focus-visible:border-emerald-400/18 focus-visible:bg-black/40 focus-visible:ring-[3px] focus-visible:ring-emerald-400/8 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={sending}
          />
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  size="icon"
                  className="size-9 shrink-0 rounded-[15px] border border-emerald-400/18 bg-[linear-gradient(180deg,rgba(18,45,33,0.94),rgba(10,22,17,0.98))] text-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] hover:bg-[linear-gradient(180deg,rgba(23,52,38,0.98),rgba(12,27,20,0.98))]"
                  onClick={onSubmit}
                  disabled={!draft.trim() || sending}
                  aria-label="Send message"
                >
                  {sending ? (
                    <LoaderCircle className="size-4 animate-spin" />
                  ) : (
                    <SendHorizontal className="size-4" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top" sideOffset={8}>
                Send (Cmd/Ctrl + Enter)
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>

      {error ? (
        <div className="mt-1 px-0.5">
          <p className="text-xs text-destructive">{error}</p>
        </div>
      ) : null}
    </div>
  );
};

const ChatBody = ({
  currentUser,
  assistant,
  context,
  draft,
  messages,
  sending,
  error,
  onDraftChange,
  onSubmit,
  onPromptSelect,
  onReset,
  onExportJson,
  compact = false,
  focusMode,
  focusEnabled = true,
  showHeader = true,
  composerFocusRequest,
}: SharedOverviewChatProps & {
  compact?: boolean;
  focusMode: "desktop" | "sheet";
  focusEnabled?: boolean;
  showHeader?: boolean;
}) => {
  const safeCurrentUser = currentUser ?? fallbackChatIdentity(false);
  const safeAssistant = assistant ?? fallbackChatIdentity(true);
  const composerId = useId();
  const composerRef = useRef<HTMLTextAreaElement | null>(null);
  const transcriptRef = useRef<HTMLDivElement | null>(null);
  const [isPinnedToBottom, setIsPinnedToBottom] = useState(true);

  useChatFocusShortcut(composerRef, focusMode, focusEnabled);

  useEffect(() => {
    if (!composerFocusRequest || !focusEnabled) {
      return;
    }
    const focusTimer = window.setTimeout(() => {
      composerRef.current?.focus();
    }, 0);
    return () => window.clearTimeout(focusTimer);
  }, [composerFocusRequest, focusEnabled]);

  useEffect(() => {
    const transcript = transcriptRef.current;
    if (!transcript) return;

    const updatePinnedState = () => {
      const distanceFromBottom =
        transcript.scrollHeight -
        transcript.scrollTop -
        transcript.clientHeight;
      setIsPinnedToBottom(distanceFromBottom < 72);
    };

    updatePinnedState();
    transcript.addEventListener("scroll", updatePinnedState);
    return () => transcript.removeEventListener("scroll", updatePinnedState);
  }, []);

  useEffect(() => {
    const transcript = transcriptRef.current;
    if (!transcript || !isPinnedToBottom) return;
    transcript.scrollTop = transcript.scrollHeight;
  }, [isPinnedToBottom, messages]);

  const contextTimestampLabel = getContextTimestampLabel(context);

  return (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
      {showHeader && (
        <CardHeader className="border-b border-border/60 px-4 pb-3 pt-4">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <CardTitle
                className={cn(
                  "tracking-tight",
                  compact ? "text-lg" : "text-xl",
                )}
              >
                Chat
              </CardTitle>
              <CardDescription className="text-[13px] leading-5">
                Ask about the dashboard and sentiment activity.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              {onExportJson ? (
                <ActionIconButton
                  type="button"
                  size="icon"
                  variant="outline"
                  className="size-8 rounded-lg"
                  onClick={onExportJson}
                  label="Export chat as JSON"
                >
                  <Download className="size-3.5" />
                </ActionIconButton>
              ) : null}
              {contextTimestampLabel ? (
                <Badge variant="outline" className="shrink-0 text-[0.65rem]">
                  {contextTimestampLabel}
                </Badge>
              ) : null}
            </div>
          </div>
        </CardHeader>
      )}

      <CardContent className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-hidden px-3 pb-3 pt-2 sm:px-4 sm:pb-4 sm:pt-3">
        {/* Keep scrolling isolated to the transcript so the header and composer stay anchored. */}
        <div className="min-h-0 flex-1">
          <div className="relative h-full min-h-0">
            <div
              ref={transcriptRef}
              className={cn(
                "h-full min-h-0 overflow-y-auto pl-1 pr-4 [scrollbar-gutter:stable]",
                compact ? "" : "min-h-[320px]",
              )}
            >
              {messages.length ? (
                <div className="grid gap-3 pb-4 pr-1">
                  {messages.map((message, index) => {
                    const previousMessage = messages[index - 1];
                    const showDateDivider =
                      !previousMessage ||
                      !isSameCalendarDay(
                        previousMessage.createdAt,
                        message.createdAt,
                      );

                    return (
                      <div key={message.id} className="space-y-3">
                        {showDateDivider ? (
                          <div className="sticky top-0 z-10 flex justify-center py-1">
                            <span className="rounded-full border border-white/8 bg-[rgba(7,10,10,0.9)] px-3 py-1 text-[11px] font-medium text-muted-foreground backdrop-blur-md">
                              {formatDateDivider(message.createdAt)}
                            </span>
                          </div>
                        ) : null}
                        <MessageBubble
                          message={message}
                          currentUser={safeCurrentUser}
                          assistant={safeAssistant}
                        />
                      </div>
                    );
                  })}
                </div>
              ) : (
                <EmptyState />
              )}
            </div>

            {!isPinnedToBottom && messages.length > 0 ? (
              <div className="pointer-events-none absolute inset-x-0 bottom-3 z-20 flex justify-center pr-4">
                <Button
                  type="button"
                  size="sm"
                  className="pointer-events-auto h-8 rounded-full border border-emerald-400/14 bg-emerald-400/[0.1] px-3 text-[11px] font-medium text-foreground shadow-[0_10px_24px_rgba(0,0,0,0.22)] hover:bg-emerald-400/[0.14]"
                  onClick={() => {
                    const transcript = transcriptRef.current;
                    if (!transcript) return;
                    scrollToLatest(transcript, { durationMs: 520 });
                    setIsPinnedToBottom(true);
                  }}
                >
                  Latest
                </Button>
              </div>
            ) : null}
          </div>
        </div>
        {/* Composer stays docked to the bottom and owns secondary actions like jump-to-latest. */}
        <Composer
          id={composerId}
          composerRef={composerRef}
          draft={draft}
          sending={sending}
          error={error}
          compact={compact}
          showPrompts={messages.length === 0}
          onDraftChange={onDraftChange}
          onSubmit={onSubmit}
          onPromptSelect={onPromptSelect}
        />
      </CardContent>
    </div>
  );
};

export const OverviewChatPanel = ({
  className,
  ...props
}: SharedOverviewChatProps) => (
  <Card className={cn("border-border/70 bg-card shadow-sm", className)}>
    <ChatBody {...props} focusMode="desktop" />
  </Card>
);

export const OverviewChatSheet = ({
  open,
  onOpenChange,
  context,
  draft,
  messages,
  sending,
  error,
  onDraftChange,
  onSubmit,
  onPromptSelect,
  onReset,
  onExportJson,
  threads,
  activeThreadId,
  onThreadSelect,
  onThreadDelete,
  onThreadCreate,
  historyActionsDisabled = false,
  composerFocusRequest,
}: OverviewChatSheetProps) => {
  const isMobile = useIsMobile();
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyQuery, setHistoryQuery] = useState("");
  const normalizedQuery = historyQuery.trim().toLowerCase();

  const visibleThreads = normalizedQuery
    ? threads.filter((thread) => {
        const haystack = `${thread.title} ${thread.preview}`.toLowerCase();
        return haystack.includes(normalizedQuery);
      })
    : threads;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={isMobile ? "bottom" : "right"}
        showCloseButton={false}
        overlayClassName="bg-black/62 backdrop-blur-[6px]"
        className={cn(
          "overflow-hidden border-white/10 bg-[linear-gradient(180deg,rgba(7,10,10,0.985),rgba(3,5,5,0.995))] p-0 shadow-[0_32px_96px_rgba(0,0,0,0.58)] backdrop-blur-xl",
          isMobile
            ? "h-[92vh] w-full max-w-none rounded-t-3xl sm:h-[88vh]"
            : "top-4 bottom-4 right-4 h-auto w-[min(42rem,calc(100vw-2rem))] max-w-none rounded-[28px] border",
        )}
      >
        <SheetHeader className="relative z-10 shrink-0 border-b border-white/10 px-4 pb-3 pt-4">
          <div className="flex items-center justify-between gap-2">
            <div className="space-y-1">
              <SheetTitle className="text-[1.05rem] tracking-tight">
                Chat
              </SheetTitle>
              <p className="text-[12px] leading-5 text-muted-foreground">
                Ask about the dashboard and sentiment activity.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <ActionIconButton
                type="button"
                size="icon"
                variant="ghost"
                className="size-9 rounded-xl border border-white/8 bg-white/[0.03] text-muted-foreground hover:bg-white/[0.05] hover:text-foreground"
                onClick={() => setHistoryOpen((v) => !v)}
                label={historyOpen ? "Hide thread history" : "Show thread history"}
              >
                <Search className="size-3.5" />
              </ActionIconButton>
              <ActionIconButton
                type="button"
                size="icon"
                variant="ghost"
                className="size-9 rounded-xl border border-white/8 bg-white/[0.03] text-muted-foreground hover:bg-white/[0.05] hover:text-foreground"
                onClick={onThreadCreate}
                disabled={historyActionsDisabled}
                label="New thread"
              >
                <Plus className="size-3.5" />
              </ActionIconButton>
              {onExportJson ? (
                <ActionIconButton
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="size-9 rounded-xl border border-white/8 bg-white/[0.03] text-muted-foreground hover:bg-white/[0.05] hover:text-foreground"
                  onClick={onExportJson}
                  disabled={historyActionsDisabled}
                  label="Export chat as JSON"
                >
                  <Download className="size-3.5" />
                </ActionIconButton>
              ) : null}
              <ActionIconButton
                type="button"
                size="icon"
                variant="ghost"
                className="size-9 rounded-xl border border-white/8 bg-white/[0.03] text-muted-foreground hover:bg-white/[0.05] hover:text-foreground"
                onClick={() => onOpenChange(false)}
                label="Close chat"
              >
                <X className="size-3.5" />
              </ActionIconButton>
            </div>
          </div>

          {historyOpen && (
            <div className="space-y-2 pt-3">
              <input
                type="search"
                value={historyQuery}
                onChange={(event) => setHistoryQuery(event.target.value)}
                placeholder="Search threads..."
                className="h-10 w-full rounded-xl border border-white/8 bg-black/28 px-3 text-xs outline-none placeholder:text-muted-foreground focus-visible:border-emerald-400/18 focus-visible:ring-[3px] focus-visible:ring-emerald-400/8"
              />
              <div className="max-h-32 space-y-1 overflow-y-auto">
                {visibleThreads.length ? (
                  visibleThreads.map((thread) => (
                    <div key={thread.id} className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => onThreadSelect(thread.id)}
                        className={cn(
                          "min-w-0 flex-1 rounded-xl border px-3 py-2 text-left transition-colors",
                          thread.id === activeThreadId
                            ? "border-emerald-400/18 bg-emerald-400/[0.08] text-foreground"
                            : "border-white/8 bg-white/[0.02] text-foreground/80 hover:bg-white/[0.04] hover:text-foreground",
                        )}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate text-xs font-medium">
                            {thread.title}
                          </span>
                          <span className="shrink-0 text-[0.6rem] text-muted-foreground">
                            {formatTimestamp(thread.updatedAt)}
                          </span>
                        </div>
                      </button>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="size-8 shrink-0 rounded-xl border border-white/8 bg-white/[0.02] text-muted-foreground hover:bg-white/[0.04] hover:text-destructive"
                        onClick={() => onThreadDelete(thread.id)}
                        disabled={historyActionsDisabled}
                      >
                        <Trash2 className="size-3" />
                        <span className="sr-only">Delete</span>
                      </Button>
                    </div>
                  ))
                ) : (
                  <p className="px-2 py-1.5 text-xs text-muted-foreground">
                    No threads found.
                  </p>
                )}
              </div>
            </div>
          )}
        </SheetHeader>

        <div className="relative z-10 flex min-h-0 flex-1 flex-col overflow-hidden">
          <ChatBody
            context={context}
            draft={draft}
            messages={messages}
            sending={sending}
            error={error}
            onDraftChange={onDraftChange}
            onSubmit={onSubmit}
            onPromptSelect={onPromptSelect}
            onReset={onReset}
            onExportJson={onExportJson}
            compact
            focusMode="sheet"
            focusEnabled={open}
            composerFocusRequest={composerFocusRequest}
            showHeader={false}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
};
