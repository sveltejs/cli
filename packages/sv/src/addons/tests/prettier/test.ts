import { log } from '@clack/prompts';
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { vi } from 'vitest';
import { ESLINT_VERSION } from '../../common.ts';
import prettier from '../../prettier.ts';
import { setupTest } from '../_setup/suite.ts';

const origLogWarn = log.warn;
vi.spyOn(log, 'warn').mockImplementation((msg, opts) => {
	// Suppress expected warnings about unsupported ESLint versions
	if (msg.includes('unsupported major version')) return;

	return origLogWarn(msg, opts);
});

const { test, testCases } = setupTest(
	{ prettier },
	{
		kinds: [
			{ type: 'default', options: { prettier: {} } },
			{ type: 'supported-eslint', options: { prettier: {} } },
			{ type: 'unsupported-eslint', options: { prettier: {} } }
		],
		browser: false,
		filter: (addonTestCase) =>
			// Make '*-eslint' kinds only run once, on the 'vite-js' variant
			!addonTestCase.kind.type.endsWith('-eslint') || addonTestCase.variant === 'vite-js',
		preAdd: ({ addonTestCase, cwd }) => {
			if (!addonTestCase.kind.type.endsWith('-eslint')) return;

			// Add (un)supported eslint version to devDependencies
			const packageJsonPath = path.resolve(cwd, 'package.json');
			const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
			packageJson.devDependencies ??= {};
			packageJson.devDependencies.eslint =
				addonTestCase.kind.type === 'supported-eslint' ? ESLINT_VERSION : '^8.0.0';
			fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson), 'utf8');
		}
	}
);

test.concurrent.for(testCases)('prettier $kind.type $variant', (testCase, { expect, ...ctx }) => {
	const cwd = ctx.cwd(testCase);

	if (testCase.kind.type === 'default') {
		const unformattedFile = 'const foo = "bar"';
		fs.writeFileSync(path.resolve(cwd, 'src/lib/foo.js'), unformattedFile, 'utf8');

		expect(() => execSync('pnpm lint', { cwd, stdio: 'pipe' })).toThrow();

		expect(() => execSync('pnpm format', { cwd, stdio: 'pipe' })).not.toThrow();

		expect(() => execSync('pnpm lint', { cwd, stdio: 'pipe' })).not.toThrow();
	} else if (testCase.kind.type === 'supported-eslint') {
		expect(fs.existsSync(path.resolve(cwd, 'eslint.config.js'))).toBe(true);

		const packageJson = JSON.parse(fs.readFileSync(path.resolve(cwd, 'package.json'), 'utf8'));
		expect(packageJson.devDependencies?.['eslint-config-prettier']).toBeDefined();
	} else if (testCase.kind.type === 'unsupported-eslint') {
		expect(fs.existsSync(path.resolve(cwd, 'eslint.config.js'))).toBe(false);

		const packageJson = JSON.parse(fs.readFileSync(path.resolve(cwd, 'package.json'), 'utf8'));
		expect(packageJson.devDependencies?.['eslint-config-prettier']).toBeUndefined();
	}
});
