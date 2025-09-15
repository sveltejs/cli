import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { setupTest } from '../_setup/suite.ts';
import prettier from '../../prettier/index.ts';

const { test, variants } = setupTest({ prettier }, { browser: false });

test.concurrent.for(variants)('core - %s', async (variant, { expect, ...ctx }) => {
	const cwd = await ctx.run(variant, { prettier: {} });

	const unformattedFile = 'const foo = "bar"';
	fs.writeFileSync(path.resolve(cwd, 'src/lib/foo.js'), unformattedFile, 'utf8');

	expect(() => execSync('pnpm install', { cwd, stdio: 'pipe' })).not.toThrow();

	expect(() => execSync('pnpm lint', { cwd, stdio: 'pipe' })).toThrow();

	expect(() => execSync('pnpm format', { cwd, stdio: 'pipe' })).not.toThrow();

	expect(() => execSync('pnpm lint', { cwd, stdio: 'pipe' })).not.toThrow();
});
