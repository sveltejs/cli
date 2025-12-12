import { fileURLToPath } from 'node:url';
import { setup, variants } from 'sv/testing';

const TEST_DIR = fileURLToPath(new URL('.test-output/', import.meta.url));

export default async function ({ provide }) {
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
