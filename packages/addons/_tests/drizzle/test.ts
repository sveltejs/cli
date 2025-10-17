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
const MUST_HAVE_DOCKER = process.env.CI && process.platform === 'linux';
let dockerInstalled = false;

const { test, testCases, prepareServer } = setupTest(
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
		filter: (testCase) => testCase.variant.includes('kit')
	}
);

beforeAll(() => {
	const cwd = path.dirname(fileURLToPath(import.meta.url));

	try {
		execSync('docker --version', { cwd, stdio: 'pipe' });
		dockerInstalled = true;
	} catch {
		dockerInstalled = false;
	}

	if (dockerInstalled && MUST_HAVE_DOCKER) {
		execSync('docker compose up --detach', { cwd, stdio: 'pipe' });
	}

	// cleans up the containers on interrupts (ctrl+c)
	process.addListener('SIGINT', () => {
		if (dockerInstalled && MUST_HAVE_DOCKER) {
			execSync('docker compose down --volumes', { cwd, stdio: 'pipe' });
		}
	});

	return () => {
		if (dockerInstalled && MUST_HAVE_DOCKER) {
			execSync('docker compose down --volumes', { cwd, stdio: 'pipe' });
		}
	};
});

test.concurrent.for(testCases)(
	'drizzle $kind.type $variant',
	async (testCase, { page, ...ctx }) => {
		const cwd = ctx.cwd(testCase);

		const ts = testCase.variant.endsWith('ts');
		const drizzleConfig = path.resolve(cwd, `drizzle.config.${ts ? 'ts' : 'js'}`);
		const content = fs.readFileSync(drizzleConfig, 'utf8');

		// Check that we have a drizzle config
		expect(content.length).toBeGreaterThan(0);

		// If the environment must have docker, Check that we have docker installed
		if (MUST_HAVE_DOCKER) expect(dockerInstalled).toBe(true);

		// If the database requires docker, Check that we have the config file
		if (testCase.kind.options.drizzle.docker) {
			const dockerCompose = path.resolve(cwd, 'docker-compose.yml');
			expect(fs.existsSync(dockerCompose)).toBe(true);
		}

		const db_can_be_tested =
			!testCase.kind.options.drizzle.docker ||
			(testCase.kind.options.drizzle.docker && dockerInstalled);

		if (db_can_be_tested) {
			fs.writeFileSync(drizzleConfig, content.replace(/strict: true[,\s]/, ''), 'utf8');

			const routes = path.resolve(cwd, 'src', 'routes');
			const pagePath = path.resolve(routes, '+page.svelte');
			fs.writeFileSync(pagePath, pageComp, 'utf8');

			const pageServerPath = path.resolve(routes, `+page.server.${ts ? 'ts' : 'js'}`);
			fs.writeFileSync(pageServerPath, pageServer, 'utf8');

			execSync('npm run db:push', { cwd, stdio: 'pipe' });

			const { close } = await prepareServer({ cwd, page });
			// kill server process when we're done
			ctx.onTestFinished(async () => await close());

			expect(page.locator('[data-testid]')).toBeTruthy();
		}
	}
);
