import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { Database } from "bun:sqlite";
import { Context, Effect, Layer } from "effect";
import { drizzle } from "drizzle-orm/bun-sqlite";

import { PersistenceError } from "../errors/persistence.ts";
import { tables } from "./schema.ts";

const currentDir = dirname(fileURLToPath(import.meta.url));
const drizzleDirectory = resolve(currentDir, "../../drizzle");

function createDrizzle(sqlite: Database) {
  return drizzle({ client: sqlite, schema: tables });
}

export type AppDatabase = ReturnType<typeof createDrizzle>;

export interface DatabaseServiceShape {
  readonly sqlite: Database;
  readonly db: AppDatabase;
  readonly migrate: Effect.Effect<void, PersistenceError>;
}

export class DatabaseService extends Context.Tag("icpc-trainer/DatabaseService")<
  DatabaseService,
  DatabaseServiceShape
>() {}

function loadMigrationStatements() {
  return readdirSync(drizzleDirectory)
    .filter((fileName) => fileName.endsWith(".sql"))
    .sort()
    .map((fileName) => readFileSync(join(drizzleDirectory, fileName), "utf8"));
}

function ensureColumn(sqlite: Database, tableName: string, columnName: string, definition: string) {
  const columns = sqlite
    .query<{ name: string }, []>(`PRAGMA table_info(${tableName})`)
    .all()
    .map((column) => column.name);

  if (!columns.includes(columnName)) {
    sqlite.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`);
  }
}

export const makeDatabaseService = Effect.fn("db.makeDatabaseService")(function* (options?: {
  readonly databaseUrl?: string;
  readonly runMigrations?: boolean;
}) {
  const databaseUrl = options?.databaseUrl ?? process.env.DATABASE_URL ?? "dev.db";
  const sqlite = new Database(databaseUrl);
  sqlite.exec("PRAGMA foreign_keys = ON;");
  const db = createDrizzle(sqlite);
  const migrationStatements = loadMigrationStatements();

  const migrate = Effect.try({
    try: () => {
      for (const statement of migrationStatements) {
        sqlite.exec(statement);
      }
      ensureColumn(sqlite, "problems", "attempt_count", "integer");
      ensureColumn(sqlite, "problems", "submission_count", "integer");
      ensureColumn(sqlite, "problems", "tags", "text NOT NULL DEFAULT '[]'");
    },
    catch: (error) =>
      new PersistenceError({
        code: "migration_failed",
        message:
          error instanceof Error ? error.message : "Failed to apply database migrations.",
      }),
  });

  if (options?.runMigrations ?? true) {
    yield* migrate;
  }

  return {
    sqlite,
    db,
    migrate,
  } satisfies DatabaseServiceShape;
});

export const makeDatabaseLayer = (options?: {
  readonly databaseUrl?: string;
  readonly runMigrations?: boolean;
}) =>
  Layer.scoped(
    DatabaseService,
    Effect.acquireRelease(makeDatabaseService(options), ({ sqlite }) =>
      Effect.sync(() => {
        sqlite.close();
      }),
    ),
  );

export const DatabaseLive = makeDatabaseLayer();
