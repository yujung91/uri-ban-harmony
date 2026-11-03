CREATE TABLE `classes` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`code` text NOT NULL,
	`project` text NOT NULL,
	`stage` integer DEFAULT 0 NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`plays` integer DEFAULT 0 NOT NULL,
	`joinOpen` integer DEFAULT 1 NOT NULL,
	`created` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `classes_code_unique` ON `classes` (`code`);--> statement-breakpoint
CREATE TABLE `limits` (
	`id` text PRIMARY KEY NOT NULL,
	`hits` integer NOT NULL,
	`reset` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `media` (
	`id` text PRIMARY KEY NOT NULL,
	`classId` text NOT NULL,
	`memberId` text NOT NULL,
	`kind` text NOT NULL,
	`type` text NOT NULL,
	`size` integer NOT NULL,
	`created` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `members` (
	`id` text PRIMARY KEY NOT NULL,
	`classId` text NOT NULL,
	`tokenHash` text NOT NULL,
	`nickname` text NOT NULL,
	`created` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `members_tokenHash_unique` ON `members` (`tokenHash`);--> statement-breakpoint
CREATE TABLE `rules` (
	`id` text PRIMARY KEY NOT NULL,
	`classId` text NOT NULL,
	`authorId` text NOT NULL,
	`text` text NOT NULL,
	`kind` text NOT NULL,
	`media` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`emoji` text NOT NULL,
	`created` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `scenes` (
	`classId` text NOT NULL,
	`workId` text NOT NULL,
	`position` integer NOT NULL,
	PRIMARY KEY(`classId`, `workId`)
);
--> statement-breakpoint
CREATE TABLE `selected` (
	`classId` text NOT NULL,
	`ruleId` text NOT NULL,
	`position` integer NOT NULL,
	PRIMARY KEY(`classId`, `ruleId`)
);
--> statement-breakpoint
CREATE TABLE `versions` (
	`id` text PRIMARY KEY NOT NULL,
	`classId` text NOT NULL,
	`version` integer NOT NULL,
	`snapshot` text NOT NULL,
	`created` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `votes` (
	`ruleId` text NOT NULL,
	`memberId` text NOT NULL,
	PRIMARY KEY(`ruleId`, `memberId`)
);
--> statement-breakpoint
CREATE TABLE `works` (
	`id` text PRIMARY KEY NOT NULL,
	`classId` text NOT NULL,
	`authorId` text NOT NULL,
	`title` text NOT NULL,
	`text` text NOT NULL,
	`kind` text NOT NULL,
	`media` text,
	`beats` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`created` integer NOT NULL
);
