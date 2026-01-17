import { defineProject } from 'vitest/config';

export default defineProject({
	test: {
		name: 'core',
		include: ['./tests/**/index.js', './tests/*.js'],
		expect: {
			requireAssertions: true
		}
	}
});
