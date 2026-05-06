CREATE TABLE IF NOT EXISTS `users` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `provider` text NOT NULL,
  `provider_user_key` text NOT NULL,
  `username` text NOT NULL,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL,
  `last_progress_synced_at` text
);
CREATE UNIQUE INDEX IF NOT EXISTS `users_provider_provider_user_key_idx`
  ON `users` (`provider`, `provider_user_key`);

CREATE TABLE IF NOT EXISTS `user_roles` (
  `user_id` integer NOT NULL,
  `role` text NOT NULL,
  `position` integer,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL,
  PRIMARY KEY(`user_id`, `role`),
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
CREATE INDEX IF NOT EXISTS `user_roles_role_position_user_id_idx`
  ON `user_roles` (`role`, `position`, `user_id`);

CREATE TABLE IF NOT EXISTS `contests` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `provider` text NOT NULL,
  `provider_contest_key` text NOT NULL,
  `title` text NOT NULL,
  `url` text NOT NULL,
  `starts_at` text,
  `participant_count` integer,
  `sync_state` text DEFAULT 'pending' NOT NULL,
  `sync_error` text,
  `last_sync_attempted_at` text,
  `synced_at` text,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS `contests_provider_provider_contest_key_idx`
  ON `contests` (`provider`, `provider_contest_key`);

CREATE TABLE IF NOT EXISTS `problems` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `contest_id` integer NOT NULL,
  `provider_problem_key` text NOT NULL,
  `title` text NOT NULL,
  `url` text NOT NULL,
  `position` integer,
  `points` real,
  `rating` integer,
  `tags` text DEFAULT '[]' NOT NULL,
  `solver_count` integer,
  `attempt_count` integer,
  `submission_count` integer,
  `solve_rate` real,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL,
  FOREIGN KEY (`contest_id`) REFERENCES `contests`(`id`) ON UPDATE no action ON DELETE cascade
);
CREATE UNIQUE INDEX IF NOT EXISTS `problems_contest_id_provider_problem_key_idx`
  ON `problems` (`contest_id`, `provider_problem_key`);

CREATE TABLE IF NOT EXISTS `submission` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `external_submission_id` text NOT NULL,
  `problem_id` integer NOT NULL,
  `user_id` integer NOT NULL,
  `verdict` text NOT NULL,
  `submitted_at` text NOT NULL,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL,
  FOREIGN KEY (`problem_id`) REFERENCES `problems`(`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
CREATE UNIQUE INDEX IF NOT EXISTS `submission_user_id_external_submission_id_idx`
  ON `submission` (`user_id`, `external_submission_id`);
CREATE INDEX IF NOT EXISTS `submission_problem_user_time_idx`
  ON `submission` (`problem_id`, `user_id`, `submitted_at`);

CREATE TABLE IF NOT EXISTS `user_problem_state` (
  `user_id` integer NOT NULL,
  `problem_id` integer NOT NULL,
  `attempted` integer NOT NULL,
  `passed` integer NOT NULL,
  `accepted_submission_id` integer,
  `last_submission_at` text,
  `updated_at` text NOT NULL,
  PRIMARY KEY(`user_id`, `problem_id`),
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`problem_id`) REFERENCES `problems`(`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`accepted_submission_id`) REFERENCES `submission`(`id`) ON UPDATE no action ON DELETE set null
);
CREATE INDEX IF NOT EXISTS `user_problem_state_user_passed_idx`
  ON `user_problem_state` (`user_id`, `passed`, `updated_at`);

CREATE TABLE IF NOT EXISTS `user_contest_state` (
  `user_id` integer NOT NULL,
  `contest_id` integer NOT NULL,
  `submission_count` integer NOT NULL,
  `accepted_count` integer NOT NULL,
  `qualifies_for_gym_finder` integer NOT NULL,
  `qualifies_for_gym_upsolving` integer NOT NULL,
  `qualifies_for_contest_upsolving` integer NOT NULL,
  `last_submission_at` text,
  `updated_at` text NOT NULL,
  PRIMARY KEY(`user_id`, `contest_id`),
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`contest_id`) REFERENCES `contests`(`id`) ON UPDATE no action ON DELETE cascade
);
CREATE INDEX IF NOT EXISTS `user_contest_state_user_qualifier_idx`
  ON `user_contest_state` (
    `user_id`,
    `qualifies_for_gym_finder`,
    `qualifies_for_gym_upsolving`,
    `qualifies_for_contest_upsolving`
  );

CREATE TABLE IF NOT EXISTS `app_session` (
  `id` integer PRIMARY KEY NOT NULL,
  `current_user_id` integer,
  `current_handle` text,
  `api_key` text,
  `api_secret` text,
  `authenticated_at` text,
  `last_validated_at` text,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL,
  FOREIGN KEY (`current_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);

CREATE TABLE IF NOT EXISTS `app_cache_state` (
  `key` text PRIMARY KEY NOT NULL,
  `value` text,
  `updated_at` text NOT NULL
);
