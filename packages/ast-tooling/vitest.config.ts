import { defineProject } from 'vitest/config';

export default defineProject({
	test: {
		name: 'ast-tooling',
		include: ['./tests/*.ts']
	}
});
