import { execSync } from 'node:child_process';
import { setupTest } from '../_setup/suite.ts';
import vitest from '../../vitest-addon/index.ts';

const { test, flavors } = setupTest(
	{ vitest },
	{ kinds: [{ type: 'default', options: { vitest: {} } }], browser: false }
);

test.concurrent.for(flavors)('vitest $variant', (flavor, { expect, ...ctx }) => {
	const cwd = ctx.run(flavor);

	expect(() => execSync('pnpm install', { cwd, stdio: 'pipe' })).not.toThrow();

	expect(() => execSync('pnpm exec playwright install chromium', { cwd })).not.toThrow();

	expect(() => execSync('pnpm test', { cwd, stdio: 'pipe' })).not.toThrow();
});
