import { env } from 'node:process';
import { defineProject } from 'vitest/config';

export default defineProject({
	test: {
		name: 'create',
		include: ['tests/*.ts'],
		retry: env.CI ? 3 : 0
	}
});
