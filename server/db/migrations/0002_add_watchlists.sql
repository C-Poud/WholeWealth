CREATE TABLE IF NOT EXISTS `watchlists` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`userId` bigint unsigned NOT NULL,
	`name` varchar(128) NOT NULL DEFAULT 'My Watchlist',
	`description` varchar(255),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `watchlists_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `watchlist_items` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`watchlistId` bigint unsigned NOT NULL,
	`userId` bigint unsigned NOT NULL,
	`symbol` varchar(32) NOT NULL,
	`notes` varchar(255),
	`targetStrike` double,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `watchlist_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `watchlists_user_idx` ON `watchlists` (`userId`);
--> statement-breakpoint
CREATE INDEX `watchlist_items_wl_idx` ON `watchlist_items` (`watchlistId`);
--> statement-breakpoint
CREATE INDEX `watchlist_items_user_sym_idx` ON `watchlist_items` (`watchlistId`,`symbol`);
