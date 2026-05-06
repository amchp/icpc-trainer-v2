import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";
import { getTableConfig } from "drizzle-orm/sqlite-core";

import {
  contests,
  problems,
  tables,
  userContestState,
  userProblemState,
  userRoles,
} from "./schema.ts";

const currentDir = dirname(fileURLToPath(import.meta.url));

function getColumnNames(table: Parameters<typeof getTableConfig>[0]) {
  return getTableConfig(table).columns.map((column) => column.name);
}

describe("server schema", () => {
  it("exports the effect-first table set", () => {
    expect(Object.keys(tables).sort()).toEqual([
      "appCacheState",
      "appSession",
      "contests",
      "problems",
      "submission",
      "userContestState",
      "userProblemState",
      "userRoles",
      "users",
    ]);
  });

  it("uses role and provider based tables instead of legacy shapes", () => {
    expect(getColumnNames(userRoles)).toEqual(
      expect.arrayContaining(["user_id", "role", "position"]),
    );
    expect(getColumnNames(contests)).toContain("starts_at");
    expect(getColumnNames(problems)).toEqual(
      expect.arrayContaining(["position", "points", "tags"]),
    );
    expect(Object.keys(tables)).not.toContain("friendMembers");
    expect(Object.keys(tables)).not.toContain("teamMembers");
  });

  it("keeps the intended indexes and keys", () => {
    const contestIndexes = getTableConfig(contests).indexes.map((indexConfig) => indexConfig.config.name);
    const roleIndexes = getTableConfig(userRoles).indexes.map((indexConfig) => indexConfig.config.name);
    const problemIndexes = getTableConfig(problems).indexes.map((indexConfig) => indexConfig.config.name);

    expect(contestIndexes).toContain("contests_provider_provider_contest_key_idx");
    expect(roleIndexes).toContain("user_roles_role_position_user_id_idx");
    expect(problemIndexes).toContain("problems_contest_id_provider_problem_key_idx");
    expect(getTableConfig(userRoles).primaryKeys).toHaveLength(1);
    expect(getTableConfig(userContestState).primaryKeys).toHaveLength(1);
    expect(getTableConfig(userProblemState).primaryKeys).toHaveLength(1);
  });
});

describe("baseline migration", () => {
  it("creates the intended tables and omits legacy tables", () => {
    const migrationPath = join(
      currentDir,
      "..",
      "..",
      "drizzle",
      "0000_effect_first_backend.sql",
    );
    const script = `
      import { Database } from "bun:sqlite";
      import { readFileSync } from "node:fs";

      const database = new Database(":memory:");
      database.exec(readFileSync(${JSON.stringify(migrationPath)}, "utf8"));

      const tableNames = database
        .query("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
        .all()
        .map((row) => row.name);

      console.log(JSON.stringify({ tableNames }));
      database.close();
    `;
    const result = spawnSync("bun", ["-e", script], {
      cwd: join(currentDir, "..", "..", ".."),
      encoding: "utf8",
    });

    expect(result.status).toBe(0);

    const output = JSON.parse(result.stdout) as {
      tableNames: string[];
    };

    expect(output.tableNames).toEqual([
      "app_cache_state",
      "app_session",
      "contests",
      "problems",
      "submission",
      "user_contest_state",
      "user_problem_state",
      "user_roles",
      "users",
    ]);
    expect(output.tableNames).not.toContain("friend_members");
    expect(output.tableNames).not.toContain("team_members");
  });
});
