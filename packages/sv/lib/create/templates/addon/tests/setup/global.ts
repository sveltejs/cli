import { fileURLToPath } from 'node:url';
import { type ProjectVariant, setup, variants } from 'sv/testing';
import type { TestProject } from 'vitest/node';

const TEST_DIR = fileURLToPath(new URL('.test-output/', import.meta.url));

export default async function ({ provide }: TestProject) {
	// global setup (e.g. spin up docker containers)

	// downloads different project configurations (sveltekit, js/ts, vite-only, etc)
	const { templatesDir } = await setup({ cwd: TEST_DIR, variants, clean: true });

	provide('testDir', TEST_DIR);
	provide('templatesDir', templatesDir);
	provide('variants', variants);

	return async () => {
		// tear down... (e.g. cleanup docker containers)
	};
}

declare module 'vitest' {
	export interface ProvidedContext {
		testDir: string;
		templatesDir: string;
		variants: ProjectVariant[];
	}
}
