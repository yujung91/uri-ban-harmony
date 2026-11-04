CREATE TABLE `creation_choices` (
	`classId` text NOT NULL,
	`studentId` text NOT NULL,
	`studentDraftId` text,
	`teacherDraftId` text,
	`delegate` integer DEFAULT 0 NOT NULL,
	`position` integer NOT NULL,
	PRIMARY KEY(`classId`, `studentId`)
);
--> statement-breakpoint
CREATE TABLE `creation_files` (
	`id` text PRIMARY KEY NOT NULL,
	`classId` text NOT NULL,
	`studentId` text NOT NULL,
	`draftId` text NOT NULL,
	`objectKey` text NOT NULL,
	`created` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `creation_history` (
	`id` text PRIMARY KEY NOT NULL,
	`classId` text NOT NULL,
	`draftId` text NOT NULL,
	`actor` text NOT NULL,
	`data` text NOT NULL,
	`created` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `creation_drafts` (
	`id` text PRIMARY KEY NOT NULL,
	`classId` text NOT NULL,
	`studentId` text NOT NULL,
	`data` text NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`updated` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `creation_draft_student` ON `creation_drafts` (`classId`,`studentId`);--> statement-breakpoint
CREATE TABLE `creation_sessions` (
	`tokenHash` text PRIMARY KEY NOT NULL,
	`studentId` text NOT NULL,
	`authVersion` integer NOT NULL,
	`expires` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `creation_students` (
	`id` text PRIMARY KEY NOT NULL,
	`classId` text NOT NULL,
	`number` integer NOT NULL,
	`salt` text NOT NULL,
	`pinHash` text NOT NULL,
	`authVersion` integer DEFAULT 1 NOT NULL,
	`created` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `creation_student_number` ON `creation_students` (`classId`,`number`);--> statement-breakpoint
CREATE TABLE `creation_submissions` (
	`draftId` text PRIMARY KEY NOT NULL,
	`classId` text NOT NULL,
	`studentId` text NOT NULL,
	`data` text NOT NULL,
	`original` text NOT NULL,
	`revision` integer NOT NULL,
	`teacherData` text,
	`teacherRevision` integer DEFAULT 0 NOT NULL,
	`submitted` integer NOT NULL
);
