import { Database } from "bun:sqlite";
import { existsSync, mkdirSync, renameSync } from "node:fs";
import { dirname, extname, resolve } from "node:path";
import { drizzle } from "drizzle-orm/bun-sqlite";
import * as schema from "../../server/db/schema";

const sqlitePath = resolve(process.cwd(), "data/app.db");
mkdirSync(dirname(sqlitePath), { recursive: true });

const isCorruptSqliteError = (error: unknown) => {
  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message.toLowerCase();
  return message.includes("sqlite_corrupt")
    || message.includes("malformed database schema")
    || message.includes("invalid rootpage")
    || message.includes("database disk image is malformed");
};

const rotateCorruptSqliteFiles = () => {
  const timestamp = new Date().toISOString().replaceAll(":", "-");
  const files = [sqlitePath, `${sqlitePath}-shm`, `${sqlitePath}-wal`];

  for (const filePath of files) {
    if (!existsSync(filePath)) {
      continue;
    }

    const extension = extname(filePath);
    const basePath = extension ? filePath.slice(0, -extension.length) : filePath;
    const backupPath = `${basePath}.corrupt-${timestamp}${extension || ".bak"}`;
    renameSync(filePath, backupPath);
  }
};

const openSqliteClient = () => {
  try {
    const client = new Database(sqlitePath, { create: true });
    client.exec("PRAGMA journal_mode = WAL;");
    client.exec("PRAGMA busy_timeout = 5000;");
    return client;
  } catch (error) {
    if (!isCorruptSqliteError(error)) {
      throw error;
    }

    console.error(`SQLite corruption detected at ${sqlitePath}. Rotating files and recreating the database.`);
    rotateCorruptSqliteFiles();

    const client = new Database(sqlitePath, { create: true });
    client.exec("PRAGMA journal_mode = WAL;");
    client.exec("PRAGMA busy_timeout = 5000;");
    return client;
  }
};

const client = openSqliteClient();

export const sqliteClient = client;
export const db = drizzle(client, { schema });
