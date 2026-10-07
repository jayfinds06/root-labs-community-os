CREATE TABLE `sync_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`mode` text NOT NULL,
	`requested_by` text NOT NULL,
	`execution_mode` text NOT NULL,
	`reset` integer DEFAULT false NOT NULL,
	`status` text NOT NULL,
	`started_at` integer NOT NULL,
	`finished_at` integer,
	`duration_ms` integer,
	`classified_count` integer DEFAULT 0 NOT NULL,
	`failure_reason` text,
	`created_at` integer DEFAULT (unixepoch('now') * 1000) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `sync_runs_started_at_idx` ON `sync_runs` (`started_at`);
--> statement-breakpoint
CREATE INDEX `sync_runs_status_idx` ON `sync_runs` (`status`);
--> statement-breakpoint
CREATE TABLE `sync_run_logs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`run_id` text NOT NULL,
	`timestamp` integer NOT NULL,
	`message` text NOT NULL,
	FOREIGN KEY (`run_id`) REFERENCES `sync_runs`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `sync_run_logs_run_id_idx` ON `sync_run_logs` (`run_id`);
--> statement-breakpoint
CREATE INDEX `sync_run_logs_run_timestamp_idx` ON `sync_run_logs` (`run_id`,`timestamp`);
