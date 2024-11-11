import { env } from 'node:process';
import { defineConfig } from 'vitest/config';

export default defineConfig({
	test: {
		name: 'create',
		include: ['test/*.ts'],
		retry: env.CI ? 3 : 0
	}
});
