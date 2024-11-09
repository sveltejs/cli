import { env } from 'node:process';
import { defineConfig } from 'vitest/config';

const ONE_MINUTE = 1000 * 60;

export default defineConfig({
	test: {
		name: 'adders',
		include: ['_tests/**/test.{js,ts}'],
		testTimeout: ONE_MINUTE * 3,
		hookTimeout: ONE_MINUTE * 3,
		maxConcurrency: 10,
		globalSetup: ['_tests/_setup/global.ts'],
		retry: env.CI ? 3 : 0
	}
});
