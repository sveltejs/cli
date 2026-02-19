import { defineProject } from 'vitest/config';

export default defineProject({
	test: {
		name: 'core',
		include: ['./tests/*.ts', './tests/**/index.ts'],
		expect: {
			requireAssertions: true
		}
	}
});
