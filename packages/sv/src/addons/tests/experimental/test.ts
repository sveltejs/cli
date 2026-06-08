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
				// kit@next selected + every feature: explicitEnvironmentVariables must be dropped (gone in kit 3)
				type: 'next-all',
				options: {
					[addonId]: {
						versions: ['kit'],
						features: [
							'async',
							'remoteFunctions',
							'explicitEnvironmentVariables',
							'handleRenderingErrors',
							'forkPreloads'
						]
					}
				}
			},
			{
				// staying on kit 2: explicitEnvironmentVariables is kept, defaults leave forkPreloads off
				type: 'kit2-defaults',
				options: {
					[addonId]: {
						versions: [],
						features: ['async', 'remoteFunctions', 'explicitEnvironmentVariables']
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
	const pkg = readFileSync(join(cwd, 'package.json'), 'utf8');

	if (testCase.kind.type === 'next-all') {
		expect(JSON.parse(pkg).devDependencies['@sveltejs/kit']).toBe('next');
		// the adapter must follow kit onto its `next` line (it peers on kit's major)
		expect(JSON.parse(pkg).devDependencies['@sveltejs/adapter-auto']).toBe('next');
		expect(source).toMatch('async: true');
		expect(source).toMatch('remoteFunctions: true');
		expect(source).toMatch('handleRenderingErrors: true');
		expect(source).toMatch('forkPreloads: true');
		// removed from experimental in kit 3, so it must be skipped when kit@next is chosen
		expect(source).not.toMatch('explicitEnvironmentVariables');
	} else if (testCase.kind.type === 'kit2-defaults') {
		expect(JSON.parse(pkg).devDependencies['@sveltejs/kit']).not.toBe('next');
		expect(source).toMatch('async: true');
		expect(source).toMatch('remoteFunctions: true');
		expect(source).toMatch('explicitEnvironmentVariables: true');
		// not selected -> absent
		expect(source).not.toMatch('forkPreloads');
		expect(source).not.toMatch('handleRenderingErrors');
	}
});
