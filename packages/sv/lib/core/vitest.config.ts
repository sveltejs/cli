import { defineProject } from 'vitest/config';

export default defineProject({
	test: {
		name: 'utils',
		include: ['./tests/*.ts'],
		expect: {
			requireAssertions: true
		}
	}
});
