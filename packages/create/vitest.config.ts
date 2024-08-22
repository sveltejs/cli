import { defineConfig, type UserConfig } from 'vitest/config';

const config: UserConfig = defineConfig({
	test: { dir: './test', include: ['*.ts'] }
});

export default config;
