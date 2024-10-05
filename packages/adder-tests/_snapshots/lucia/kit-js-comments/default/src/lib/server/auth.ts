import { dev } from "$app/environment";
import { DrizzleSQLiteAdapter } from "@lucia-auth/adapter-drizzle";
import { Lucia } from "lucia";
import { db } from "$lib/server/db";
import { user, session } from "$lib/server/db/schema.js";
const adapter = new DrizzleSQLiteAdapter(db, session, user);

export const lucia = new Lucia(adapter, {
	sessionCookie: {
		attributes: {
			secure: !dev
		}
	},
	
});

declare module 'lucia' {
	interface Register {
		Lucia: typeof lucia;
		// attributes that are already included are omitted
		DatabaseUserAttributes: Omit<typeof user.$inferSelect, 'id'>;
		DatabaseSessionAttributes: Omit<typeof session.$inferSelect, 'id' | 'userId' | 'expiresAt'>;
	}
}
