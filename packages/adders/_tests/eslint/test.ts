import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { expect } from '@playwright/test';
import { setupTest } from '../_setup/suite.ts';
import eslint from '../../eslint/index.ts';

const { test, variants, prepareServer } = setupTest({ eslint });

test.concurrent.for(variants)('core - %s', async (variant, { page, ...ctx }) => {
	const cwd = await ctx.run(variant, { eslint: {} });

	const { close } = await prepareServer({ cwd, page });
	// kill server process when we're done
	ctx.onTestFinished(async () => await close());

	const unlintedFile = 'let foo = "";\nif (Boolean(foo)) {\n//\n}';
	fs.writeFileSync(path.resolve(cwd, 'foo.js'), unlintedFile, 'utf8');

	expect(() => execSync('pnpm lint', { cwd, stdio: 'pipe' })).toThrowError();

	expect(() => execSync('pnpm eslint --fix .', { cwd, stdio: 'pipe' })).not.toThrowError();

	expect(() => execSync('pnpm lint', { cwd, stdio: 'pipe' })).not.toThrowError();
});
