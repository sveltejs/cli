import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import { beforeAll } from 'vitest';
import { expect } from '@playwright/test';
import { setupTest } from '../_setup/suite.ts';
import drizzle from '../../drizzle/index.ts';
import { pageServer, pageComp } from './fixtures.ts';

// only linux is supported for running docker containers in github runners
const noDocker = process.env.CI && process.platform !== 'linux';

const { test, addonTestCases, prepareServer } = setupTest(
	{ drizzle },
	{
		kinds: [
			{
				type: 'better-sqlite3',
				options: { drizzle: { database: 'sqlite', sqlite: 'better-sqlite3' } }
			},
			{
				type: 'libsql',
				options: { drizzle: { database: 'sqlite', sqlite: 'libsql' } }
			},
			{
				type: 'mysql2',
				options: { drizzle: { database: 'mysql', mysql: 'mysql2', docker: true } }
			},
			{
				type: 'postgres.js',
				options: { drizzle: { database: 'postgresql', postgresql: 'postgres.js', docker: true } }
			}
		],
		filter: (addonTestCase) => addonTestCase.variant.includes('kit')
	}
);

beforeAll(() => {
	if (noDocker) return;
	const cwd = path.dirname(fileURLToPath(import.meta.url));
	execSync('docker compose up --detach', { cwd, stdio: 'pipe' });

	// cleans up the containers on interrupts (ctrl+c)
	process.addListener('SIGINT', () => {
		execSync('docker compose down --volumes', { cwd, stdio: 'pipe' });
	});

	return () => {
		execSync('docker compose down --volumes', { cwd, stdio: 'pipe' });
	};
});

test.concurrent.for(addonTestCases)(
	'drizzle $kind.type $variant',
	async (addonTestCase, { page, ...ctx }) => {
		if (addonTestCase.kind.options.drizzle.docker && noDocker) ctx.skip();
		const cwd = ctx.run(addonTestCase);

		const ts = addonTestCase.variant === 'kit-ts';
		const drizzleConfig = path.resolve(cwd, `drizzle.config.${ts ? 'ts' : 'js'}`);
		const content = fs.readFileSync(drizzleConfig, 'utf8').replace(/strict: true[,\s]/, '');
		fs.writeFileSync(drizzleConfig, content, 'utf8');

		const routes = path.resolve(cwd, 'src', 'routes');
		const pagePath = path.resolve(routes, '+page.svelte');
		fs.writeFileSync(pagePath, pageComp, 'utf8');

		const pageServerPath = path.resolve(routes, `+page.server.${ts ? 'ts' : 'js'}`);
		fs.writeFileSync(pageServerPath, pageServer, 'utf8');

		const { close } = await prepareServer({
			cwd,
			page,
			beforeBuild: () => {
				execSync('npm run db:push', { cwd, stdio: 'pipe' });
			}
		});
		// kill server process when we're done
		ctx.onTestFinished(async () => await close());

		expect(page.locator('[data-testid]')).toBeTruthy();
	}
);
