import { fileURLToPath } from 'node:url';
import { setup, type ProjectVariant } from 'sv/testing';
import type { GlobalSetupContext } from 'vitest/node';

const TEST_DIR = fileURLToPath(new URL('../../../../.test-output/adders/', import.meta.url));
const variants: ProjectVariant[] = ['kit-js', 'kit-ts', 'vite-js', 'vite-ts'];

export default async function ({ provide }: GlobalSetupContext) {
	// downloads different project configurations (sveltekit, js/ts, vite-only, etc)
	const { templatesDir } = await setup({ cwd: TEST_DIR, variants });

	provide('testDir', TEST_DIR);
	provide('templatesDir', templatesDir);
	provide('variants', variants);
}

declare module 'vitest' {
	export interface ProvidedContext {
		testDir: string;
		templatesDir: string;
		variants: ProjectVariant[];
	}
}
