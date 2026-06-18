import { env } from 'node:process';
import { defineProject } from 'vitest/config';

const ONE_MINUTE = 1000 * 60;

export default defineProject({
	test: {
		name: 'create',
		include: ['tests/*.ts'],
		hookTimeout: ONE_MINUTE * 3,
		testTimeout: ONE_MINUTE * 3,
		retry: env.CI ? 3 : 0
	}
});
