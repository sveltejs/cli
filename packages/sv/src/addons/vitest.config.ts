import { env, platform } from 'node:process';
import { defineProject } from 'vitest/config';

const ONE_MINUTE = 1000 * 60;
const isWindows = platform === 'win32';

export default defineProject({
	test: {
		name: 'addons',
		include: ['tests/**/test.{js,ts}'],
		globalSetup: ['tests/_setup/global.ts'],
		testTimeout: ONE_MINUTE * (isWindows ? 5 : 3),
		hookTimeout: ONE_MINUTE * (isWindows ? 5 : 3),
		retry: env.CI ? 3 : 0,
		expect: {
			requireAssertions: true
		}
	}
});
