import { defineProject } from 'vitest/config';

export default defineProject({
	test: {
		name: 'cli',
		include: ['./tests/**/index.js', './tests/*.js'],
		exclude: ['./tests/snapshots/**'],
		expect: {
			requireAssertions: true
		}
	}
});
