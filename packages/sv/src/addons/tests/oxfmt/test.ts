import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'tinyexec';
import oxfmt from '../../oxfmt.ts';
import { setupTest } from '../_setup/suite.ts';

const { test, testCases } = setupTest(
	{ oxfmt },
	{
		kinds: [
			{ type: 'default', options: { oxfmt: {} } }
			// TODO: add tailwindcss
		],
		browser: false
	}
);

test.concurrent.for(testCases)('oxfmt $kind.type $variant', (testCase, { expect, ...ctx }) => {
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
	}
});
