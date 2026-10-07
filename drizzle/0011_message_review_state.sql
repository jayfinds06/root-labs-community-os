CREATE TABLE `message_review_state` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`message_id` integer NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`note` text,
	`reviewed_at` integer,
	`created_at` integer DEFAULT (unixepoch('now') * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch('now') * 1000) NOT NULL,
	FOREIGN KEY (`message_id`) REFERENCES `discord_messages`(`id`) ON UPDATE no action ON DELETE no action,
	UNIQUE(`message_id`)
);
--> statement-breakpoint
CREATE INDEX `message_review_state_status_idx` ON `message_review_state` (`status`);
--> statement-breakpoint
CREATE INDEX `message_review_state_reviewed_at_idx` ON `message_review_state` (`reviewed_at`);
