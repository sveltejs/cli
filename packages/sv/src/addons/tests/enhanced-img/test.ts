import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import enhancedImg from '../../enhanced-img.ts';
import { setupTest } from '../_setup/suite.ts';

const { test, testCases } = setupTest(
	{ enhancedImg },
	{ kinds: [{ type: 'default', options: { 'enhanced-img': {} } }], browser: false }
);

test.concurrent.for(testCases)('enhanced-img $variant', (testCase, { expect, ...ctx }) => {
	const cwd = ctx.cwd(testCase);

	const config = join(cwd, `vite.config.${testCase.variant.endsWith('-ts') ? 'ts' : 'js'}`);
	const source = readFileSync(config, 'utf8');

	expect(source).toMatch(`from '@sveltejs/enhanced-img'`);
	expect(source).toMatch('enhancedImages()');

	const pkg = JSON.parse(readFileSync(join(cwd, 'package.json'), 'utf8'));
	expect(pkg.devDependencies).toHaveProperty('@sveltejs/enhanced-img');

	const yaml = readFileSync(join(cwd, 'pnpm-workspace.yaml'), 'utf8');
	expect(yaml).toMatch('sharp');
});
