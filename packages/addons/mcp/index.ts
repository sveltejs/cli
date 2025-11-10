import { colors, defineAddon, defineAddonOptions, log } from '@sveltejs/cli-core';

import { parseJson } from '@sveltejs/cli-core/parsers';
import agent from './AGENT.md?raw';

const options = defineAddonOptions()
	.add('ide', {
		question: 'Which client would you like to use?',
		type: 'multiselect',
		default: [],
		options: [
			{ value: 'claude-code', label: 'claude code' },
			{ value: 'cursor', label: 'Cursor' },
			{ value: 'gemini', label: 'Gemini' },
			{ value: 'opencode', label: 'opencode' },
			{ value: 'vscode', label: 'VSCode' },
			{ value: 'other', label: 'Other' }
		],
		required: true
	})
	.add('setup', {
		question: 'What setup you want to use?',
		type: 'select',
		default: 'remote',
		options: [
			{ value: 'local', label: 'Local', hint: 'will use stdio' },
			{ value: 'remote', label: 'Remote', hint: 'will use a remote endpoint' }
		],
		required: true
	})
	.build();

export default defineAddon({
	id: 'mcp',
	shortDescription: 'Svelte MCP',
	homepage: 'https://svelte.dev/docs/mcp',
	options,
	run: ({ sv, options }) => {
		const getLocalConfig = (o?: {
			type?: 'stdio' | 'local';
			env?: boolean;
			command?: string | string[];
			args?: string[] | null;
		}) => {
			const config: any = {
				...(o?.type ? { type: o.type } : {}),
				command: o?.command ?? 'npx',
				...(o?.env ? { env: {} } : {}),
				...(o?.args === null ? {} : { args: o?.args ?? ['-y', '@sveltejs/mcp'] })
			};
			return config;
		};
		const getRemoteConfig = (o?: { type?: 'http' | 'remote' }) => {
			return {
				...(o?.type ? { type: o.type } : {}),
				url: 'https://mcp.svelte.dev/mcp'
			};
		};

		const configurator: Record<
			(typeof options.ide)[number],
			| {
					schema?: string;
					mcpServersKey?: string;
					agentPath: string;
					filePath: string;
					typeLocal?: 'stdio' | 'local';
					typeRemote?: 'http' | 'remote';
					env?: boolean;
					command?: string | string[];
					args?: string[] | null;
			  }
			| { other: true }
		> = {
			'claude-code': {
				agentPath: 'CLAUDE.md',
				filePath: '.mcp.json',
				typeLocal: 'stdio',
				typeRemote: 'http',
				env: true
			},
			cursor: {
				agentPath: 'AGENTS.md',
				filePath: '.cursor/mcp.json'
			},
			gemini: {
				agentPath: 'GEMINI.md',
				schema:
					'https://raw.githubusercontent.com/google-gemini/gemini-cli/main/schemas/settings.schema.json',
				filePath: '.gemini/settings.json'
			},
			opencode: {
				agentPath: '.opencode/agent/AGENTS.md',
				schema: 'https://opencode.ai/config.json',
				mcpServersKey: 'mcp',
				filePath: 'opencode.json',
				typeLocal: 'local',
				typeRemote: 'remote',
				command: ['npx', '-y', '@sveltejs/mcp'],
				args: null
			},
			vscode: {
				agentPath: 'AGENTS.md',
				mcpServersKey: 'servers',
				filePath: '.vscode/mcp.json'
			},
			other: {
				other: true
			}
		};

		for (const ide of options.ide) {
			const value = configurator[ide];
			if ('other' in value) continue;

			const {
				mcpServersKey,
				agentPath,
				filePath,
				typeLocal,
				typeRemote,
				env,
				schema,
				command,
				args
			} = value;

			sv.file(agentPath, (content) => {
				if (content) {
					log.warn(
						`A ${colors.yellow(agentPath)} file already exists. Could not update. See https://svelte.dev/docs/mcp/overview#Usage on how to add the prompt manually.`
					);
					return content;
				}
				return agent;
			});

			sv.file(filePath, (content) => {
				const { data, generateCode } = parseJson(content);
				if (schema) {
					data['$schema'] = schema;
				}
				const key = mcpServersKey || 'mcpServers';
				data[key] ??= {};
				data[key].svelte =
					options.setup === 'local'
						? getLocalConfig({ type: typeLocal, env, command, args })
						: getRemoteConfig({ type: typeRemote });
				return generateCode();
			});
		}
	},
	nextSteps({ highlighter, options }) {
		const steps = [];

		if (options.ide.includes('other')) {
			steps.push(
				`For other clients: ${highlighter.website(`https://svelte.dev/docs/mcp/${options.setup}-setup#Other-clients`)}`
			);
		}

		return steps;
	}
});
