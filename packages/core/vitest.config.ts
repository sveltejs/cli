import { defineConfig, type UserConfig } from 'vitest/config';

export default defineConfig({
	test: { dir: './tests', include: ['./**/index.ts'] }
}) as UserConfig;
