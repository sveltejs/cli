import fs from 'node:fs';
import path from 'node:path';
import { execAsync, setupTest } from '../_setup/suite.ts';
import eslint from '../../eslint/index.ts';

const { test, variants } = setupTest({ eslint }, { browser: false });

test.for(variants)('core - %s', async (variant, { expect, ...ctx }) => {
	const cwd = await ctx.run(variant, { eslint: {} });

	const unlintedFile = 'let foo = "";\nif (Boolean(foo)) {\n//\n}';
	fs.writeFileSync(path.resolve(cwd, 'src/lib/foo.js'), unlintedFile, 'utf8');

	await expect(execAsync('pnpm install', { cwd })).resolves.toBeTruthy();

	await expect(execAsync('pnpm lint', { cwd })).rejects.toThrow();

	await expect(execAsync('pnpm eslint --fix .', { cwd })).resolves.toBeTruthy();

	await expect(execAsync('pnpm lint', { cwd })).resolves.toBeTruthy();
});
