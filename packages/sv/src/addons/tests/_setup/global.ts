import path from 'node:path';
import process from 'node:process';
import * as find from 'empathic/find';
import { setupGlobal } from 'sv/testing';
import { exec } from 'tinyexec';

const ROOT = path.dirname(find.up('pnpm-workspace.yaml', { cwd: import.meta.dirname })!);
const TEST_DIR = path.resolve(ROOT, 'packages', 'sv', '.test-output', 'addons');

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
