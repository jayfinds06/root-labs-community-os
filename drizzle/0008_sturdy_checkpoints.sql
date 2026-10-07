CREATE TABLE `discord_channel_sync_state` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`channel_id` integer NOT NULL,
	`last_cursor_message_id` text,
	`last_cursor_message_created_at` integer,
	`last_attempted_sync_at` integer,
	`last_successful_sync_at` integer,
	`last_error` text,
	`created_at` integer DEFAULT (unixepoch('now') * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch('now') * 1000) NOT NULL,
	FOREIGN KEY (`channel_id`) REFERENCES `discord_channels`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `discord_channel_sync_state_channel_id_unique` ON `discord_channel_sync_state` (`channel_id`);--> statement-breakpoint
CREATE INDEX `discord_channel_sync_state_channel_id_idx` ON `discord_channel_sync_state` (`channel_id`);--> statement-breakpoint
CREATE INDEX `discord_channel_sync_state_last_successful_sync_idx` ON `discord_channel_sync_state` (`last_successful_sync_at`);
