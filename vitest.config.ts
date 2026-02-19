import { defineConfig } from 'vitest/config';

export default defineConfig({
	test: {
		projects: [
			'packages/migrate',
			'packages/sv/src/cli/vitest.config.ts',
			'packages/sv/src/core/vitest.config.ts',
			'packages/sv/src/addons/vitest.config.ts',
			'packages/sv/src/create/vitest.config.ts',
			'packages/sv-utils/src/vitest.config.ts'
		]
	}
});
