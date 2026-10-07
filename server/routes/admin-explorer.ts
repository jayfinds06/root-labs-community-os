import { getExplorerDetail, getExplorerList, getExplorerResources } from "../services/data-explorer";
import { getUserInsightDetail, getUserInsights } from "../services/user-insights";
import { requireAdmin } from "./admin";

export const adminExplorerRoutes = {
  "/api/admin/explorer/resources": {
    async GET(req: Request) {
      const denied = await requireAdmin(req);
      if (denied) return denied;
      return Response.json(await getExplorerResources());
    },
  },

  "/api/admin/explorer/list": {
    async GET(req: Request) {
      const denied = await requireAdmin(req);
      if (denied) return denied;

      try {
        const url = new URL(req.url);
        return Response.json(await getExplorerList(url.searchParams.get("resource"), url.searchParams));
      } catch (error) {
        return Response.json(
          { error: error instanceof Error ? error.message : "Explorer list failed." },
          { status: 400 },
        );
      }
    },
  },

  "/api/admin/explorer/detail": {
    async GET(req: Request) {
      const denied = await requireAdmin(req);
      if (denied) return denied;

      try {
        const url = new URL(req.url);
        return Response.json(
          await getExplorerDetail(url.searchParams.get("resource"), url.searchParams.get("id")),
        );
      } catch (error) {
        return Response.json(
          { error: error instanceof Error ? error.message : "Explorer detail failed." },
          { status: 400 },
        );
      }
    },
  },

  "/api/admin/explorer/user-insights": {
    async GET(req: Request) {
      const denied = await requireAdmin(req);
      if (denied) return denied;

      try {
        const url = new URL(req.url);
        const limit = Number(url.searchParams.get("limit") ?? "");
        return Response.json(
          await getUserInsights({
            q: url.searchParams.get("q") ?? undefined,
            guildId: url.searchParams.get("guildId"),
            includeBots: url.searchParams.get("includeBots") === "true",
            limit: Number.isFinite(limit) ? limit : undefined,
          }),
        );
      } catch (error) {
        return Response.json(
          { error: error instanceof Error ? error.message : "User insights failed." },
          { status: 400 },
        );
      }
    },
  },

  "/api/admin/explorer/user-insights/detail": {
    async GET(req: Request) {
      const denied = await requireAdmin(req);
      if (denied) return denied;

      try {
        const url = new URL(req.url);
        const detailLimit = Number(url.searchParams.get("detailLimit") ?? "");
        return Response.json(
          await getUserInsightDetail(url.searchParams.get("id"), {
            q: url.searchParams.get("q") ?? undefined,
            guildId: url.searchParams.get("guildId"),
            includeBots: url.searchParams.get("includeBots") === "true",
            detailLimit: Number.isFinite(detailLimit) ? detailLimit : undefined,
          }),
        );
      } catch (error) {
        return Response.json(
          { error: error instanceof Error ? error.message : "User insight detail failed." },
          { status: 400 },
        );
      }
    },
  },
};
