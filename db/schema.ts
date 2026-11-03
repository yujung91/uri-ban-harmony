// Intentionally empty by default.
// Add Drizzle tables here when the site actually needs a database.
// See examples/d1/db/schema.ts for an opt-in example.
import {sqliteTable, text, integer, primaryKey} from 'drizzle-orm/sqlite-core';
export const classes = sqliteTable('classes', {id:text().primaryKey(),owner:text().notNull(),code:text().notNull().unique(),project:text().notNull(),stage:integer().notNull().default(0),version:integer().notNull().default(1),plays:integer().notNull().default(0),joinOpen:integer().notNull().default(1),created:integer().notNull(),movie:text()});
export const members = sqliteTable('members', {id:text().primaryKey(),classId:text().notNull(),tokenHash:text().notNull().unique(),nickname:text().notNull(),created:integer().notNull()});
export const rules = sqliteTable('rules', {id:text().primaryKey(),classId:text().notNull(),authorId:text().notNull(),text:text().notNull(),kind:text().notNull(),media:text(),status:text().notNull().default('pending'),emoji:text().notNull(),created:integer().notNull(),original:text(),edited:integer().notNull().default(0)});
export const works = sqliteTable('works', {id:text().primaryKey(),classId:text().notNull(),authorId:text().notNull(),title:text().notNull(),text:text().notNull(),kind:text().notNull(),media:text(),beats:text(),status:text().notNull().default('pending'),created:integer().notNull(),ruleId:text(),payload:text(),original:text(),edited:integer().notNull().default(0)});
export const votes = sqliteTable('votes', {ruleId:text().notNull(),memberId:text().notNull()}, t=>[primaryKey({columns:[t.ruleId,t.memberId]})]);
export const selected = sqliteTable('selected', {classId:text().notNull(),ruleId:text().notNull(),position:integer().notNull()},t=>[primaryKey({columns:[t.classId,t.ruleId]})]);
export const scenes = sqliteTable('scenes', {classId:text().notNull(),workId:text().notNull(),position:integer().notNull()},t=>[primaryKey({columns:[t.classId,t.workId]})]);
export const media = sqliteTable('media', {id:text().primaryKey(),classId:text().notNull(),memberId:text().notNull(),kind:text().notNull(),type:text().notNull(),size:integer().notNull(),created:integer().notNull()});
export const limits = sqliteTable('limits', {id:text().primaryKey(),hits:integer().notNull(),reset:integer().notNull()});
export const versions = sqliteTable('versions', {id:text().primaryKey(),classId:text().notNull(),version:integer().notNull(),snapshot:text().notNull(),created:integer().notNull()});
export const revisions = sqliteTable('revisions',{id:text().primaryKey(),classId:text().notNull(),entity:text().notNull(),itemId:text().notNull(),snapshot:text().notNull(),created:integer().notNull()});
