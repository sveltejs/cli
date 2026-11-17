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

test.concurrent.for(testCases)('better-auth $kind.type $variant', (testCase, { ...ctx }) => {
	const cwd = ctx.cwd(testCase);

	const hooks = ['src/hooks.server.ts', 'src/hooks.server.js']
		.map((name) => join(cwd, name))
		.find((file) => existsSync(file))!;
	const content = readFileSync(hooks, 'utf8');

	expect(content).toMatch(/import \{ env as cfEnv \} from ['"]cloudflare:workers['"]/);
	expect(content).toContain('createAuth(cfEnv.DB)');
	expect(content).not.toContain('event.platform');
});
