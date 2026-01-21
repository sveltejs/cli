import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { setupTest } from '../_setup/suite.ts';
import eslint from '../../eslint.ts';

const { test, testCases } = setupTest(
	{ eslint },
	{ kinds: [{ type: 'default', options: { eslint: {} } }], browser: false }
);

test.concurrent.for(testCases)('eslint $variant', (testCase, { expect, ...ctx }) => {
	const cwd = ctx.cwd(testCase);

	const unlintedFile = 'let foo = "";\nif (Boolean(foo)) {\n//\n}';
	fs.writeFileSync(path.resolve(cwd, 'src/lib/foo.js'), unlintedFile, 'utf8');

	expect(() => execSync('pnpm lint', { cwd, stdio: 'pipe' })).toThrow();

	expect(() => execSync('pnpm eslint --fix .', { cwd, stdio: 'pipe' })).not.toThrow();

	expect(() => execSync('pnpm lint', { cwd, stdio: 'pipe' })).not.toThrow();
});
