import { defineConfig } from 'vitest/config';

export default defineConfig({
	test: { dir: './test', include: ['./*/*.ts'] }
});
