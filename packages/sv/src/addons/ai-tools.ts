import { log } from '@clack/prompts';
import { color, transforms } from '@sveltejs/sv-utils';
import { defineAddon, defineAddonOptions } from '../core/config.ts';
import { getSharedFiles } from '../create/utils.ts';

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
	.add('skills', {
		question: 'Do you want to install skills?',
		type: 'select',
		default: 'files',
		options: [
			{ value: 'files', label: 'Add files to the project' },
			{
				value: 'none',
				label: 'Skip',
				hint: 'for Claude Code you can install the plugin instead: /plugin install svelte'
			}
		],
		condition: ({ ide }) => ide.some((i) => i !== 'opencode' && i !== 'other')
	})
	.build();

export default defineAddon({
	id: 'ai-tools',
	shortDescription: 'Svelte AI Tools',
	homepage: 'https://svelte.dev/docs/ai',
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
					skillsPath?: string;
					agentsPath?: string;
					agentExtension?: string;
					customData?: Record<string, any>;
					extraFiles?: Array<{ path: string; data: Record<string, any> }>;
			  }
			| { other: true }
		> = {
			'claude-code': {
				agentPath: '.claude/CLAUDE.md',
				configPath: '.mcp.json',
				skillsPath: '.claude/skills',
				agentsPath: '.claude/agents',
				mcpOptions: {
					typeLocal: 'stdio',
					typeRemote: 'http',
					env: true
				}
			},
			cursor: {
				agentPath: 'AGENTS.md',
				configPath: '.cursor/mcp.json',
				agentsPath: '.cursor/agents',
				mcpOptions: {}
			},
			gemini: {
				agentPath: 'GEMINI.md',
				configPath: '.gemini/settings.json',
				agentsPath: '.gemini/agents',
				schema:
					'https://raw.githubusercontent.com/google-gemini/gemini-cli/main/schemas/settings.schema.json',
				mcpOptions: {}
			},
			opencode: {
				agentPath: 'AGENTS.md',
				configPath: '.opencode/opencode.json',
				schema: 'https://opencode.ai/config.json',
				customData: { plugin: ['@sveltejs/opencode'] },
				extraFiles: [
					{
						path: '.opencode/svelte.json',
						data: {
							$schema: 'https://svelte.dev/opencode/schema.json'
						}
					}
				]
			},
			vscode: {
				agentPath: 'AGENTS.md',
				configPath: '.vscode/mcp.json',
				agentsPath: '.github/agents',
				agentExtension: '.agent.md',
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

		const sharedFiles = getSharedFiles();
		const mcpFiles = sharedFiles.filter((file) => file.include.includes('mcp'));
		const skillFiles = sharedFiles.filter((file) => file.include.includes('skills'));
		const agentFiles = sharedFiles.filter((file) => file.include.includes('agents'));
		const agentFile = mcpFiles.find((file) => file.name === 'AGENTS.md');

		for (const ide of options.ide) {
			const value = configurator[ide];

			if (value === undefined) continue;
			if ('other' in value) continue;

			const {
				mcpOptions,
				agentPath,
				configPath,
				skillsPath,
				agentsPath,
				agentExtension,
				schema,
				customData,
				extraFiles
			} = value;

			// We only add the agent file if it's not already added
			if (!filesAdded.includes(agentPath)) {
				sv.file(agentPath, (content) => {
					if (content) {
						filesExistingAlready.push(agentPath);
						return false;
					}
					filesAdded.push(agentPath);
					return agentFile?.contents ?? '';
				});
			}

			sv.file(
				configPath,
				transforms.json(({ data }) => {
					if (schema) {
						data['$schema'] = schema;
					}

					if (customData) {
						for (const [key, value] of Object.entries(customData)) {
							data[key] = value;
						}
					}

					if (mcpOptions) {
						const key = mcpOptions.serversKey ?? 'mcpServers';
						data[key] ??= {};
						data[key].svelte =
							options.setup === 'local' ? getLocalConfig(mcpOptions) : getRemoteConfig(mcpOptions);
					}
				})
			);

			if (extraFiles) {
				for (const extra of extraFiles) {
					sv.file(
						extra.path,
						transforms.json(({ data }) => {
							for (const [key, value] of Object.entries(extra.data)) {
								data[key] = value;
							}
						})
					);
				}
			}

			// Add skills for clients that support them (not opencode - plugin handles it)
			if (skillsPath && options.skills === 'files') {
				for (const file of skillFiles) {
					const filePath = `${skillsPath}/${file.name}`;
					sv.file(filePath, (content) => {
						if (content) {
							filesExistingAlready.push(filePath);
							return false;
						}
						return file.contents;
					});
				}
			}

			// Add sub-agents for clients that support them (not opencode - plugin handles it)
			if (agentsPath) {
				for (const file of agentFiles) {
					const ext = agentExtension ?? '.md';
					const name = file.name.replace(/\.md$/, ext);
					const filePath = `${agentsPath}/${name}`;
					sv.file(filePath, (content) => {
						if (content) {
							filesExistingAlready.push(filePath);
							return false;
						}
						return file.contents;
					});
				}
			}
		}

		if (filesExistingAlready.length > 0) {
			log.warn(
				`${filesExistingAlready.map((path) => color.path(path)).join(', ')} already exists, we didn't touch ${filesExistingAlready.length > 1 ? 'them' : 'it'}. ` +
					`See ${color.website('https://svelte.dev/docs/ai')} for manual setup.`
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
