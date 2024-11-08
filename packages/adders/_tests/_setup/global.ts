import path from 'node:path';
import { setup, type ProjectVariant } from 'sv/test';
import type { GlobalSetupContext } from 'vitest/node';

const TEST_DIR = path.resolve('.test-output');
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
