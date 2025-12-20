import { fileURLToPath } from 'node:url';
import { setupGlobal } from 'sv/testing';
import process from 'node:process';
import { exec } from 'tinyexec';

const TEST_DIR = fileURLToPath(new URL('../../../../.test-output/addons/', import.meta.url));
const CI = Boolean(process.env.CI);

export default setupGlobal({
	TEST_DIR,
	pre: async () => {
		if (CI) {
			// prefetch the storybook cli during ci to reduce fetching errors in tests
			const { stdout } = await exec('pnpm', ['dlx', `create-storybook@latest`, '--version']);
			console.info('storybook version:', stdout);
		}
	}
});
