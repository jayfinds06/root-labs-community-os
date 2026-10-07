import { desc, eq, sql } from "drizzle-orm";
import { auth } from "../auth";
import {
  getDiscordRuntime,
  getDiscordRuntimeStatus,
  updateDiscordSyncCadence,
} from "../discord";
import { getDiscordOpsConfig } from "../config";
import { db } from "../db/client";
import { account, registrations, session as authSession, user, verification } from "../db/schema";
import {
  endOfLocalDayFromInput,
  getOverviewData,
  getOverviewOpsData,
  getSentimentChannelsData,
  getSentimentMessageContextData,
  getSentimentMessagesData,
  startOfLocalDayFromInput,
  updateMessageReviewStatus,
} from "../services/dashboard";
import { answerAdminChat, answerAdminChatStream } from "../services/admin-chat";
import { getSentimentBacklogStats } from "../services/sentiment";
import {
  getAdminChatAllowRawDataAccess,
  discordSyncCadenceLimits,
  getDiscordSyncCadenceMinutes,
  saveAdminChatAllowRawDataAccess,
} from "../services/discord-settings";

export async function requireAdmin(req: Request): Promise<Response | null> {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session) {
    return Response.json({ error: "Not authenticated" }, { status: 401 });
  }
  if (session.user.role !== "admin") {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }
  return null;
}

const readAdminSession = async (req: Request) => {
  return auth.api.getSession({ headers: req.headers });
};

const normalizeSearchString = (value: string | null | undefined): string | undefined => {
  const trimmed = value?.trim();
  if (!trimmed || trimmed === "undefined" || trimmed === "null") {
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

const parseAdminChatRequest = async (req: Request) => {
  const body = await req.json().catch(() => null) as {
    question?: string;
    conversationId?: string;
    context?: {
      window?: "24h" | "7d" | "14d";
      channelId?: string;
    };
  } | null;

  const question = body?.question?.trim() ?? "";
  if (!question) {
    return null;
  }

  return {
    question,
    conversationId: body?.conversationId,
    context: {
      window:
        body?.context?.window === "24h" || body?.context?.window === "14d" || body?.context?.window === "7d"
          ? body.context.window
          : undefined,
      channelId: normalizeSearchString(body?.context?.channelId),
    },
  };
};

function normalizeRole(value: unknown): "admin" | "user" {
  return value === "admin" ? "admin" : "user";
}

function toCsvCell(value: string | number | null): string {
  if (value === null) return "";
  const raw = String(value);
  if (!/[",\n]/.test(raw)) return raw;
  return `"${raw.replaceAll("\"", "\"\"")}"`;
}

function calculateTrend(current: number, previous: number) {
  if (previous > 0) {
    const percentage = ((current - previous) / previous) * 100;
    return { delta: current - previous, pct: Math.round(percentage * 10) / 10 };
  }

  return {
    delta: current,
    pct: current > 0 ? 100 : 0,
  };
}

function logSentimentRoute(
  route: "channels" | "messages",
  phase: "request" | "response",
  details: Record<string, string | number | boolean | null | undefined>,
) {
  console.info(`[admin.sentiment.${route}] ${phase}`, details);
}

export const adminRoutes = {
  "/api/admin/registrations": {
    async GET(req: Request) {
      const denied = await requireAdmin(req);
      if (denied) return denied;

      const url = new URL(req.url);
      const limit = Math.min(Number(url.searchParams.get("limit")) || 50, 200);
      const offset = Number(url.searchParams.get("offset")) || 0;
      const search = url.searchParams.get("search") || "";

      let query = db.select().from(registrations);

      if (search) {
        query = query.where(
          sql`${registrations.fullName} LIKE ${"%" + search + "%"} OR ${registrations.email} LIKE ${"%" + search + "%"} OR ${registrations.handle} LIKE ${"%" + search + "%"} OR ${registrations.discordUsername} LIKE ${"%" + search + "%"} OR ${registrations.phone} LIKE ${"%" + search + "%"} OR ${registrations.heardAbout} LIKE ${"%" + search + "%"}`,
        ) as typeof query;
      }

      const items = query
        .orderBy(desc(registrations.createdAt))
        .limit(limit)
        .offset(offset)
        .all();

      let countQuery = db
        .select({ value: sql<number>`count(*)` })
        .from(registrations);

      if (search) {
        countQuery = countQuery.where(
          sql`${registrations.fullName} LIKE ${"%" + search + "%"} OR ${registrations.email} LIKE ${"%" + search + "%"} OR ${registrations.handle} LIKE ${"%" + search + "%"} OR ${registrations.discordUsername} LIKE ${"%" + search + "%"} OR ${registrations.phone} LIKE ${"%" + search + "%"} OR ${registrations.heardAbout} LIKE ${"%" + search + "%"}`,
        ) as typeof countQuery;
      }

      const countResult = countQuery.get();

      return Response.json({
        items,
        total: countResult?.value ?? 0,
        limit,
        offset,
      });
    },
  },

  "/api/admin/registrations.csv": {
    async GET(req: Request) {
      const denied = await requireAdmin(req);
      if (denied) return denied;

      const url = new URL(req.url);
      const search = url.searchParams.get("search") || "";
      let query = db.select().from(registrations);

      if (search) {
        query = query.where(
          sql`${registrations.fullName} LIKE ${"%" + search + "%"} OR ${registrations.email} LIKE ${"%" + search + "%"} OR ${registrations.phone} LIKE ${"%" + search + "%"} OR ${registrations.handle} LIKE ${"%" + search + "%"} OR ${registrations.discordUsername} LIKE ${"%" + search + "%"} OR ${registrations.heardAbout} LIKE ${"%" + search + "%"}`,
        ) as typeof query;
      }

      const items = query.orderBy(desc(registrations.createdAt)).all();
      const header = [
        "id",
        "full_name",
        "email",
        "phone",
        "handle",
        "discord_username",
        "heard_about",
        "excitement",
        "created_at_iso",
      ];
      const rows = items.map((item) =>
        [
          item.id,
          item.fullName,
          item.email,
          item.phone,
          item.handle,
          item.discordUsername,
          item.heardAbout,
          item.excitement,
          new Date(item.createdAt).toISOString(),
        ]
          .map(toCsvCell)
          .join(","),
      );
      const csv = [header.join(","), ...rows].join("\n");
      const filename = `registrations-${new Date().toISOString().slice(0, 10)}.csv`;

      return new Response(csv, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${filename}"`,
          "Cache-Control": "no-store",
        },
      });
    },
  },

  "/api/admin/stats": {
    async GET(req: Request) {
      const denied = await requireAdmin(req);
      if (denied) return denied;
      const now = Date.now();
      const day = 86_400_000;
      const nowStartOfDay = new Date(now - day);
      const yesterdayStart = new Date(now - 2 * day);
      const weekStart = new Date(now - 7 * day);
      const previousWeekStart = new Date(now - 14 * day);

      const stats = db
        .select({
          total: sql<number>`count(*)`,
          today: sql<number>`coalesce(sum(case when ${registrations.createdAt} >= ${nowStartOfDay} then 1 else 0 end), 0)`,
          yesterday: sql<number>`coalesce(sum(case when ${registrations.createdAt} >= ${yesterdayStart} AND ${registrations.createdAt} < ${nowStartOfDay} then 1 else 0 end), 0)`,
          thisWeek: sql<number>`coalesce(sum(case when ${registrations.createdAt} >= ${weekStart} then 1 else 0 end), 0)`,
          previousWeek: sql<number>`coalesce(sum(case when ${registrations.createdAt} >= ${previousWeekStart} AND ${registrations.createdAt} < ${weekStart} then 1 else 0 end), 0)`,
        })
        .from(registrations)
        .get();

      const totalValue = stats?.total ?? 0;
      const todayValue = stats?.today ?? 0;
      const yesterdayValue = stats?.yesterday ?? 0;
      const weekValue = stats?.thisWeek ?? 0;
      const previousWeekValue = stats?.previousWeek ?? 0;
      const previousTotalValue = Math.max(totalValue - todayValue, 0);

      return Response.json({
        total: totalValue,
        today: todayValue,
        thisWeek: weekValue,
        totalTrend: calculateTrend(totalValue, previousTotalValue),
        todayTrend: calculateTrend(todayValue, yesterdayValue),
        thisWeekTrend: calculateTrend(weekValue, previousWeekValue),
      });
    },
  },

  "/api/admin/overview": {
    async GET(req: Request) {
      const denied = await requireAdmin(req);
      if (denied) return denied;
      const url = new URL(req.url);
      const fromParam = url.searchParams.get("from");
      const toParam = url.searchParams.get("to");
      const from = fromParam ? startOfLocalDayFromInput(fromParam) : null;
      const to = toParam ? endOfLocalDayFromInput(toParam) : null;
      const [overview, ops, sync, backlog] = await Promise.all([
        getOverviewData({
          from: from ?? undefined,
          to: to ?? undefined,
        }),
        getOverviewOpsData(),
        getDiscordRuntimeStatus(),
        getSentimentBacklogStats(),
      ]);
      const config = getDiscordOpsConfig();
      return Response.json({
        ...overview,
        ops: {
          monitoredChannels: ops.monitoredChannels,
          guildCount: ops.guildCount,
          lastBackfillAt: ops.lastBackfillAt,
          allTime: ops.allTime,
          pollIntervalMinutes: Math.round(sync.pollIntervalMs / 60000),
          messageContentIntentEnabled: config.enableMessageContentIntent,
          anthropicConfigured: Boolean(config.anthropicApiKey),
          sync,
          sentimentBacklog: backlog,
        },
      });
    },
  },

  "/api/admin/sentiment/channels": {
    async GET(req: Request) {
      const denied = await requireAdmin(req);
      if (denied) return denied;
      const url = new URL(req.url);
      const window = url.searchParams.get("window");
      const rawChannelId = url.searchParams.get("channelId");
      const channelId = normalizeSearchString(rawChannelId);
      const normalized = window === "24h" || window === "14d" ? window : "7d";
      logSentimentRoute("channels", "request", {
        url: req.url,
        requestedWindow: window,
        normalizedWindow: normalized,
        rawChannelId: rawChannelId ?? null,
        channelId: channelId ?? null,
      });
      const response = await getSentimentChannelsData(normalized, { channelId });
      logSentimentRoute("channels", "response", {
        normalizedWindow: normalized,
        channelId: channelId ?? null,
        channelCount: response.channels.length,
        total: response.totals.total,
        pending: response.totals.pending,
        generatedAt: response.generatedAt,
      });
      return Response.json(response);
    },
  },

  "/api/admin/sentiment/messages": {
    async GET(req: Request) {
      const denied = await requireAdmin(req);
      if (denied) return denied;
      const url = new URL(req.url);
      const window = url.searchParams.get("window");
      const label = url.searchParams.get("label");
      const rawChannelId = url.searchParams.get("channelId");
      const channelId = normalizeSearchString(rawChannelId);
      const q = normalizeSearchString(url.searchParams.get("q"));
      const sort = url.searchParams.get("sort") === "risk" ? "risk" : "newest";
      const limit = Math.min(Math.max(Number(url.searchParams.get("limit")) || 50, 1), 100);
      const cursor = normalizeSearchString(url.searchParams.get("cursor"));
      const normalizedWindow = window === "24h" || window === "14d" ? window : "7d";
      const normalizedLabel =
        label === "positive" ||
        label === "neutral" ||
        label === "negative" ||
        label === "pending" ||
        label === "all"
          ? label
          : "all";
      logSentimentRoute("messages", "request", {
        url: req.url,
        requestedWindow: window,
        normalizedWindow,
        requestedLabel: label,
        normalizedLabel,
        rawChannelId: rawChannelId ?? null,
        channelId: channelId ?? null,
        q: q ?? null,
        sort,
        limit,
        cursor: cursor ?? null,
      });
      const summary = await getSentimentBacklogStats();
      const response = await getSentimentMessagesData({
        window: normalizedWindow,
        channelId,
        label: normalizedLabel,
        q,
        sort,
        limit,
        cursor,
        summary: {
          pendingCount: summary.pendingCount,
          oldestPendingCreatedAt: summary.oldestPendingCreatedAt,
          lastClassifiedAt: summary.lastClassifiedAt,
        },
      });
      logSentimentRoute("messages", "response", {
        normalizedWindow,
        normalizedLabel,
        channelId: channelId ?? null,
        itemCount: response.items.length,
        pendingCount: response.summary.pendingCount,
        hasNextPage: response.pageInfo.hasNextPage,
        generatedAt: response.generatedAt,
      });

      return Response.json(response);
    },
  },

  "/api/admin/sentiment/message-context": {
    async GET(req: Request) {
      const denied = await requireAdmin(req);
      if (denied) return denied;

      const url = new URL(req.url);
      const messageId = url.searchParams.get("messageId")?.trim() ?? "";
      if (!messageId) {
        return Response.json({ error: "messageId is required." }, { status: 400 });
      }

      return Response.json(await getSentimentMessageContextData(messageId));
    },
  },

  "/api/admin/sentiment/review-status": {
    async POST(req: Request) {
      const denied = await requireAdmin(req);
      if (denied) return denied;

      const body = await req.json().catch(() => null) as {
        messageId?: string;
        status?: unknown;
        note?: string;
      } | null;
      const messageId = body?.messageId?.trim() ?? "";
      const status = body?.status === "resolved" ? "resolved" : body?.status === "pending" ? "pending" : null;
      if (!messageId || !status) {
        return Response.json({ error: "messageId and valid status are required." }, { status: 400 });
      }

      return Response.json(await updateMessageReviewStatus({
        messageId,
        status,
        note: body?.note,
      }));
    },
  },

  "/api/admin/settings/sync": {
    async GET(req: Request) {
      const denied = await requireAdmin(req);
      if (denied) return denied;

      const [cadenceMinutes, allowRawDataAccess] = await Promise.all([
        getDiscordSyncCadenceMinutes(),
        getAdminChatAllowRawDataAccess(),
      ]);

      return Response.json({
        cadenceMinutes,
        allowRawDataAccess,
        limits: discordSyncCadenceLimits,
      });
    },

    async POST(req: Request) {
      const denied = await requireAdmin(req);
      if (denied) return denied;

      const body = await req.json().catch(() => null) as {
        cadenceMinutes?: unknown;
        allowRawDataAccess?: unknown;
      } | null;
      const cadenceMinutes = body && "cadenceMinutes" in body && body.cadenceMinutes !== undefined
        ? await updateDiscordSyncCadence(body.cadenceMinutes)
        : await getDiscordSyncCadenceMinutes();
      const allowRawDataAccess = body && "allowRawDataAccess" in body
        ? await saveAdminChatAllowRawDataAccess(body.allowRawDataAccess)
        : await getAdminChatAllowRawDataAccess();

      return Response.json({
        ok: true,
        cadenceMinutes,
        allowRawDataAccess,
        limits: discordSyncCadenceLimits,
      });
    },
  },

  "/api/admin/users": {
    async GET(req: Request) {
      const denied = await requireAdmin(req);
      if (denied) return denied;

      const url = new URL(req.url);
      const search = url.searchParams.get("search")?.trim() ?? "";
      const limit = Math.min(Math.max(Number(url.searchParams.get("limit")) || 50, 1), 100);
      const searchPattern = `%${search}%`;
      const searchCondition = search
        ? sql`${user.name} LIKE ${searchPattern} OR ${user.email} LIKE ${searchPattern} OR coalesce(${user.role}, 'user') LIKE ${searchPattern}`
        : undefined;

      const items = searchCondition
        ? db.select().from(user).where(searchCondition).orderBy(desc(user.createdAt)).limit(limit).all()
        : db.select().from(user).orderBy(desc(user.createdAt)).limit(limit).all();

      const total = searchCondition
        ? db.select({ value: sql<number>`count(*)` }).from(user).where(searchCondition).get()
        : db.select({ value: sql<number>`count(*)` }).from(user).get();

      return Response.json({
        items: items.map((item) => ({
          id: item.id,
          name: item.name,
          email: item.email,
          role: item.role ?? "user",
          banned: item.banned ?? false,
          banReason: item.banReason,
          createdAt: item.createdAt.getTime(),
          updatedAt: item.updatedAt.getTime(),
        })),
        total: total?.value ?? 0,
      });
    },

    async POST(req: Request) {
      const denied = await requireAdmin(req);
      if (denied) return denied;

      const body = await req.json().catch(() => null) as {
        name?: string;
        email?: string;
        password?: string;
        role?: unknown;
      } | null;

      const name = body?.name?.trim() ?? "";
      const email = body?.email?.trim().toLowerCase() ?? "";
      const password = body?.password?.trim() ?? "";
      const role = normalizeRole(body?.role);

      if (!name || !email || !password) {
        return Response.json({ error: "Name, email, and password are required." }, { status: 400 });
      }

      const existing = db.select({ id: user.id }).from(user).where(eq(user.email, email)).get();
      if (existing) {
        return Response.json({ error: "A user with that email already exists." }, { status: 409 });
      }

      await auth.api.signUpEmail({
        body: { name, email, password },
        headers: new Headers(),
      });

      db.update(user).set({
        role,
        updatedAt: new Date(),
      }).where(eq(user.email, email)).run();

      const created = db.select().from(user).where(eq(user.email, email)).get();
      if (!created) {
        return Response.json({ error: "User was created but could not be loaded." }, { status: 500 });
      }

      return Response.json({
        ok: true,
        item: {
          id: created.id,
          name: created.name,
          email: created.email,
          role: created.role ?? "user",
          banned: created.banned ?? false,
          banReason: created.banReason,
          createdAt: created.createdAt.getTime(),
          updatedAt: created.updatedAt.getTime(),
        },
      });
    },
  },

  "/api/admin/users/update": {
    async POST(req: Request) {
      const denied = await requireAdmin(req);
      if (denied) return denied;

      const body = await req.json().catch(() => null) as {
        userId?: string;
        name?: string;
        email?: string;
        role?: unknown;
      } | null;

      const userId = body?.userId?.trim() ?? "";
      const name = body?.name?.trim() ?? "";
      const email = body?.email?.trim().toLowerCase() ?? "";
      const role = normalizeRole(body?.role);

      if (!userId || !name || !email) {
        return Response.json({ error: "User id, name, and email are required." }, { status: 400 });
      }

      const existing = db.select().from(user).where(eq(user.id, userId)).get();
      if (!existing) {
        return Response.json({ error: "User not found." }, { status: 404 });
      }

      const duplicate = db
        .select({ id: user.id })
        .from(user)
        .where(sql`${user.email} = ${email} AND ${user.id} <> ${userId}`)
        .get();
      if (duplicate) {
        return Response.json({ error: "Another user already has that email." }, { status: 409 });
      }

      db.update(user).set({
        name,
        email,
        role,
        updatedAt: new Date(),
      }).where(eq(user.id, userId)).run();

      const updated = db.select().from(user).where(eq(user.id, userId)).get();

      return Response.json({
        ok: true,
        item: updated
          ? {
              id: updated.id,
              name: updated.name,
              email: updated.email,
              role: updated.role ?? "user",
              banned: updated.banned ?? false,
              banReason: updated.banReason,
              createdAt: updated.createdAt.getTime(),
              updatedAt: updated.updatedAt.getTime(),
            }
          : null,
      });
    },
  },

  "/api/admin/users/delete": {
    async POST(req: Request) {
      const denied = await requireAdmin(req);
      if (denied) return denied;

      const adminSession = await readAdminSession(req);
      const body = await req.json().catch(() => null) as { userId?: string } | null;
      const userId = body?.userId?.trim() ?? "";

      if (!userId) {
        return Response.json({ error: "User id is required." }, { status: 400 });
      }

      if (adminSession?.user.id === userId) {
        return Response.json({ error: "You cannot delete your own account." }, { status: 400 });
      }

      const existing = db.select().from(user).where(eq(user.id, userId)).get();
      if (!existing) {
        return Response.json({ error: "User not found." }, { status: 404 });
      }

      db.delete(authSession).where(eq(authSession.userId, userId)).run();
      db.delete(account).where(eq(account.userId, userId)).run();
      db.delete(verification).where(eq(verification.identifier, existing.email)).run();
      db.delete(user).where(eq(user.id, userId)).run();

      return Response.json({ ok: true });
    },
  },

  "/api/admin/discord/sync": {
    async POST(req: Request) {
      const denied = await requireAdmin(req);
      if (denied) return denied;
      const runtime = getDiscordRuntime();
      const body = await req.json().catch(() => null) as { reset?: boolean } | null;
      const result = await runtime.syncNow({ reset: body?.reset === true });
      if (!result.ok) {
        return Response.json(result, { status: 400 });
      }
      return Response.json(result, { status: 202 });
    },
  },

  "/api/admin/chat": {
    async POST(req: Request) {
      const denied = await requireAdmin(req);
      if (denied) return denied;

      const input = await parseAdminChatRequest(req);
      if (!input) {
        return Response.json({ error: "Question is required." }, { status: 400 });
      }

      const response = await answerAdminChat(input);

      return Response.json(response);
    },
  },
  "/api/admin/chat/stream": {
    async POST(req: Request) {
      const denied = await requireAdmin(req);
      if (denied) return denied;

      const input = await parseAdminChatRequest(req);
      if (!input) {
        return Response.json({ error: "Question is required." }, { status: 400 });
      }

      const { context, stream } = await answerAdminChatStream(input);
      const encoder = new TextEncoder();

      const streamResponse = new ReadableStream({
        async start(controller) {
          try {
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({
                  type: "meta",
                  citations: context.citations,
                  evidence: context.evidence,
                  guardrails: context.guardrails,
                })}\n\n`,
              ),
            );

            for await (const chunk of stream) {
              if (!chunk) continue;
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ type: "text", value: chunk })}\n\n`),
              );
            }

            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "done" })}\n\n`));
          } catch (error) {
            console.error("[admin.chat] stream failed", {
              error: error instanceof Error ? error.message : String(error),
            });
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ type: "error", message: "Unable to stream answer right now." })}\n\n`,
              ),
            );
          } finally {
            controller.close();
          }
        },
      });

      return new Response(streamResponse, {
        headers: {
          "Content-Type": "text/event-stream; charset=utf-8",
          "Cache-Control": "no-cache, no-transform",
          Connection: "keep-alive",
        },
      });
    },
  },

  "/api/admin/discord/reset": {
    async POST(req: Request) {
      const denied = await requireAdmin(req);
      if (denied) return denied;
      const runtime = getDiscordRuntime();
      const result = await runtime.resetData();
      if (!result.ok) {
        return Response.json(result, { status: 400 });
      }
      return Response.json(result);
    },
  },
};
