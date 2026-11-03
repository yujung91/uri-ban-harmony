CREATE TABLE `revisions` (
	`id` text PRIMARY KEY NOT NULL,
	`classId` text NOT NULL,
	`entity` text NOT NULL,
	`itemId` text NOT NULL,
	`snapshot` text NOT NULL,
	`created` integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE `classes` ADD `movie` text;--> statement-breakpoint
ALTER TABLE `rules` ADD `original` text;--> statement-breakpoint
ALTER TABLE `rules` ADD `edited` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `works` ADD `ruleId` text;--> statement-breakpoint
ALTER TABLE `works` ADD `payload` text;--> statement-breakpoint
ALTER TABLE `works` ADD `original` text;--> statement-breakpoint
ALTER TABLE `works` ADD `edited` integer DEFAULT 0 NOT NULL;