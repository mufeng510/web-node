CREATE TABLE `ai_index_chunks` (
	`id` text PRIMARY KEY NOT NULL,
	`index_id` text NOT NULL,
	`file_id` text NOT NULL,
	`chunk_index` integer NOT NULL,
	`content` text NOT NULL,
	`embedding` text,
	`metadata` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`index_id`) REFERENCES `ai_indexes`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`file_id`) REFERENCES `files`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ai_index_chunks_index_file_chunk_idx` ON `ai_index_chunks` (`index_id`,`file_id`,`chunk_index`);--> statement-breakpoint
CREATE INDEX `ai_index_chunks_index_id_idx` ON `ai_index_chunks` (`index_id`);--> statement-breakpoint
CREATE INDEX `ai_index_chunks_file_id_idx` ON `ai_index_chunks` (`file_id`);--> statement-breakpoint
CREATE TABLE `ai_indexes` (
	`id` text PRIMARY KEY NOT NULL,
	`library_id` text NOT NULL,
	`provider_id` text,
	`embed_model` text NOT NULL,
	`status` text DEFAULT 'idle' NOT NULL,
	`progress` integer DEFAULT 0 NOT NULL,
	`total_files` integer DEFAULT 0 NOT NULL,
	`indexed_files` integer DEFAULT 0 NOT NULL,
	`total_chunks` integer DEFAULT 0 NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`last_indexed_at` integer,
	`error` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`library_id`) REFERENCES `libraries`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`provider_id`) REFERENCES `providers`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ai_indexes_library_id_unique` ON `ai_indexes` (`library_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `ai_indexes_library_id_idx` ON `ai_indexes` (`library_id`);--> statement-breakpoint
CREATE INDEX `ai_indexes_status_idx` ON `ai_indexes` (`status`);--> statement-breakpoint
CREATE TABLE `audit_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text,
	`library_id` text,
	`action` text NOT NULL,
	`resource_type` text,
	`resource_id` text,
	`metadata` text,
	`ip` text,
	`user_agent` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`library_id`) REFERENCES `libraries`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `audit_logs_user_id_idx` ON `audit_logs` (`user_id`);--> statement-breakpoint
CREATE INDEX `audit_logs_library_id_idx` ON `audit_logs` (`library_id`);--> statement-breakpoint
CREATE INDEX `audit_logs_action_idx` ON `audit_logs` (`action`);--> statement-breakpoint
CREATE INDEX `audit_logs_created_at_idx` ON `audit_logs` (`created_at`);--> statement-breakpoint
CREATE TABLE `conversations` (
	`id` text PRIMARY KEY NOT NULL,
	`library_id` text NOT NULL,
	`user_id` text NOT NULL,
	`title` text NOT NULL,
	`current_note_id` text,
	`message_count` integer DEFAULT 0 NOT NULL,
	`is_deleted` integer DEFAULT false NOT NULL,
	`deleted_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`library_id`) REFERENCES `libraries`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `conversations_library_user_idx` ON `conversations` (`library_id`,`user_id`);--> statement-breakpoint
CREATE INDEX `conversations_user_id_idx` ON `conversations` (`user_id`);--> statement-breakpoint
CREATE INDEX `conversations_updated_at_idx` ON `conversations` (`updated_at`);--> statement-breakpoint
CREATE TABLE `messages` (
	`id` text PRIMARY KEY NOT NULL,
	`conversation_id` text NOT NULL,
	`role` text NOT NULL,
	`content` text NOT NULL,
	`metadata` text,
	`citations` text,
	`token_count` integer,
	`model` text,
	`provider_id` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`conversation_id`) REFERENCES `conversations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `messages_conversation_id_idx` ON `messages` (`conversation_id`);--> statement-breakpoint
CREATE INDEX `messages_created_at_idx` ON `messages` (`created_at`);--> statement-breakpoint
CREATE TABLE `files` (
	`id` text PRIMARY KEY NOT NULL,
	`library_id` text NOT NULL,
	`parent_id` text,
	`path` text NOT NULL,
	`name` text NOT NULL,
	`is_dir` integer DEFAULT false NOT NULL,
	`size` integer DEFAULT 0 NOT NULL,
	`mime_type` text,
	`hash` text,
	`version` integer DEFAULT 0 NOT NULL,
	`frontmatter` text,
	`mtime` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`library_id`) REFERENCES `libraries`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`parent_id`) REFERENCES `files`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `files_library_path_idx` ON `files` (`library_id`,`path`);--> statement-breakpoint
CREATE INDEX `files_library_parent_idx` ON `files` (`library_id`,`parent_id`);--> statement-breakpoint
CREATE INDEX `files_library_name_idx` ON `files` (`library_id`,`name`);--> statement-breakpoint
CREATE INDEX `files_hash_idx` ON `files` (`hash`);--> statement-breakpoint
CREATE TABLE `git_commits` (
	`id` text PRIMARY KEY NOT NULL,
	`library_id` text NOT NULL,
	`hash` text NOT NULL,
	`short_hash` text NOT NULL,
	`message` text NOT NULL,
	`author_name` text NOT NULL,
	`author_email` text NOT NULL,
	`author_date` integer NOT NULL,
	`committer_name` text,
	`committer_email` text,
	`committer_date` integer,
	`parents` text DEFAULT '[]',
	`files` text DEFAULT '[]',
	`created_at` integer NOT NULL,
	FOREIGN KEY (`library_id`) REFERENCES `libraries`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `git_commits_library_id_idx` ON `git_commits` (`library_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `git_commits_hash_idx` ON `git_commits` (`hash`);--> statement-breakpoint
CREATE INDEX `git_commits_author_date_idx` ON `git_commits` (`author_date`);--> statement-breakpoint
CREATE TABLE `git_configs` (
	`id` text PRIMARY KEY NOT NULL,
	`library_id` text NOT NULL,
	`remote_url` text,
	`branch` text DEFAULT 'main' NOT NULL,
	`auth_type` text DEFAULT 'none' NOT NULL,
	`credentials` text,
	`auto_backup` integer DEFAULT true NOT NULL,
	`auto_backup_schedule` text DEFAULT '0 * * * *',
	`last_backup_at` integer,
	`last_commit_hash` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`library_id`) REFERENCES `libraries`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `git_configs_library_id_unique` ON `git_configs` (`library_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `git_configs_library_id_idx` ON `git_configs` (`library_id`);--> statement-breakpoint
CREATE TABLE `db_backups` (
	`id` text PRIMARY KEY NOT NULL,
	`path` text NOT NULL,
	`size` integer NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`error` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `db_backups_created_at_idx` ON `db_backups` (`created_at`);--> statement-breakpoint
CREATE TABLE `libraries` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`path` text NOT NULL,
	`owner_id` text NOT NULL,
	`config` text NOT NULL,
	`git_config` text,
	`ai_index_config` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `libraries_path_unique` ON `libraries` (`path`);--> statement-breakpoint
CREATE UNIQUE INDEX `libraries_path_idx` ON `libraries` (`path`);--> statement-breakpoint
CREATE INDEX `libraries_owner_id_idx` ON `libraries` (`owner_id`);--> statement-breakpoint
CREATE TABLE `library_members` (
	`id` text PRIMARY KEY NOT NULL,
	`library_id` text NOT NULL,
	`user_id` text NOT NULL,
	`role` text DEFAULT 'member' NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`library_id`) REFERENCES `libraries`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `library_members_library_user_idx` ON `library_members` (`library_id`,`user_id`);--> statement-breakpoint
CREATE INDEX `library_members_library_id_idx` ON `library_members` (`library_id`);--> statement-breakpoint
CREATE INDEX `library_members_user_id_idx` ON `library_members` (`user_id`);--> statement-breakpoint
CREATE TABLE `mcp_tokens` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`token_hash` text NOT NULL,
	`library_id` text NOT NULL,
	`permissions` text DEFAULT '{"read":true,"write":false,"git":false}' NOT NULL,
	`expires_at` integer,
	`revoked_at` integer,
	`last_used_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`library_id`) REFERENCES `libraries`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `mcp_tokens_token_hash_unique` ON `mcp_tokens` (`token_hash`);--> statement-breakpoint
CREATE UNIQUE INDEX `mcp_tokens_token_hash_idx` ON `mcp_tokens` (`token_hash`);--> statement-breakpoint
CREATE INDEX `mcp_tokens_library_id_idx` ON `mcp_tokens` (`library_id`);--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`type` text NOT NULL,
	`title` text NOT NULL,
	`message` text,
	`data` text,
	`read` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `notifications_user_id_idx` ON `notifications` (`user_id`);--> statement-breakpoint
CREATE INDEX `notifications_read_idx` ON `notifications` (`read`);--> statement-breakpoint
CREATE INDEX `notifications_created_at_idx` ON `notifications` (`created_at`);--> statement-breakpoint
CREATE TABLE `providers` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`base_url` text NOT NULL,
	`api_key` text,
	`chat_model` text NOT NULL,
	`embed_model` text,
	`rerank_model` text,
	`custom_headers` text,
	`capabilities` text DEFAULT '[]',
	`is_default` integer DEFAULT false NOT NULL,
	`discovered_models` text DEFAULT '[]',
	`last_tested_at` integer,
	`last_test_result` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `providers_name_idx` ON `providers` (`name`);--> statement-breakpoint
CREATE INDEX `providers_is_default_idx` ON `providers` (`is_default`);--> statement-breakpoint
CREATE TABLE `search_index` (
	`id` text PRIMARY KEY NOT NULL,
	`library_id` text NOT NULL,
	`file_id` text NOT NULL,
	`path` text NOT NULL,
	`name` text NOT NULL,
	`content` text,
	`frontmatter` text,
	`tags` text,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`library_id`) REFERENCES `libraries`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`file_id`) REFERENCES `files`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `search_index_library_id_idx` ON `search_index` (`library_id`);--> statement-breakpoint
CREATE INDEX `search_index_file_id_idx` ON `search_index` (`file_id`);--> statement-breakpoint
CREATE INDEX `search_index_name_idx` ON `search_index` (`name`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`token_hash` text NOT NULL,
	`device_info` text,
	`ip` text,
	`expires_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	`last_activity_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sessions_token_hash_unique` ON `sessions` (`token_hash`);--> statement-breakpoint
CREATE UNIQUE INDEX `sessions_token_hash_idx` ON `sessions` (`token_hash`);--> statement-breakpoint
CREATE INDEX `sessions_user_id_idx` ON `sessions` (`user_id`);--> statement-breakpoint
CREATE INDEX `sessions_expires_at_idx` ON `sessions` (`expires_at`);--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `settings_key_idx` ON `settings` (`key`);--> statement-breakpoint
CREATE TABLE `task_rollbacks` (
	`id` text PRIMARY KEY NOT NULL,
	`task_id` text NOT NULL,
	`file_id` text NOT NULL,
	`before_hash` text,
	`after_hash` text,
	`before_version` integer NOT NULL,
	`after_version` integer NOT NULL,
	`before_content` text,
	`after_content` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`file_id`) REFERENCES `files`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `task_rollbacks_task_id_idx` ON `task_rollbacks` (`task_id`);--> statement-breakpoint
CREATE INDEX `task_rollbacks_file_id_idx` ON `task_rollbacks` (`file_id`);--> statement-breakpoint
CREATE TABLE `task_steps` (
	`id` text PRIMARY KEY NOT NULL,
	`task_id` text NOT NULL,
	`step_index` integer NOT NULL,
	`tool` text NOT NULL,
	`args` text,
	`result` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`error` text,
	`started_at` integer,
	`finished_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `task_steps_task_step_idx` ON `task_steps` (`task_id`,`step_index`);--> statement-breakpoint
CREATE INDEX `task_steps_task_id_idx` ON `task_steps` (`task_id`);--> statement-breakpoint
CREATE TABLE `tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`conversation_id` text,
	`user_id` text NOT NULL,
	`library_id` text NOT NULL,
	`goal` text NOT NULL,
	`plan` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`current_step` integer DEFAULT 0 NOT NULL,
	`total_steps` integer DEFAULT 0 NOT NULL,
	`provider_id` text,
	`model` text,
	`parameters` text,
	`lock_files` text DEFAULT '[]',
	`result` text,
	`error` text,
	`started_at` integer,
	`finished_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`conversation_id`) REFERENCES `conversations`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`library_id`) REFERENCES `libraries`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`provider_id`) REFERENCES `providers`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `tasks_user_id_idx` ON `tasks` (`user_id`);--> statement-breakpoint
CREATE INDEX `tasks_library_id_idx` ON `tasks` (`library_id`);--> statement-breakpoint
CREATE INDEX `tasks_conversation_id_idx` ON `tasks` (`conversation_id`);--> statement-breakpoint
CREATE INDEX `tasks_status_idx` ON `tasks` (`status`);--> statement-breakpoint
CREATE INDEX `tasks_created_at_idx` ON `tasks` (`created_at`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`password_hash` text NOT NULL,
	`role` text DEFAULT 'user' NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`failed_login_attempts` integer DEFAULT 0 NOT NULL,
	`locked_until` integer,
	`last_login_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_idx` ON `users` (`email`);--> statement-breakpoint
CREATE INDEX `users_role_idx` ON `users` (`role`);--> statement-breakpoint
CREATE TABLE `webhooks` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`url` text NOT NULL,
	`events` text NOT NULL,
	`secret` text,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `webhooks_created_at_idx` ON `webhooks` (`created_at`);