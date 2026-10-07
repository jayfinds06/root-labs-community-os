import { eq } from "drizzle-orm";
import { db } from "../db/client";
import { appSettings } from "../db/schema";

const SYNC_CADENCE_KEY = "discord.syncCadenceMinutes";
const ADMIN_CHAT_ALLOW_RAW_DATA_ACCESS_KEY = "adminChat.allowRawDataAccess";
const DEFAULT_SYNC_CADENCE_MINUTES = 10;
const MIN_SYNC_CADENCE_MINUTES = 5;
const MAX_SYNC_CADENCE_MINUTES = 60;

const normalizeCadenceMinutes = (value: unknown): number => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return DEFAULT_SYNC_CADENCE_MINUTES;
  }

  return Math.min(
    MAX_SYNC_CADENCE_MINUTES,
    Math.max(MIN_SYNC_CADENCE_MINUTES, Math.round(parsed)),
  );
};

const normalizeBoolean = (value: unknown): boolean => {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    return value === 1;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    return normalized === "true" || normalized === "1" || normalized === "yes" || normalized === "on";
  }

  return false;
};

export const getDiscordSyncCadenceMinutes = async (): Promise<number> => {
  const setting = await db
    .select({ value: appSettings.value })
    .from(appSettings)
    .where(eq(appSettings.key, SYNC_CADENCE_KEY))
    .get();

  if (!setting) {
    return DEFAULT_SYNC_CADENCE_MINUTES;
  }

  return normalizeCadenceMinutes(setting.value);
};

export const saveDiscordSyncCadenceMinutes = async (value: unknown): Promise<number> => {
  const normalized = normalizeCadenceMinutes(value);
  const now = new Date();

  await db.insert(appSettings).values({
    key: SYNC_CADENCE_KEY,
    value: String(normalized),
    updatedAt: now,
  }).onConflictDoUpdate({
    target: appSettings.key,
    set: {
      value: String(normalized),
      updatedAt: now,
    },
  });

  return normalized;
};

export const getAdminChatAllowRawDataAccess = async (): Promise<boolean> => {
  const setting = await db
    .select({ value: appSettings.value })
    .from(appSettings)
    .where(eq(appSettings.key, ADMIN_CHAT_ALLOW_RAW_DATA_ACCESS_KEY))
    .get();

  if (!setting) {
    return false;
  }

  return normalizeBoolean(setting.value);
};

export const saveAdminChatAllowRawDataAccess = async (value: unknown): Promise<boolean> => {
  const normalized = normalizeBoolean(value);
  const now = new Date();

  await db.insert(appSettings).values({
    key: ADMIN_CHAT_ALLOW_RAW_DATA_ACCESS_KEY,
    value: normalized ? "true" : "false",
    updatedAt: now,
  }).onConflictDoUpdate({
    target: appSettings.key,
    set: {
      value: normalized ? "true" : "false",
      updatedAt: now,
    },
  });

  return normalized;
};

export const discordSyncCadenceLimits = {
  defaultMinutes: DEFAULT_SYNC_CADENCE_MINUTES,
  minMinutes: MIN_SYNC_CADENCE_MINUTES,
  maxMinutes: MAX_SYNC_CADENCE_MINUTES,
};
