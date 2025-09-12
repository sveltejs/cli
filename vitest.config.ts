import process from 'node:process';
import { defineConfig } from 'vitest/config';

export default defineConfig({
	test: {
		projects: ['packages/*', 'community-addon-template'],
		fileParallelism: !process.env.CI
	}
});
