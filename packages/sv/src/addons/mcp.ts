import { log } from '@clack/prompts';
import { color, parse } from '@sveltejs/sv-utils';
import { defineAddon, defineAddonOptions } from '../core/config.ts';
import { getSharedFiles } from '../create/utils.ts';

const deepMerge = (target: any, source: any): any => {
	if (source && typeof source === 'object' && !Array.isArray(source)) {
		for (const key in source) {
			if (Object.hasOwn(source, key)) {
				if (target[key] && typeof target[key] === 'object' && !Array.isArray(target[key])) {
					deepMerge(target[key], source[key]);
				} else {
					target[key] = source[key];
				}
			}
		}
	}
	return target;
};

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
		question: 'What setup would you like to use?',
		type: 'select',
		default: 'remote',
		options: [
			{ value: 'local', label: 'Local', hint: 'will use stdio' },
			{ value: 'remote', label: 'Remote', hint: 'will use a remote endpoint' }
		],
		required: true,
		condition: ({ ide }) => !(ide.length === 1 && ide.includes('opencode'))
	})
	.build();

export default defineAddon({
	id: 'mcp',
	shortDescription: 'Svelte MCP',
	homepage: 'https://svelte.dev/docs/mcp',
	options,
	run: ({ sv, options }) => {
		const getLocalConfig = (o?: {
			typeLocal?: 'stdio' | 'local';
			env?: boolean;
			command?: string | string[];
			args?: string[] | null;
		}) => {
			const config: any = {
				...(o?.typeLocal ? { type: o.typeLocal } : {}),
				command: o?.command ?? 'npx',
				...(o?.env ? { env: {} } : {}),
				...(o?.args === null ? {} : { args: o?.args ?? ['-y', '@sveltejs/mcp'] })
			};
			return config;
		};
		const getRemoteConfig = (o?: { typeRemote?: 'http' | 'remote' }) => {
			return {
				...(o?.typeRemote ? { type: o.typeRemote } : {}),
				url: 'https://mcp.svelte.dev/mcp'
			};
		};

		const configurator: Record<
			(typeof options.ide)[number],
			| {
					schema?: string;
					mcpOptions?: {
						serversKey?: string;
						typeLocal?: 'stdio' | 'local';
						typeRemote?: 'http' | 'remote';
						env?: boolean;
						command?: string | string[];
						args?: string[];
					};
					agentPath: string;
					configPath: string;
					customData?: Record<string, any>;
			  }
			| { other: true }
		> = {
			'claude-code': {
				agentPath: 'CLAUDE.md',
				configPath: '.mcp.json',
				mcpOptions: {
					typeLocal: 'stdio',
					typeRemote: 'http',
					env: true
				}
			},
			cursor: {
				agentPath: 'AGENTS.md',
				configPath: '.cursor/mcp.json',
				mcpOptions: {}
			},
			gemini: {
				agentPath: 'GEMINI.md',
				configPath: '.gemini/settings.json',
				schema:
					'https://raw.githubusercontent.com/google-gemini/gemini-cli/main/schemas/settings.schema.json',
				mcpOptions: {}
			},
			opencode: {
				agentPath: 'AGENTS.md',
				configPath: 'opencode.json',
				schema: 'https://opencode.ai/config.json',
				customData: { plugin: ['@sveltejs/opencode'] }
			},
			vscode: {
				agentPath: 'AGENTS.md',
				configPath: '.vscode/mcp.json',
				mcpOptions: {
					serversKey: 'servers'
				}
			},
			other: {
				other: true
			}
		};

		const filesAdded: string[] = [];
		const filesExistingAlready: string[] = [];

		const sharedFiles = getSharedFiles().filter((file) => file.include.includes('mcp'));
		const agentFile = sharedFiles.find((file) => file.name === 'AGENTS.md');

		for (const ide of options.ide) {
			const value = configurator[ide];

			if (value === undefined) continue;
			if ('other' in value) continue;

			const { mcpOptions, agentPath, configPath, schema, customData } = value;

			// We only add the agent file if it's not already added
			if (!filesAdded.includes(agentPath)) {
				sv.file(agentPath, (content) => {
					if (content) {
						filesExistingAlready.push(agentPath);
						return content;
					}
					filesAdded.push(agentPath);
					return agentFile?.contents ?? '';
				});
			}

			sv.file(configPath, (content) => {
				const { data, generateCode } = parse.json(content);

				if (schema) {
					data['$schema'] = schema;
				}

				if (customData) {
					deepMerge(data, customData);
				}

				if (mcpOptions) {
					const key = mcpOptions.serversKey ?? 'mcpServers';
					data[key] ??= {};
					data[key].svelte =
						options.setup === 'local' ? getLocalConfig(mcpOptions) : getRemoteConfig(mcpOptions);
				}
				return generateCode();
			});
		}

		if (filesExistingAlready.length > 0) {
			log.warn(
				`${filesExistingAlready.map((path) => color.path(path)).join(', ')} already exists, we didn't touch ${filesExistingAlready.length > 1 ? 'them' : 'it'}. ` +
					`See ${color.website('https://svelte.dev/docs/mcp/overview#Usage')} for manual setup.`
			);
		}
	},

	nextSteps({ options }) {
		const steps = [];

		if (options.ide.includes('other')) {
			steps.push(
				`For other clients: ${color.website(`https://svelte.dev/docs/mcp/${options.setup}-setup#Other-clients`)}`
			);
		}

		return steps;
	}
});
