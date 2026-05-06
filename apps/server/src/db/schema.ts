import { type InferInsertModel, type InferSelectModel } from "drizzle-orm";
import {
  index,
  integer,
  primaryKey,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

export const users = sqliteTable(
  "users",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    provider: text("provider").notNull(),
    providerUserKey: text("provider_user_key").notNull(),
    username: text("username").notNull(),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
    lastProgressSyncedAt: text("last_progress_synced_at"),
  },
  (table) => [
    uniqueIndex("users_provider_provider_user_key_idx").on(
      table.provider,
      table.providerUserKey,
    ),
  ],
);

export const userRoles = sqliteTable(
  "user_roles",
  {
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: text("role").notNull(),
    position: integer("position"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.role] }),
    index("user_roles_role_position_user_id_idx").on(
      table.role,
      table.position,
      table.userId,
    ),
  ],
);

export const contests = sqliteTable(
  "contests",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    provider: text("provider").notNull(),
    providerContestKey: text("provider_contest_key").notNull(),
    title: text("title").notNull(),
    url: text("url").notNull(),
    startsAt: text("starts_at"),
    participantCount: integer("participant_count"),
    syncState: text("sync_state").notNull().default("pending"),
    syncError: text("sync_error"),
    lastSyncAttemptedAt: text("last_sync_attempted_at"),
    syncedAt: text("synced_at"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    uniqueIndex("contests_provider_provider_contest_key_idx").on(
      table.provider,
      table.providerContestKey,
    ),
  ],
);

export const problems = sqliteTable(
  "problems",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    contestId: integer("contest_id")
      .notNull()
      .references(() => contests.id, { onDelete: "cascade" }),
    providerProblemKey: text("provider_problem_key").notNull(),
    title: text("title").notNull(),
    url: text("url").notNull(),
    position: integer("position"),
    points: real("points"),
    rating: integer("rating"),
    tags: text("tags", { mode: "json" }).$type<readonly string[]>().notNull().default([]),
    solverCount: integer("solver_count"),
    attemptCount: integer("attempt_count"),
    submissionCount: integer("submission_count"),
    solveRate: real("solve_rate"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    uniqueIndex("problems_contest_id_provider_problem_key_idx").on(
      table.contestId,
      table.providerProblemKey,
    ),
  ],
);

export const submission = sqliteTable(
  "submission",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    externalSubmissionId: text("external_submission_id").notNull(),
    problemId: integer("problem_id")
      .notNull()
      .references(() => problems.id, { onDelete: "cascade" }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    verdict: text("verdict").notNull(),
    submittedAt: text("submitted_at").notNull(),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    uniqueIndex("submission_user_id_external_submission_id_idx").on(
      table.userId,
      table.externalSubmissionId,
    ),
    index("submission_problem_user_time_idx").on(
      table.problemId,
      table.userId,
      table.submittedAt,
    ),
  ],
);

export const userProblemState = sqliteTable(
  "user_problem_state",
  {
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    problemId: integer("problem_id")
      .notNull()
      .references(() => problems.id, { onDelete: "cascade" }),
    attempted: integer("attempted", { mode: "boolean" }).notNull(),
    passed: integer("passed", { mode: "boolean" }).notNull(),
    acceptedSubmissionId: integer("accepted_submission_id").references(
      () => submission.id,
      { onDelete: "set null" },
    ),
    lastSubmissionAt: text("last_submission_at"),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.problemId] }),
    index("user_problem_state_user_passed_idx").on(
      table.userId,
      table.passed,
      table.updatedAt,
    ),
  ],
);

export const userContestState = sqliteTable(
  "user_contest_state",
  {
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    contestId: integer("contest_id")
      .notNull()
      .references(() => contests.id, { onDelete: "cascade" }),
    submissionCount: integer("submission_count").notNull(),
    acceptedCount: integer("accepted_count").notNull(),
    qualifiesForGymFinder: integer("qualifies_for_gym_finder", {
      mode: "boolean",
    }).notNull(),
    qualifiesForGymUpsolving: integer("qualifies_for_gym_upsolving", {
      mode: "boolean",
    }).notNull(),
    qualifiesForContestUpsolving: integer("qualifies_for_contest_upsolving", {
      mode: "boolean",
    }).notNull(),
    lastSubmissionAt: text("last_submission_at"),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.contestId] }),
    index("user_contest_state_user_qualifier_idx").on(
      table.userId,
      table.qualifiesForGymFinder,
      table.qualifiesForGymUpsolving,
      table.qualifiesForContestUpsolving,
    ),
  ],
);

export const appSession = sqliteTable("app_session", {
  id: integer("id").primaryKey(),
  currentUserId: integer("current_user_id").references(() => users.id, {
    onDelete: "set null",
  }),
  currentHandle: text("current_handle"),
  apiKey: text("api_key"),
  apiSecret: text("api_secret"),
  authenticatedAt: text("authenticated_at"),
  lastValidatedAt: text("last_validated_at"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const appCacheState = sqliteTable("app_cache_state", {
  key: text("key").primaryKey(),
  value: text("value"),
  updatedAt: text("updated_at").notNull(),
});

export const tables = {
  appCacheState,
  appSession,
  contests,
  problems,
  submission,
  userContestState,
  userProblemState,
  userRoles,
  users,
};

export type User = InferSelectModel<typeof users>;
export type NewUser = InferInsertModel<typeof users>;
export type UserRole = InferSelectModel<typeof userRoles>;
export type NewUserRole = InferInsertModel<typeof userRoles>;
export type Contest = InferSelectModel<typeof contests>;
export type NewContest = InferInsertModel<typeof contests>;
export type Problem = InferSelectModel<typeof problems>;
export type NewProblem = InferInsertModel<typeof problems>;
export type Submission = InferSelectModel<typeof submission>;
export type NewSubmission = InferInsertModel<typeof submission>;
export type UserProblemState = InferSelectModel<typeof userProblemState>;
export type NewUserProblemState = InferInsertModel<typeof userProblemState>;
export type UserContestState = InferSelectModel<typeof userContestState>;
export type NewUserContestState = InferInsertModel<typeof userContestState>;
export type AppSession = InferSelectModel<typeof appSession>;
export type NewAppSession = InferInsertModel<typeof appSession>;
export type AppCacheState = InferSelectModel<typeof appCacheState>;
export type NewAppCacheState = InferInsertModel<typeof appCacheState>;
