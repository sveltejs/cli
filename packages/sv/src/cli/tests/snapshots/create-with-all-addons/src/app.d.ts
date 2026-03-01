import type { User, Session } from 'better-auth/minimal';

interface // See https://svelte.dev/docs/kit/types#app.d.ts UserInfo extends User { id: string; name: string }

// for information about these interfaces
declare global {
	namespace App {
		interface Locals { user?: UserInfo; session?: Session }

		// interface Error {}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};
