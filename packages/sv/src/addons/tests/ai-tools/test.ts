import fs from 'node:fs';
import path from 'node:path';
import { expect } from 'vitest';
import aiTools from '../../ai-tools.ts';
import { setupTest } from '../_setup/suite.ts';

const { test, testCases } = setupTest(
	{ 'ai-tools': aiTools },
	{
		kinds: [
			{
				type: 'default-local',
				options: {
					'ai-tools': {
						ide: ['claude-code', 'cursor', 'gemini', 'opencode', 'pi', 'vscode'],
						mcpSetup: 'local',
						delivery: 'tools',
						tools: ['mcp', 'svelte-code-writer', 'svelte-core-bestpractices', 'svelte-file-editor']
					}
				}
			},
			{
				type: 'default-remote',
				options: {
					'ai-tools': {
						ide: ['claude-code', 'cursor', 'gemini', 'opencode', 'pi', 'vscode'],
						mcpSetup: 'remote',
						delivery: 'tools',
						tools: ['mcp', 'svelte-code-writer', 'svelte-core-bestpractices', 'svelte-file-editor']
					}
				}
			},
			{
				type: 'other',
				options: {
					'ai-tools': {
						ide: ['other']
					}
				}
			},
			{
				type: 'no-agents-md',
				options: {
					'ai-tools': {
						ide: ['claude-code', 'gemini', 'other'],
						delivery: 'tools',
						tools: ['mcp'],
						mcpSetup: 'remote',
						agentsMd: false
					}
				}
			},
			{
				type: 'plugin',
				options: {
					'ai-tools': {
						ide: ['claude-code', 'opencode', 'pi'],
						delivery: 'plugin'
					}
				}
			},
			{
				type: 'plugin-opt-in-skills',
				options: {
					'ai-tools': {
						ide: ['claude-code', 'opencode', 'pi', 'cursor'],
						delivery: 'plugin',
						tools: ['mcp'],
						optInSkills: ['svelte-mcp-feedback']
					}
				}
			},
			{
				type: 'opt-in-skills-shared',
				options: {
					'ai-tools': {
						// cursor first on purpose: Claude Code's folder must still be written first
						ide: ['cursor', 'claude-code', 'gemini'],
						delivery: 'tools',
						tools: [],
						optInSkills: ['svelte-mcp-feedback']
					}
				}
			},
			{
				type: 'opt-in-skills-agents',
				options: {
					'ai-tools': {
						ide: ['claude-code', 'pi', 'gemini'],
						delivery: 'plugin',
						tools: [],
						optInSkills: ['svelte-mcp-feedback']
					}
				}
			}
		],
		browser: false,
		// test only one as it's not depending on project variants
		filter: (addonTestCase) => addonTestCase.variant === 'kit-ts',
		preAdd: ({ cwd, addonTestCase }) => {
			// opt-in skill already in the project, in a folder only some clients load
			const preinstalled: Record<string, string> = {
				'plugin-opt-in-skills': '.claude/skills',
				'opt-in-skills-agents': '.agents/skills'
			};
			const dir = preinstalled[addonTestCase.kind.type];
			if (dir) {
				fs.mkdirSync(path.resolve(cwd, dir, 'svelte-mcp-feedback'), { recursive: true });
				fs.writeFileSync(path.resolve(cwd, dir, 'svelte-mcp-feedback/SKILL.md'), 'user copy');
			}

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

test.concurrent.for(testCases)('ai-tools $kind.type $variant', (testCase, ctx) => {
	const cwd = ctx.cwd(testCase);

	const getContent = (filePath: string) => {
		const fullPath = path.resolve(cwd, filePath);
		return fs.readFileSync(fullPath, 'utf8');
	};

	if (testCase.kind.type === 'other') {
		// only AGENTS.md is written, everything else is handled via the docs link
		expect(fs.existsSync(path.resolve(cwd, 'AGENTS.md'))).toBe(true);
		expect(fs.existsSync(path.resolve(cwd, '.mcp.json'))).toBe(false);
		expect(fs.existsSync(path.resolve(cwd, '.claude'))).toBe(false);
		return;
	}

	if (testCase.kind.type === 'no-agents-md') {
		// declined: no agent file nor the pointer to it
		expect(fs.existsSync(path.resolve(cwd, 'AGENTS.md'))).toBe(false);
		expect(fs.existsSync(path.resolve(cwd, 'GEMINI.md'))).toBe(false);
		expect(fs.existsSync(path.resolve(cwd, '.claude/CLAUDE.md'))).toBe(false);
		// the rest is still configured
		expect(fs.existsSync(path.resolve(cwd, '.mcp.json'))).toBe(true);
		expect(fs.existsSync(path.resolve(cwd, '.gemini/settings.json'))).toBe(true);
		return;
	}

	if (testCase.kind.type === 'plugin') {
		// Claude Code: the plugin is enabled via a committed `.claude/settings.json`
		const settings = JSON.parse(getContent('.claude/settings.json'));
		expect(settings.enabledPlugins).toEqual({ 'svelte@svelte': true });
		expect(settings.extraKnownMarketplaces.svelte.source).toEqual({
			source: 'github',
			repo: 'sveltejs/ai-tools'
		});
		// the plugin bundles everything, so no individual files are written for Claude
		expect(fs.existsSync(path.resolve(cwd, '.mcp.json'))).toBe(false);
		expect(fs.existsSync(path.resolve(cwd, '.claude/skills'))).toBe(false);
		expect(fs.existsSync(path.resolve(cwd, '.claude/agents'))).toBe(false);
		// opencode stays configured through its own plugin
		expect(JSON.parse(getContent('.opencode/opencode.json')).plugin).toEqual([
			'@sveltejs/opencode'
		]);
		expect(fs.existsSync(path.resolve(cwd, '.opencode/skills'))).toBe(false);
		// pi stays configured through its own package
		expect(JSON.parse(getContent('.pi/settings.json')).packages).toEqual(['npm:@sveltejs/pi']);
		// the plugins replace the agent file as well
		expect(fs.existsSync(path.resolve(cwd, 'AGENTS.md'))).toBe(false);
		expect(fs.existsSync(path.resolve(cwd, '.claude/CLAUDE.md'))).toBe(false);
		return;
	}

	if (testCase.kind.type === 'plugin-opt-in-skills') {
		// opt-in skills aren't bundled with the plugins, so the clients that can't see
		// `.claude/skills` (OpenCode 2, Pi) get their own copy
		for (const dir of ['.opencode/skills', '.pi/skills']) {
			expect(fs.readdirSync(path.resolve(cwd, dir))).toEqual(['svelte-mcp-feedback']);
			expect(getContent(`${dir}/svelte-mcp-feedback/SKILL.md`)).toContain(
				'name: svelte-mcp-feedback'
			);
		}
		// Claude Code already had it: left untouched
		expect(fs.readdirSync(path.resolve(cwd, '.claude/skills'))).toEqual(['svelte-mcp-feedback']);
		expect(getContent('.claude/skills/svelte-mcp-feedback/SKILL.md')).toBe('user copy');
		// Cursor also loads `.claude/skills`: no second copy
		expect(fs.existsSync(path.resolve(cwd, '.cursor/skills'))).toBe(false);
		// still nothing else for the plugin clients
		expect(fs.existsSync(path.resolve(cwd, '.mcp.json'))).toBe(false);
		expect(fs.existsSync(path.resolve(cwd, '.claude/agents'))).toBe(false);
		expect(fs.existsSync(path.resolve(cwd, '.opencode/agents'))).toBe(false);
		expect(fs.existsSync(path.resolve(cwd, '.pi/agents'))).toBe(false);
		// cursor still gets the individual tools it picked
		expect(fs.existsSync(path.resolve(cwd, '.cursor/mcp.json'))).toBe(true);
		expect(fs.existsSync(path.resolve(cwd, '.cursor/agents'))).toBe(false);
		return;
	}

	if (testCase.kind.type === 'opt-in-skills-shared') {
		// written once in `.claude/skills`, which Cursor also loads
		expect(getContent('.claude/skills/svelte-mcp-feedback/SKILL.md')).toContain(
			'name: svelte-mcp-feedback'
		);
		expect(fs.existsSync(path.resolve(cwd, '.cursor/skills'))).toBe(false);
		// Gemini doesn't load `.claude/skills`, so it gets its own copy
		expect(getContent('.gemini/skills/svelte-mcp-feedback/SKILL.md')).toContain(
			'name: svelte-mcp-feedback'
		);
		return;
	}

	if (testCase.kind.type === 'opt-in-skills-agents') {
		// the copy in `.agents/skills` is left untouched
		expect(getContent('.agents/skills/svelte-mcp-feedback/SKILL.md')).toBe('user copy');
		// Pi and Gemini load `.agents/skills`: no second copy
		expect(fs.existsSync(path.resolve(cwd, '.pi/skills'))).toBe(false);
		expect(fs.existsSync(path.resolve(cwd, '.gemini/skills'))).toBe(false);
		// Claude Code doesn't, so it gets its own
		expect(getContent('.claude/skills/svelte-mcp-feedback/SKILL.md')).toContain(
			'name: svelte-mcp-feedback'
		);
		return;
	}

	const cursorMcpContent = getContent(`.cursor/mcp.json`);

	// should keep other MCPs
	expect(cursorMcpContent).toContain(`anotherMCP`);
	// should remove old svelte config
	expect(cursorMcpContent).not.toContain(`thing`);

	// should create .opencode/svelte.json with schema
	const sveltePluginConfig = JSON.parse(getContent('.opencode/svelte.json'));
	expect(sveltePluginConfig).toEqual({
		$schema: 'https://svelte.dev/opencode/schema.json'
	});

	// should create .pi/svelte.json with schema
	expect(JSON.parse(getContent('.pi/svelte.json'))).toEqual({
		$schema: 'https://svelte.dev/pi/schema.json'
	});

	const fullConf: Record<string, any> = {};
	const ides = {
		'claude-code': '.mcp.json',
		cursor: '.cursor/mcp.json',
		gemini: '.gemini/settings.json',
		opencode: '.opencode/opencode.json',
		pi: '.pi/settings.json',
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
			    "filePath": ".opencode/opencode.json",
			  },
			  "pi": {
			    "content": {
			      "$schema": "https://pi.dev/schemas/settings.schema.json",
			      "packages": [
			        "npm:@sveltejs/pi",
			      ],
			    },
			    "filePath": ".pi/settings.json",
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
			    "filePath": ".opencode/opencode.json",
			  },
			  "pi": {
			    "content": {
			      "$schema": "https://pi.dev/schemas/settings.schema.json",
			      "packages": [
			        "npm:@sveltejs/pi",
			      ],
			    },
			    "filePath": ".pi/settings.json",
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

	// CLAUDE.md is a pointer to the shared AGENTS.md
	expect(getContent('.claude/CLAUDE.md')).toBe('@../AGENTS.md\n');
	expect(fs.existsSync(path.resolve(cwd, 'AGENTS.md'))).toBe(true);

	// skills should be installed for all clients except opencode and pi (plugin handles it)
	const skillDirs = ['.claude/skills', '.cursor/skills', '.gemini/skills', '.github/skills'];
	for (const dir of skillDirs) {
		expect(fs.existsSync(path.resolve(cwd, dir, 'svelte-code-writer/SKILL.md'))).toBe(true);
		expect(fs.existsSync(path.resolve(cwd, dir, 'svelte-core-bestpractices/SKILL.md'))).toBe(true);
		// opt-in only
		expect(fs.existsSync(path.resolve(cwd, dir, 'svelte-mcp-feedback'))).toBe(false);
	}

	// opencode adn pi should NOT have skills (plugin handles it)
	expect(fs.existsSync(path.resolve(cwd, '.opencode/skills'))).toBe(false);
	expect(fs.existsSync(path.resolve(cwd, '.pi/skills'))).toBe(false);

	// sub-agents should be installed for all clients except opencode and pi
	expect(fs.existsSync(path.resolve(cwd, '.claude/agents/svelte-file-editor.md'))).toBe(true);
	expect(fs.existsSync(path.resolve(cwd, '.cursor/agents/svelte-file-editor.md'))).toBe(true);
	expect(fs.existsSync(path.resolve(cwd, '.gemini/agents/svelte-file-editor.md'))).toBe(true);
	expect(fs.existsSync(path.resolve(cwd, '.github/agents/svelte-file-editor.agent.md'))).toBe(true);
	expect(fs.existsSync(path.resolve(cwd, '.opencode/agents'))).toBe(false);
	expect(fs.existsSync(path.resolve(cwd, '.pi/agents'))).toBe(false);
});
