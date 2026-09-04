import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import enhancedImg from '../../enhanced-img.ts';
import { setupTest } from '../_setup/suite.ts';

const { test, testCases } = setupTest(
	{ enhancedImg },
	{ kinds: [{ type: 'default', options: { 'enhanced-img': {} } }], browser: false }
);

test.concurrent.for(testCases)('enhanced-img $variant', (testCase, { expect, ...ctx }) => {
	const cwd = ctx.cwd(testCase);

	const config = ['vite.config.ts', 'vite.config.js']
		.map((name) => join(cwd, name))
		.find((file) => existsSync(file))!;
	const source = readFileSync(config, 'utf8');

	expect(source).toMatch(`from '@sveltejs/enhanced-img'`);
	expect(source).toMatch('enhancedImages()');

	const pkg = JSON.parse(readFileSync(join(cwd, 'package.json'), 'utf8'));
	expect(pkg.devDependencies).toHaveProperty('@sveltejs/enhanced-img');

	const workspacePath = join(cwd, 'pnpm-workspace.yaml');
	if (existsSync(workspacePath)) {
		const yaml = readFileSync(workspacePath, 'utf8');
		expect(yaml).toMatch('sharp');
	}
});
