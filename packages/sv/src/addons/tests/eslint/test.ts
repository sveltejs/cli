import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'tinyexec';
import eslint from '../../eslint.ts';
import { setupTest } from '../_setup/suite.ts';

const { test, testCases } = setupTest(
	{ eslint },
	{ kinds: [{ type: 'default', options: { eslint: {} } }], browser: false }
);

test.concurrent.for(testCases)('eslint $variant', (testCase, { expect, ...ctx }) => {
	const cwd = ctx.cwd(testCase);

	if (testCase.variant.startsWith('kit')) {
		const configFile = testCase.variant.endsWith('ts') ? 'tsconfig.json' : 'jsconfig.json';
		const config = JSON.parse(fs.readFileSync(path.resolve(cwd, configFile), 'utf8'));
		expect(config.include, 'ESLint config must be type-checked for Kit 3').toContain(
			'eslint.config.js'
		);
	}

	const unlintedFile = 'let foo = "";\nif (Boolean(foo)) {\n//\n}';
	fs.writeFileSync(path.resolve(cwd, 'src/lib/foo.js'), unlintedFile, 'utf8');

	expect(
		execSync('pnpm', ['lint'], { nodeOptions: { cwd } }).exitCode,
		'lint should fail on unlinted file'
	).not.toBe(0);

	expect(
		execSync('pnpm', ['eslint', '--fix', '.'], { nodeOptions: { cwd } }).exitCode,
		'eslint --fix should succeed'
	).toBe(0);

	expect(
		execSync('pnpm', ['lint'], { nodeOptions: { cwd } }).exitCode,
		'lint should pass after fix'
	).toBe(0);
});
