import { defineConfig } from 'vitest/config';

export default defineConfig({
	test: {
		name: 'core',
		include: ['./tests/**/index.ts']
	}
});
