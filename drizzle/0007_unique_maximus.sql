CREATE TABLE `channel_daily_snapshots` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`channel_id` integer NOT NULL,
	`bucket_start` integer NOT NULL,
	`message_count` integer DEFAULT 0 NOT NULL,
	`active_user_count` integer DEFAULT 0 NOT NULL,
	`positive_count` integer DEFAULT 0 NOT NULL,
	`neutral_count` integer DEFAULT 0 NOT NULL,
	`negative_count` integer DEFAULT 0 NOT NULL,
	`updated_at` integer DEFAULT (unixepoch('now') * 1000) NOT NULL,
	FOREIGN KEY (`channel_id`) REFERENCES `discord_channels`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `channel_daily_snapshots_bucket_idx` ON `channel_daily_snapshots` (`bucket_start`);--> statement-breakpoint
CREATE INDEX `channel_daily_snapshots_channel_bucket_idx` ON `channel_daily_snapshots` (`channel_id`,`bucket_start`);--> statement-breakpoint
CREATE TABLE `channel_hourly_snapshots` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`channel_id` integer NOT NULL,
	`bucket_start` integer NOT NULL,
	`message_count` integer DEFAULT 0 NOT NULL,
	`active_user_count` integer DEFAULT 0 NOT NULL,
	`positive_count` integer DEFAULT 0 NOT NULL,
	`neutral_count` integer DEFAULT 0 NOT NULL,
	`negative_count` integer DEFAULT 0 NOT NULL,
	`updated_at` integer DEFAULT (unixepoch('now') * 1000) NOT NULL,
	FOREIGN KEY (`channel_id`) REFERENCES `discord_channels`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `channel_hourly_snapshots_bucket_idx` ON `channel_hourly_snapshots` (`bucket_start`);--> statement-breakpoint
CREATE INDEX `channel_hourly_snapshots_channel_bucket_idx` ON `channel_hourly_snapshots` (`channel_id`,`bucket_start`);--> statement-breakpoint
CREATE TABLE `discord_channels` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`guild_id` integer NOT NULL,
	`discord_channel_id` text NOT NULL,
	`name` text NOT NULL,
	`is_monitored` integer DEFAULT true NOT NULL,
	`created_at` integer DEFAULT (unixepoch('now') * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch('now') * 1000) NOT NULL,
	FOREIGN KEY (`guild_id`) REFERENCES `discord_guilds`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `discord_channels_discord_channel_id_unique` ON `discord_channels` (`discord_channel_id`);--> statement-breakpoint
CREATE INDEX `discord_channels_guild_id_idx` ON `discord_channels` (`guild_id`);--> statement-breakpoint
CREATE INDEX `discord_channels_monitored_idx` ON `discord_channels` (`is_monitored`);--> statement-breakpoint
CREATE TABLE `discord_guilds` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`discord_guild_id` text NOT NULL,
	`name` text NOT NULL,
	`last_backfill_at` integer,
	`created_at` integer DEFAULT (unixepoch('now') * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch('now') * 1000) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `discord_guilds_discord_guild_id_unique` ON `discord_guilds` (`discord_guild_id`);--> statement-breakpoint
CREATE INDEX `discord_guilds_discord_guild_id_idx` ON `discord_guilds` (`discord_guild_id`);--> statement-breakpoint
CREATE TABLE `discord_members` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`guild_id` integer NOT NULL,
	`discord_user_id` text NOT NULL,
	`username` text NOT NULL,
	`display_name` text,
	`avatar_url` text,
	`is_bot` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (unixepoch('now') * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch('now') * 1000) NOT NULL,
	FOREIGN KEY (`guild_id`) REFERENCES `discord_guilds`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `discord_members_discord_user_id_unique` ON `discord_members` (`discord_user_id`);--> statement-breakpoint
CREATE INDEX `discord_members_guild_id_idx` ON `discord_members` (`guild_id`);--> statement-breakpoint
CREATE INDEX `discord_members_discord_user_id_idx` ON `discord_members` (`discord_user_id`);--> statement-breakpoint
CREATE TABLE `discord_messages` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`discord_message_id` text NOT NULL,
	`guild_id` integer NOT NULL,
	`channel_id` integer NOT NULL,
	`author_id` integer NOT NULL,
	`content` text DEFAULT '' NOT NULL,
	`created_at` integer NOT NULL,
	`edited_at` integer,
	`deleted_at` integer,
	`raw_json` text,
	FOREIGN KEY (`guild_id`) REFERENCES `discord_guilds`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`channel_id`) REFERENCES `discord_channels`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`author_id`) REFERENCES `discord_members`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `discord_messages_discord_message_id_unique` ON `discord_messages` (`discord_message_id`);--> statement-breakpoint
CREATE INDEX `discord_messages_discord_message_id_idx` ON `discord_messages` (`discord_message_id`);--> statement-breakpoint
CREATE INDEX `discord_messages_created_at_idx` ON `discord_messages` (`created_at`);--> statement-breakpoint
CREATE INDEX `discord_messages_channel_id_idx` ON `discord_messages` (`channel_id`);--> statement-breakpoint
CREATE INDEX `discord_messages_author_id_idx` ON `discord_messages` (`author_id`);--> statement-breakpoint
CREATE TABLE `message_sentiment` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`message_id` integer NOT NULL,
	`label` text NOT NULL,
	`confidence` integer DEFAULT 0 NOT NULL,
	`keywords_json` text DEFAULT '[]' NOT NULL,
	`rationale` text DEFAULT '' NOT NULL,
	`provider` text DEFAULT 'heuristic' NOT NULL,
	`classified_at` integer DEFAULT (unixepoch('now') * 1000) NOT NULL,
	FOREIGN KEY (`message_id`) REFERENCES `discord_messages`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `message_sentiment_message_id_unique` ON `message_sentiment` (`message_id`);--> statement-breakpoint
CREATE INDEX `message_sentiment_label_idx` ON `message_sentiment` (`label`);--> statement-breakpoint
CREATE INDEX `message_sentiment_classified_at_idx` ON `message_sentiment` (`classified_at`);--> statement-breakpoint
CREATE TABLE `overview_snapshots` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`granularity` text NOT NULL,
	`bucket_start` integer NOT NULL,
	`total_messages` integer DEFAULT 0 NOT NULL,
	`active_users` integer DEFAULT 0 NOT NULL,
	`negative_rate` integer DEFAULT 0 NOT NULL,
	`health_score` integer DEFAULT 0 NOT NULL,
	`updated_at` integer DEFAULT (unixepoch('now') * 1000) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `overview_snapshots_bucket_idx` ON `overview_snapshots` (`bucket_start`);--> statement-breakpoint
CREATE INDEX `overview_snapshots_granularity_bucket_idx` ON `overview_snapshots` (`granularity`,`bucket_start`);