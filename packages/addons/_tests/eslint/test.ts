import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { setupTest } from '../_setup/suite.ts';
import eslint from '../../eslint/index.ts';

const { test, variants } = setupTest({ eslint }, { browser: false });

test.sequential.for(variants)('core - %s', async (variant, { expect, ...ctx }) => {
	const cwd = await ctx.run(variant, { eslint: {} });

	const unlintedFile = 'let foo = "";\nif (Boolean(foo)) {\n//\n}';
	fs.writeFileSync(path.resolve(cwd, 'src/lib/foo.js'), unlintedFile, 'utf8');

	expect(() => execSync('pnpm install', { cwd, stdio: 'pipe' })).not.toThrow();

	expect(() => execSync('pnpm lint', { cwd, stdio: 'pipe' })).toThrow();

	expect(() => execSync('pnpm eslint --fix .', { cwd, stdio: 'pipe' })).not.toThrow();

	expect(() => execSync('pnpm lint', { cwd, stdio: 'pipe' })).not.toThrow();
});
