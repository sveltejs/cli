import { defineProject } from 'vitest/config';

export default defineProject({
	test: {
		name: 'cli',
		include: ['./tests/**/index.ts', './tests/*.ts'],
		exclude: ['./tests/snapshots/**'],
		expect: {
			requireAssertions: true
		}
	}
});
