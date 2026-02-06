import { defineProject } from 'vitest/config';

export default defineProject({
	test: {
		name: 'sv-utils',
		include: ['./tests/**/index.ts', './tests/*.ts'],
		expect: {
			requireAssertions: true
		}
	}
});
