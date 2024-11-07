import { cpus } from 'node:os';
import { defineConfig } from 'vitest/config';

const ONE_MINUTE = 1000 * 60;

export default defineConfig({
	test: {
		include: ['tests/**/*.test.{js,ts}'],
		exclude: ['tests/setup/*'],
		testTimeout: ONE_MINUTE * 2,
		hookTimeout: ONE_MINUTE * 3,
		maxConcurrency: cpus().length,
		pool: 'forks',
		globalSetup: ['tests/setup/global.ts']
	}
});
