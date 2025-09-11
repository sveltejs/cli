import fs from 'node:fs';
import path from 'node:path';
import { execAsync, setupTest } from '../_setup/suite.ts';
import prettier from '../../prettier/index.ts';

const { test, variants } = setupTest({ prettier }, { browser: false });

test.concurrent.for(variants)('core - %s', async (variant, { expect, ...ctx }) => {
	const cwd = await ctx.run(variant, { prettier: {} });

	const unformattedFile = 'const foo = "bar"';
	fs.writeFileSync(path.resolve(cwd, 'src/lib/foo.js'), unformattedFile, 'utf8');

	await expect(execAsync('pnpm install', { cwd })).resolves.toBeTruthy();

	await expect(execAsync('pnpm lint', { cwd })).rejects.toThrow();

	await expect(execAsync('pnpm format', { cwd })).resolves.toBeTruthy();

	await expect(execAsync('pnpm lint', { cwd })).resolves.toBeTruthy();
});
