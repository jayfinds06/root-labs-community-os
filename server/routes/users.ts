import { desc, sql } from "drizzle-orm";
import { db } from "../db/client";
import { visits } from "../db/schema";

export const usersRoutes = {
  "/api/visits": {
    async GET() {
      const items = db
        .select()
        .from(visits)
        .orderBy(desc(visits.createdAt))
        .limit(10)
        .all();
      const countResult = db
        .select({ value: sql<number>`count(*)` })
        .from(visits)
        .get();

      return Response.json({
        count: countResult?.value ?? 0,
        items,
      });
    },
    async POST(req: Request) {
      const payload = await req
        .json()
        .then((data) => data as { path?: unknown })
        .catch(() => ({} as { path?: unknown }));

      const path =
        typeof payload.path === "string" && payload.path.startsWith("/")
          ? payload.path
          : "/";

      db.insert(visits).values({ path }).run();

      const item = db
        .select()
        .from(visits)
        .orderBy(desc(visits.id))
        .limit(1)
        .get();

      return Response.json({ ok: true, item });
    },
  },
};
