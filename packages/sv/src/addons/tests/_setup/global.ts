import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { setupGlobal } from 'sv/testing';
import { exec } from 'tinyexec';
import { collectPrewarmSpecs } from './prewarm.ts';

const TEST_DIR = fileURLToPath(new URL('../../../../.test-output/addons/', import.meta.url));
const CI = Boolean(process.env.CI);

export default setupGlobal({
	TEST_DIR,
	pre: async () => {
		if (!CI) return;

		await Promise.all([
			// prefetch the storybook cli during ci to reduce fetching errors in tests
			exec('pnpm', ['dlx', `create-storybook@latest`, '--version']).then(({ stdout }) =>
				console.info('storybook version:', stdout)
			),
			// Warm the pnpm store with every dependency the add-on test projects install, so the
			// parallel test files only hard-link from the store instead of each downloading cold -
			// which is what saturates the CI runner. Specs are read from source, never hardcoded.
			(async () => {
				const specs = collectPrewarmSpecs();
				const start = Date.now();
				const { exitCode, stderr } = await exec('pnpm', ['store', 'add', ...specs], {
					throwOnError: false
				});
				// best effort: a miss just means some installs download cold, it must never fail the suite
				if (exitCode !== 0) {
					console.warn(`store prewarm skipped (pnpm store add exited ${exitCode})\n${stderr}`);
					return;
				}
				console.info(
					`prewarmed ${specs.length} deps into the pnpm store in ${Date.now() - start}ms`
				);
			})()
		]);
	}
});
