import { defineConfig } from 'vitest/config';

export default defineConfig({
	test: {
		projects: [
			'packages/migrate',
			'packages/sv/lib/cli/vitest.config.js',
			'packages/sv/lib/addons/vitest.config.js',
			'packages/sv/lib/create/vitest.config.js',
			'packages/sv/lib/core/vitest.config.js'
		]
	}
});
