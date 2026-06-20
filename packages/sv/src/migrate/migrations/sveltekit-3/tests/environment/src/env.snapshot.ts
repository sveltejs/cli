import { defineEnvVars } from '@sveltejs/kit/hooks';
export const variables = defineEnvVars({
	ENV_PRIVATE_DYNAMIC_1: {},
	ENV_PUBLIC_DYNAMIC_1: { public: true },
	ENV_PUBLIC_STATIC_ORDERED: { public: true, static: true },
	ENV_PUBLIC_DYNAMIC_ORDERED: { public: true },
	ENV_PRIVATE_DYNAMIC_ORDERED: {},
	ENV_PUBLIC_STATIC_MIXED: { public: true, static: true },
	ENV_PUBLIC_DYNAMIC_MIXED: { public: true },
	ENV_PRIVATE_STATIC_1: { static: true },
	ENV_PUBLIC_STATIC_1: { public: true, static: true },
	ENV_PRIVATE_DYNAMIC_2: {},
	ENV_PUBLIC_DYNAMIC_2: { public: true },
	ENV_PRIVATE_STATIC_2: { static: true },
	ENV_PUBLIC_STATIC_2: { public: true, static: true }
});
