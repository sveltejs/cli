import { defineProject } from 'vitest/config';

export default defineProject({
	test: {
		name: 'cli',
		include: ['./tests/**/index.ts', './tests/*.ts'],
		expect: {
			requireAssertions: true
		}
	}
});
