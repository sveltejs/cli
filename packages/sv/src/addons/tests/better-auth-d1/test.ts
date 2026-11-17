import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect } from 'vitest';
import betterAuth from '../../better-auth.ts';
import drizzle from '../../drizzle.ts';
import { setupTest } from '../_setup/suite.ts';

const { test, testCases } = setupTest(
	{ drizzle, betterAuth },
	{
		kinds: [
			{
				type: 'd1',
				options: {
					drizzle: { database: 'd1' },
					'better-auth': { demo: ['password'] }
				}
			}
		],
		filter: (addonTestCase) => addonTestCase.variant.includes('kit'),
		browser: false
	}
);

const findFile = (cwd: string, names: string[]) =>
	names.map((name) => join(cwd, name)).find((file) => existsSync(file))!;

test.concurrent.for(testCases)('better-auth $kind.type $variant', (testCase, { ...ctx }) => {
	const cwd = ctx.cwd(testCase);

	const auth = readFileSync(
		findFile(cwd, ['src/lib/server/auth.ts', 'src/lib/server/auth.js']),
		'utf8'
	);
	expect(auth).toMatch(/import \{ env \} from ['"]cloudflare:workers['"]/);
	expect(auth).toContain('= env.DB');

	const hooks = readFileSync(findFile(cwd, ['src/hooks.server.ts', 'src/hooks.server.js']), 'utf8');
	expect(hooks).not.toContain('cloudflare:workers');
	expect(hooks).toContain('createAuth()');
	expect(hooks).not.toContain('event.platform');

	const wrangler = readFileSync(findFile(cwd, ['wrangler.jsonc', 'wrangler.json']), 'utf8');
	expect(wrangler).toMatch(/"d1_databases":\s*\[\s*\{\s*"binding":\s*"DB"/);
});
