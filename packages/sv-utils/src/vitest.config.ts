import { defineProject } from 'vitest/config';
import { a11yStubAlias } from './a11y-alias.ts';

export default defineProject({
	resolve: { alias: a11yStubAlias },
	test: {
		// svelte is external by default, so the alias would never reach its imports
		server: { deps: { inline: ['svelte'] } },
		name: 'sv-utils',
		include: ['./tests/**/index.ts', './tests/*.ts'],
		expect: {
			requireAssertions: true
		}
	}
});
