import { env } from 'node:process';
import { defineProject } from 'vitest/config';

export default defineProject({
	test: {
		name: 'migrate',
		include: ['**/*.spec.ts'],
		retry: env.CI ? 3 : 0,
		expect: {
			requireAssertions: true
		}
	}
});
