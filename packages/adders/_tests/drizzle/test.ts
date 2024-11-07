import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as vi from 'vitest';
import { expect } from '@playwright/test';
import { exec } from 'tinyexec';
import { setupTest } from '../_setup/setup.ts';
import drizzle from '../../drizzle/index.ts';
import { pageServer, pageComp } from './fixtures.ts';

const { test, variants, prepareServer } = setupTest({ drizzle });

vi.beforeAll(async () => {
	const cwd = path.dirname(fileURLToPath(import.meta.url));
	await exec('docker', ['compose', 'up', '--detach'], {
		nodeOptions: { cwd, stdio: 'pipe' }
	});

	return async () => {
		await exec('docker', ['compose', 'down', '--volumes'], {
			nodeOptions: { cwd, stdio: 'pipe' }
		});
	};
});

const kitOnly = variants.filter((v) => v.includes('kit'));
const testCases = [
	{ name: 'better-sqlite3', options: { database: 'sqlite', sqlite: 'better-sqlite3' } },
	{ name: 'libsql', options: { database: 'sqlite', sqlite: 'libsql' } },
	{ name: 'mysql2', options: { database: 'mysql', mysql: 'mysql2', docker: true } },
	{
		name: 'postgres.js',
		options: { database: 'postgresql', postgresql: 'postgres.js', docker: true }
	}
].flatMap((opts) => kitOnly.map((variant) => ({ ...opts, variant })));

test.concurrent.for(testCases)(
	'queries database - $name - $variant',
	async ({ options, variant }, { page, ...ctx }) => {
		const cwd = await ctx.run(variant, { drizzle: options as any });

		const ts = variant === 'kit-ts';
		const drizzleConfig = path.resolve(cwd, `drizzle.config.${ts ? 'ts' : 'js'}`);
		const content = fs.readFileSync(drizzleConfig, 'utf8').replace('strict: true,', '');
		fs.writeFileSync(drizzleConfig, content, 'utf8');

		const routes = path.resolve(cwd, 'src', 'routes');
		const pagePath = path.resolve(routes, '+page.svelte');
		fs.writeFileSync(pagePath, pageComp, 'utf8');

		const pageServerPath = path.resolve(routes, `+page.server.${ts ? 'ts' : 'js'}`);
		fs.writeFileSync(pageServerPath, pageServer, 'utf8');

		const { close } = await prepareServer({ cwd, page }, async () => {
			await exec('npm', ['run', 'db:push'], { nodeOptions: { cwd, stdio: 'pipe' } });
		});
		// kill server process when we're done
		ctx.onTestFinished(() => close());

		expect(await page.$('[data-testid]')).toBeTruthy();
	}
);
