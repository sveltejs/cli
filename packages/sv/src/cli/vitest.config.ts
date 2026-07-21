import { env } from 'node:process';
import { defineProject } from 'vitest/config';

export default defineProject({
	test: {
		name: 'cli',
		include: ['./tests/**/index.ts', './tests/*.ts'],
		exclude: ['./tests/snapshots/**'],
		retry: env.CI ? 3 : 0,
		expect: {
			requireAssertions: true
		}
	}
});
