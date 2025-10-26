import { expect } from '@playwright/test';
import { setupTest } from '../_setup/suite.ts';
import mcp from '../../mcp/index.ts';
import fs from 'node:fs';
import path from 'node:path';

const { test, testCases } = setupTest(
	{ mcp },
	{
		kinds: [
			{
				type: 'default',
				options: {
					mcp: { ide: ['claude-code', 'cursor', 'gemini', 'opencode', 'vscode'], setup: 'local' }
				}
			}
		],
		browser: false,
		// test only one as it's not depending on project variants
		filter: (addonTestCase) => addonTestCase.variant === 'kit-ts',
		preInstallAddon: ({ cwd }) => {
			// prepare an existing file
			fs.mkdirSync(path.resolve(cwd, `.cursor`));
			fs.writeFileSync(
				path.resolve(cwd, `.cursor/mcp.json`),
				JSON.stringify(
					{
						mcpServers: {
							svelte: { some: 'thing' },
							anotherMCP: {}
						}
					},
					null,
					2
				),
				{ encoding: 'utf8' }
			);
		}
	}
);

test.concurrent.for(testCases)('mcp $variant', (testCase, ctx) => {
	const cwd = ctx.cwd(testCase);

	const cursorPath = path.resolve(cwd, `.cursor/mcp.json`);
	const cursorMcpContent = fs.readFileSync(cursorPath, 'utf8');

	// should keep other MCPs
	expect(cursorMcpContent).toContain(`anotherMCP`);
	// should have the svelte level
	expect(cursorMcpContent).toContain(`svelte`);
	// should have local conf
	expect(cursorMcpContent).toContain(`@sveltejs/mcp`);
	// should remove old svelte config
	expect(cursorMcpContent).not.toContain(`thing`);
});
