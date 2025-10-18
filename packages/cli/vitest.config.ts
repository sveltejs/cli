import { defineProject } from 'vitest/config';

export default defineProject({
	test: {
		name: 'cli',
		include: ['./tests/**/*.ts'],
		expect: {
			requireAssertions: true
		}
	}
});
