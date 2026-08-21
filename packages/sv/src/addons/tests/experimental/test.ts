import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect } from 'vitest';
import experimental from '../../experimental.ts';
import { setupTest } from '../_setup/suite.ts';

const addonId = experimental.id;
const { test, testCases } = setupTest(
	{ [addonId]: experimental },
	{
		kinds: [
			{
				type: 'all-features',

				options: {
					[addonId]: {
						features: ['async', 'remoteFunctions', 'forkPreloads']
					}
				}
			},
			{
				type: 'selected-features',
				options: {
					[addonId]: {
						features: ['remoteFunctions']
					}
				}
			}
		],
		filter: (addonTestCase) => addonTestCase.variant.includes('kit'),
		browser: false
	}
);

test.concurrent.for(testCases)('experimental $kind.type $variant', (testCase, { ...ctx }) => {
	const cwd = ctx.cwd(testCase);

	const config = ['vite.config.ts', 'vite.config.js']
		.map((name) => join(cwd, name))
		.find((file) => existsSync(file))!;
	const source = readFileSync(config, 'utf8');

	if (testCase.kind.type === 'all-features') {
		expect(source).toMatch('async: true');
		expect(source).toMatch('remoteFunctions: true');
		expect(source).toMatch('forkPreloads: true');
	} else if (testCase.kind.type === 'selected-features') {
		expect(source).toMatch('remoteFunctions: true');
		expect(source).not.toMatch('async');
		expect(source).not.toMatch('forkPreloads');
	}
});
