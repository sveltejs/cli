import { defineConfig } from 'vitest/config';

export default defineConfig({
	test: {
		name: 'create',
		include: ['test/*.ts']
	}
});
