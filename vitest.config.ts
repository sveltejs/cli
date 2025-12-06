import { defineConfig } from 'vitest/config';

export default defineConfig({
	test: {
		projects: [
			'packages/migrate',
			'packages/sv',
			'packages/sv/lib/addons/vitest.config.ts',
			'packages/sv/lib/create/vitest.config.ts',
			'packages/sv/lib/core/vitest.config.ts',
			'community-addon-template'
		]
	}
});
