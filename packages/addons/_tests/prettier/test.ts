import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { expect } from '@playwright/test';
import { setupTest } from '../_setup/suite.ts';
import prettier from '../../prettier/index.ts';

const { test, variants, prepareServer } = setupTest({ prettier });

test.concurrent.for(variants)('core - %s', async (variant, { page, ...ctx }) => {
	const cwd = await ctx.run(variant, { prettier: {} });

	const { close } = await prepareServer({ cwd, page });
	// kill server process when we're done
	ctx.onTestFinished(async () => await close());

	const unformattedFile = 'const foo = "bar"';
	fs.writeFileSync(path.resolve(cwd, 'foo.js'), unformattedFile, 'utf8');

	expect(() => execSync('pnpm lint', { cwd, stdio: 'pipe' })).toThrowError();

	expect(() => execSync('pnpm format', { cwd, stdio: 'pipe' })).not.toThrowError();

	expect(() => execSync('pnpm lint', { cwd, stdio: 'pipe' })).not.toThrowError();
});
