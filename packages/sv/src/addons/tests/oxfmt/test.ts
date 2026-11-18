import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'tinyexec';
import { oxfmtConfigPath } from '../../common.ts';
import oxfmt from '../../oxfmt.ts';
import { setupTest } from '../_setup/suite.ts';

const { test, testCases } = setupTest(
	{ oxfmt },
	{
		kinds: [
			{ type: 'default', options: { oxfmt: {} } },
			{ type: 'with-tailwindcss', options: { oxfmt: {} } }
		],
		browser: false,
		preAdd: ({ addonTestCase, cwd }) => {
			if (addonTestCase.kind.type !== 'with-tailwindcss') return;

			const packageJsonPath = path.resolve(cwd, 'package.json');
			const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
			packageJson.devDependencies ??= {};
			packageJson.devDependencies.tailwindcss = '^4.3.0';
			fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson), 'utf8');
		}
	}
);

test.concurrent.for(testCases)(
	'oxfmt $kind.type $variant',
	async (testCase, { expect, ...ctx }) => {
		const cwd = ctx.cwd(testCase);

		if (testCase.kind.type === 'default') {
			const unformattedFile = 'const foo = "bar"';
			const outputFilePath = 'src/lib/foo.js';
			fs.writeFileSync(path.resolve(cwd, outputFilePath), unformattedFile, 'utf8');

			// NOTE: we need to target the file as oxfmt uses .gitignore and .test-output is ignored
			// so without target it fails
			expect(
				execSync('pnpm', ['fmt:check', outputFilePath], {
					nodeOptions: { cwd }
				}).exitCode,
				'format check should fail on unformatted file'
			).toBe(1);

			expect(
				execSync('pnpm', ['fmt', outputFilePath], {
					nodeOptions: { cwd }
				}).exitCode,
				'format should succeed'
			).toBe(0);

			const { default: config } = await import(path.resolve(cwd, oxfmtConfigPath()));
			expect(config).toHaveProperty('svelte', true);
			expect(config).not.toHaveProperty('sortTailwindCSS');
		} else if (testCase.kind.type === 'with-tailwindcss') {
			const { default: config } = await import(path.resolve(cwd, oxfmtConfigPath()));
			expect(config).toHaveProperty('sortTailwindCSS', true);
		}
	}
);
