import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const user = sqliteTable('user', {
    id: text('id').primaryKey(),
    age: integer('age')
});

export const session = sqliteTable("session", {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull().references(() => user.id),
    expiresAt: integer('expires_at').notNull()
});
