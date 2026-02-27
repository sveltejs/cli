import fs from 'node:fs';
import path from 'node:path';
import { expect } from 'vitest';
import mcp from '../../mcp.ts';
import { setupTest } from '../_setup/suite.ts';

const { test, testCases } = setupTest(
	{ mcp },
	{
		kinds: [
			{
				type: 'default-local',
				options: {
					mcp: { ide: ['claude-code', 'cursor', 'gemini', 'opencode', 'vscode'], setup: 'local' }
				}
			},
			{
				type: 'default-remote',
				options: {
					mcp: { ide: ['claude-code', 'cursor', 'gemini', 'opencode', 'vscode'], setup: 'remote' }
				}
			}
		],
		browser: false,
		// test only one as it's not depending on project variants
		filter: (addonTestCase) => addonTestCase.variant === 'kit-ts',
		preAdd: ({ cwd }) => {
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

test.concurrent.for(testCases)('mcp $kind.type $variant', (testCase, ctx) => {
	const cwd = ctx.cwd(testCase);

	const getContent = (filePath: string) => {
		const cursorPath = path.resolve(cwd, filePath);
		return fs.readFileSync(cursorPath, 'utf8');
	};

	const cursorMcpContent = getContent(`.cursor/mcp.json`);

	// should keep other MCPs
	expect(cursorMcpContent).toContain(`anotherMCP`);
	// should remove old svelte config
	expect(cursorMcpContent).not.toContain(`thing`);

	const fullConf: Record<string, any> = {};
	const ides = {
		'claude-code': '.mcp.json',
		cursor: '.cursor/mcp.json',
		gemini: '.gemini/settings.json',
		opencode: 'opencode.json',
		vscode: '.vscode/mcp.json'
	} as const;

	for (const [ide, filePath] of Object.entries(ides)) {
		fullConf[ide] = {
			filePath,
			content: JSON.parse(getContent(filePath))
		};
	}

	if (testCase.kind.type === 'default-local') {
		expect(fullConf).toMatchInlineSnapshot(`
			{
			  "claude-code": {
			    "content": {
			      "mcpServers": {
			        "svelte": {
			          "args": [
			            "-y",
			            "@sveltejs/mcp",
			          ],
			          "command": "npx",
			          "env": {},
			          "type": "stdio",
			        },
			      },
			    },
			    "filePath": ".mcp.json",
			  },
			  "cursor": {
			    "content": {
			      "mcpServers": {
			        "anotherMCP": {},
			        "svelte": {
			          "args": [
			            "-y",
			            "@sveltejs/mcp",
			          ],
			          "command": "npx",
			        },
			      },
			    },
			    "filePath": ".cursor/mcp.json",
			  },
			  "gemini": {
			    "content": {
			      "$schema": "https://raw.githubusercontent.com/google-gemini/gemini-cli/main/schemas/settings.schema.json",
			      "mcpServers": {
			        "svelte": {
			          "args": [
			            "-y",
			            "@sveltejs/mcp",
			          ],
			          "command": "npx",
			        },
			      },
			    },
			    "filePath": ".gemini/settings.json",
			  },
			  "opencode": {
			    "content": {
			      "$schema": "https://opencode.ai/config.json",
			      "plugin": [
			        "@sveltejs/opencode",
			      ],
			    },
			    "filePath": "opencode.json",
			  },
			  "vscode": {
			    "content": {
			      "servers": {
			        "svelte": {
			          "args": [
			            "-y",
			            "@sveltejs/mcp",
			          ],
			          "command": "npx",
			        },
			      },
			    },
			    "filePath": ".vscode/mcp.json",
			  },
			}
		`);
	} else if (testCase.kind.type === 'default-remote') {
		expect(fullConf).toMatchInlineSnapshot(`
			{
			  "claude-code": {
			    "content": {
			      "mcpServers": {
			        "svelte": {
			          "type": "http",
			          "url": "https://mcp.svelte.dev/mcp",
			        },
			      },
			    },
			    "filePath": ".mcp.json",
			  },
			  "cursor": {
			    "content": {
			      "mcpServers": {
			        "anotherMCP": {},
			        "svelte": {
			          "url": "https://mcp.svelte.dev/mcp",
			        },
			      },
			    },
			    "filePath": ".cursor/mcp.json",
			  },
			  "gemini": {
			    "content": {
			      "$schema": "https://raw.githubusercontent.com/google-gemini/gemini-cli/main/schemas/settings.schema.json",
			      "mcpServers": {
			        "svelte": {
			          "url": "https://mcp.svelte.dev/mcp",
			        },
			      },
			    },
			    "filePath": ".gemini/settings.json",
			  },
			  "opencode": {
			    "content": {
			      "$schema": "https://opencode.ai/config.json",
			      "plugin": [
			        "@sveltejs/opencode",
			      ],
			    },
			    "filePath": "opencode.json",
			  },
			  "vscode": {
			    "content": {
			      "servers": {
			        "svelte": {
			          "url": "https://mcp.svelte.dev/mcp",
			        },
			      },
			    },
			    "filePath": ".vscode/mcp.json",
			  },
			}
		`);
	}
});
