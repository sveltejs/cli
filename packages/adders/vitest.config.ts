import { cpus } from 'node:os';
import { env } from 'node:process';
import { defineConfig } from 'vitest/config';

const ONE_MINUTE = 1000 * 60;

export default defineConfig({
	test: {
		include: ['_tests/**/test.{js,ts}'],
		exclude: ['_tests/{_setups,_fixtures}/**/*'],
		testTimeout: ONE_MINUTE * 2,
		hookTimeout: ONE_MINUTE * 3,
		maxConcurrency: cpus().length,
		pool: 'forks',
		globalSetup: ['_tests/_setup/global.ts'],
		retry: env.CI ? 3 : 0
	}
});
