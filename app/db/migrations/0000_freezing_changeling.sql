CREATE TABLE `app_settings` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`key` varchar(64) NOT NULL,
	`value` text,
	`updatedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `app_settings_id` PRIMARY KEY(`id`),
	CONSTRAINT `app_settings_key_unique` UNIQUE(`key`)
);
--> statement-breakpoint
CREATE TABLE `broker_accounts` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`userId` bigint unsigned NOT NULL,
	`snaptradeAccountId` varchar(64),
	`name` varchar(255),
	`institution` varchar(255),
	`number` varchar(64),
	`cash` double,
	`currency` varchar(8) DEFAULT 'USD',
	`source` enum('snaptrade','import','demo') NOT NULL DEFAULT 'import',
	`lastSyncedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `broker_accounts_id` PRIMARY KEY(`id`),
	CONSTRAINT `accounts_st_idx` UNIQUE(`snaptradeAccountId`)
);
--> statement-breakpoint
CREATE TABLE `positions` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`userId` bigint unsigned NOT NULL,
	`accountId` bigint unsigned,
	`symbol` varchar(32) NOT NULL,
	`description` varchar(255),
	`assetType` enum('stock','option','etf','other') NOT NULL DEFAULT 'stock',
	`quantity` double NOT NULL,
	`costBasis` double,
	`price` double,
	`currency` varchar(8) DEFAULT 'USD',
	`source` enum('snaptrade','import','manual','demo') NOT NULL DEFAULT 'manual',
	`optionType` enum('call','put'),
	`strike` double,
	`expiry` varchar(10),
	`rawSymbol` varchar(64),
	`updatedAt` timestamp NOT NULL DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `positions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `snaptrade_identities` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`userId` bigint unsigned NOT NULL,
	`snaptradeUserId` varchar(255) NOT NULL,
	`userSecret` varchar(512) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `snaptrade_identities_id` PRIMARY KEY(`id`),
	CONSTRAINT `st_identity_user_idx` UNIQUE(`userId`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`unionId` varchar(255) NOT NULL,
	`name` varchar(255),
	`email` varchar(320),
	`avatar` text,
	`role` enum('user','admin') NOT NULL DEFAULT 'user',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()),
	`lastSignInAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_unionId_unique` UNIQUE(`unionId`)
);
--> statement-breakpoint
ALTER TABLE `broker_accounts` ADD CONSTRAINT `broker_accounts_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `positions` ADD CONSTRAINT `positions_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `snaptrade_identities` ADD CONSTRAINT `snaptrade_identities_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `accounts_user_idx` ON `broker_accounts` (`userId`);--> statement-breakpoint
CREATE INDEX `positions_user_idx` ON `positions` (`userId`);--> statement-breakpoint
CREATE INDEX `positions_symbol_idx` ON `positions` (`userId`,`symbol`);