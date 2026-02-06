import { defineConfig } from 'vitest/config';

export default defineConfig({
	test: {
		projects: [
			'packages/migrate',
			'packages/sv/lib/cli/vitest.config.ts',
			'packages/sv/lib/addons/vitest.config.ts',
			'packages/sv/lib/create/vitest.config.ts',
			'packages/sv-utils/src/vitest.config.ts'
		]
	}
});
