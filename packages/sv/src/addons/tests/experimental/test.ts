import { parse } from '@sveltejs/sv-utils';
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
				// kit@next selected + every feature: the flags removed in kit 3 must be dropped
				type: 'kit3',
				options: {
					[addonId]: {
						versions: ['kit-3'],
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
				// kit@next not selected: no kit 3 rewrites, and the kit ^2 only flags survive
				type: 'kit3-not-selected',
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

	const tsconfigPath = ['tsconfig.json', 'jsconfig.json']
		.map((name) => join(cwd, name))
		.find((file) => existsSync(file));
	const tsconfig = tsconfigPath ? parse.json(readFileSync(tsconfigPath, 'utf8')).data : undefined;

	if (testCase.kind.type === 'kit3') {
		expect(JSON.parse(pkg).devDependencies['@sveltejs/kit']).toBe('next');
		if (tsconfig) {
			expect(tsconfig.extends).toBe('$app/tsconfig');
			expect(tsconfig.include).toStrictEqual(['src']);
			expect(tsconfig.compilerOptions).not.toHaveProperty('checkJs');
		}
		// the adapter must follow kit onto its `next` line (it peers on kit's major)
		expect(JSON.parse(pkg).devDependencies['@sveltejs/adapter-auto']).toBe('next');
		expect(source).toMatch('async: true');
		expect(source).toMatch('remoteFunctions: true');
		expect(source).toMatch('forkPreloads: true');
		// kit 3 no longer provides `$lib` on its own - sources move to `#lib` subpath imports
		expect(JSON.parse(pkg).imports).toMatchObject({ '#lib': expect.any(String) });
		const libIndex = ['src/lib/index.ts', 'src/lib/index.js']
			.map((name) => join(cwd, name))
			.find((file) => existsSync(file))!;
		expect(readFileSync(libIndex, 'utf8')).not.toMatch('$lib');
		expect(source).not.toMatch('alias');
		// removed from experimental in kit 3, so they must be skipped when kit@next is chosen
		expect(source).not.toMatch('explicitEnvironmentVariables');
		expect(source).not.toMatch('handleRenderingErrors');
	} else if (testCase.kind.type === 'kit3-not-selected') {
		expect(JSON.parse(pkg).devDependencies['@sveltejs/kit']).not.toBe('next');
		// the template's own `extends` keeps its `.json` suffix; the add-on would rewrite it to `$app/tsconfig`
		if (tsconfig) expect(tsconfig.extends).toBe('$app/tsconfig');
		expect(source).toMatch('async: true');
		expect(source).toMatch('remoteFunctions: true');
		expect(source).toMatch('explicitEnvironmentVariables: true');
		// not selected -> absent
		expect(source).not.toMatch('forkPreloads');
	}
});
