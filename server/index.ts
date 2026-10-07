import { serve } from "bun";
import { migrate } from "drizzle-orm/bun-sqlite/migrator";
import { db } from "./db/client";
import { usersRoutes } from "./routes/users";
import { authRoutes } from "./routes/auth";
import { registrationsRoutes } from "./routes/registrations";
import { adminRoutes } from "./routes/admin";
import { adminExplorerRoutes } from "./routes/admin-explorer";
import { handleSyncActivityRequest } from "./routes/sync-activity";
import { bootstrapDiscordOps } from "./discord";
import index from "../public/index.html";
import dashboard from "../public/dashboard.html";

migrate(db, { migrationsFolder: "./drizzle" });

void bootstrapDiscordOps();

const server = serve({
  routes: {
    ...usersRoutes,
    ...authRoutes,
    ...registrationsRoutes,
    ...adminRoutes,
    ...adminExplorerRoutes,

    "/admin/sync": handleSyncActivityRequest,
    "/admin/sync/*": handleSyncActivityRequest,
    "/admin/queues": () => Response.redirect("/admin/sync", 302),
    "/admin/queues/*": () => Response.redirect("/admin/sync", 302),
    "/": index,
    "/dashboard": dashboard,
    "/dashboard/*": dashboard,
    "/register": index,
  },

  development: process.env.NODE_ENV !== "production" && {
    // Enable browser hot reloading in development
    hmr: true,

    // Echo console logs from the browser to the server
    console: true,
  },
});

console.log(`Server running at ${server.url}`);
