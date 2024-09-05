import { defineConfig, type UserConfig } from 'vitest/config';

export default defineConfig({
	test: { dir: './test', include: ['./**/index.ts'] }
}) as UserConfig;
