import { betterAuth } from "better-auth";
import { admin } from "better-auth/plugins";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "./db/client";

const defaultAppBaseUrl = "http://localhost:3000";

const betterAuthBaseUrl = process.env.BETTER_AUTH_BASE_URL || process.env.APP_BASE_URL || defaultAppBaseUrl;

const addOriginVariants = (origins: Set<string>, value: string | null | undefined) => {
  if (!value) return;

  try {
    const parsed = new URL(value);
    origins.add(parsed.origin);

    if (parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1") {
      origins.add(`http://${parsed.host}`);
      origins.add(`https://${parsed.host}`);
    }
  } catch {
    if (value.includes("://")) {
      origins.add(value);
      return;
    }

    origins.add(`https://${value}`);

    if (value.includes("localhost") || value.includes("127.0.0.1")) {
      origins.add(`http://${value}`);
    }
  }
};

const getRequestOrigin = (request?: Request | null): string | null => {
  if (!request) return null;

  const forwardedHost = request.headers.get("x-forwarded-host");
  const host = forwardedHost || request.headers.get("host");
  if (!host) return null;

  const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const requestProtocol = new URL(request.url).protocol.replace(":", "");
  const protocol = forwardedProto || requestProtocol || "http";

  return `${protocol}://${host}`;
};

const staticTrustedOrigins = new Set<string>();
addOriginVariants(staticTrustedOrigins, "localhost:3000");
addOriginVariants(staticTrustedOrigins, betterAuthBaseUrl);
addOriginVariants(staticTrustedOrigins, process.env.APP_BASE_URL);
addOriginVariants(staticTrustedOrigins, process.env.BETTER_AUTH_BASE_URL);

export const auth = betterAuth({
  baseURL: betterAuthBaseUrl,
  database: drizzleAdapter(db, {
    provider: "sqlite",
  }),
  emailAndPassword: {
    enabled: true,
  },
  plugins: [admin()],
  trustedOrigins: async (request) => {
    const trustedOrigins = new Set(staticTrustedOrigins);
    addOriginVariants(trustedOrigins, getRequestOrigin(request));
    return [...trustedOrigins];
  },
});
