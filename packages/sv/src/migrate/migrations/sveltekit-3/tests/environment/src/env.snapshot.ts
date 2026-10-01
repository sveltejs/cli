import { defineEnvVars } from '@sveltejs/kit/env';

// @migration-task Review usage of dynamic environment variables. They fall back to the empty string if not present, which may not be what you want.
export const variables = defineEnvVars({
	ENV_PRIVATE_DYNAMIC_1: { schema: (input) => input ?? '' },
	ENV_PUBLIC_DYNAMIC_1: { public: true, schema: (input) => input ?? '' },
	ENV_PRIVATE_STATIC_IMPORT: { static: true },
	ENV_PUBLIC_DYNAMIC_IMPORT: { public: true, schema: (input) => input ?? '' },
	ENV_PUBLIC_STATIC_ORDERED: { public: true, static: true },
	ENV_PUBLIC_DYNAMIC_ORDERED: { public: true, schema: (input) => input ?? '' },
	ENV_PRIVATE_DYNAMIC_ORDERED: { schema: (input) => input ?? '' },
	ENV_PUBLIC_STATIC_MIXED: { public: true, static: true },
	ENV_PUBLIC_DYNAMIC_MIXED: { public: true, schema: (input) => input ?? '' },
	ENV_PRIVATE_STATIC_1: { static: true },
	ENV_PUBLIC_STATIC_1: { public: true, static: true },
	ENV_PRIVATE_DYNAMIC_2: { schema: (input) => input ?? '' },
	ENV_PUBLIC_DYNAMIC_2: { public: true, schema: (input) => input ?? '' },
	ENV_PRIVATE_STATIC_2: { static: true },
	ENV_PUBLIC_STATIC_2: { public: true, static: true }
});
