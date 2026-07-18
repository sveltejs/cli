import { log } from '@clack/prompts';
import { color, transforms } from '@sveltejs/sv-utils';
import { defineAddon, defineAddonOptions } from '../core/config.ts';
import { getSharedFiles } from '../create/utils.ts';

const REGEX_MD = /\.md$/;

type Client = {
	label: string;
	// committing this settings file enables the Svelte plugin for the client (Claude Code)
	pluginSettings?: { path: string; marketplace: string; repo: string; id: string };
	// always delivered through its own plugin/config, never loose files (opencode)
	pluginOnly?: boolean;
	schema?: string;
	mcpOptions?: {
		serversKey?: string;
		typeLocal?: 'stdio' | 'local';
		typeRemote?: 'http' | 'remote';
		env?: boolean;
		command?: string | string[];
		args?: string[];
	};
	agentPath?: string;
	// pointer file importing agentPath, keeps a single source of truth (CLAUDE.md -> @AGENTS.md)
	agentLink?: { path: string; contents: string };
	configPath?: string;
	skillsPath?: string;
	agentsPath?: string;
	agentExtension?: string;
	customData?: Record<string, any>;
	extraFiles?: Array<{ path: string; data: Record<string, any> }>;
};

// Single source of truth per client - drives the `ide` prompt, the conditions and the `run` logic.
const CLIENTS: Record<string, Client> = {
	'claude-code': {
		label: 'claude code',
		pluginSettings: {
			path: '.claude/settings.json',
			marketplace: 'svelte',
			repo: 'sveltejs/ai-tools',
			id: 'svelte@svelte'
		},
		agentPath: 'AGENTS.md',
		agentLink: { path: '.claude/CLAUDE.md', contents: '@../AGENTS.md\n' },
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
		label: 'Cursor',
		agentPath: 'AGENTS.md',
		configPath: '.cursor/mcp.json',
		skillsPath: '.cursor/skills',
		agentsPath: '.cursor/agents',
		mcpOptions: {}
	},
	gemini: {
		label: 'Gemini',
		agentPath: 'GEMINI.md',
		configPath: '.gemini/settings.json',
		skillsPath: '.gemini/skills',
		agentsPath: '.gemini/agents',
		schema:
			'https://raw.githubusercontent.com/google-gemini/gemini-cli/main/schemas/settings.schema.json',
		mcpOptions: {}
	},
	opencode: {
		label: 'opencode',
		pluginOnly: true,
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
		label: 'VSCode',
		agentPath: 'AGENTS.md',
		configPath: '.vscode/mcp.json',
		skillsPath: '.github/skills',
		agentsPath: '.github/agents',
		agentExtension: '.agent.md',
		mcpOptions: {
			serversKey: 'servers'
		}
	},
	other: {
		label: 'Other'
	}
};

const hasPlugin = (client?: Client) =>
	Boolean(client && (client.pluginSettings || client.pluginOnly));
const isFileOnly = (client?: Client) => Boolean(client && client.agentPath && !hasPlugin(client));

// Static for curated labels; derive from getSharedFiles() (include 'skills'/'agents') to go dynamic.
const TOOLS: Record<string, { label: string; kind: 'mcp' | 'skill' | 'agent'; hint?: string }> = {
	mcp: { label: 'MCP server', kind: 'mcp' },
	'svelte-code-writer': { label: 'svelte-code-writer', kind: 'skill', hint: 'skill' },
	'svelte-core-bestpractices': { label: 'svelte-core-bestpractices', kind: 'skill', hint: 'skill' },
	'svelte-file-editor': { label: 'svelte-file-editor', kind: 'agent', hint: 'sub-agent' }
};

const options = defineAddonOptions()
	.add('ide', {
		question: 'Which client would you like to use?',
		type: 'multiselect',
		default: [],
		options: Object.entries(CLIENTS).map(([value, client]) => ({ value, label: client.label })),
		required: true
	})
	.add('delivery', {
		question: 'How would you like to add the Svelte tools?',
		type: 'select',
		default: 'plugin',
		options: [
			{ value: 'plugin', label: 'Svelte plugin', hint: 'recommended, auto-installs & updates' },
			{ value: 'tools', label: 'Individual tools', hint: 'choose exactly what to add' }
		],
		condition: ({ ide }) => ide.some((i) => hasPlugin(CLIENTS[i]))
	})
	.add('tools', {
		question: 'Which tools would you like to add?',
		type: 'multiselect',
		default: Object.keys(TOOLS),
		options: Object.entries(TOOLS).map(([value, t]) => ({ value, label: t.label, hint: t.hint })),
		required: false,
		condition: ({ ide, delivery }) =>
			delivery !== 'plugin' || ide.some((i) => isFileOnly(CLIENTS[i]))
	})
	.add('mcpSetup', {
		question: 'Which MCP setup would you like to use?',
		type: 'select',
		default: 'remote',
		options: [
			{ value: 'local', label: 'Local', hint: 'will use stdio' },
			{ value: 'remote', label: 'Remote', hint: 'will use a remote endpoint' }
		],
		condition: ({ ide, delivery }) =>
			ide.some((i) => isFileOnly(CLIENTS[i])) ||
			(delivery !== 'plugin' && ide.some((i) => Boolean(CLIENTS[i]?.mcpOptions)))
	})
	.build();

export default defineAddon({
	id: 'ai-tools',
	shortDescription: 'Svelte AI Tools',
	homepage: 'https://svelte.dev/docs/ai',
	options,
	run: ({ sv, options }) => {
		const usePlugin = options.delivery === 'plugin';

		// pure-plugin path skips the tools question; file-only clients then fall back to all
		const selected = options.tools ?? Object.keys(TOOLS);
		const selectedSkills = selected.filter((t) => TOOLS[t]?.kind === 'skill');
		const selectedAgents = selected.filter((t) => TOOLS[t]?.kind === 'agent');
		const wantsMcp = selected.includes('mcp');

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

		const filesAdded: string[] = [];
		const filesExistingAlready: string[] = [];

		const sharedFiles = getSharedFiles();
		const mcpFiles = sharedFiles.filter((file) => file.include.includes('mcp'));
		const skillFiles = sharedFiles.filter((file) => file.include.includes('skills'));
		const agentFiles = sharedFiles.filter((file) => file.include.includes('agents'));
		const agentFile = mcpFiles.find((file) => file.name === 'AGENTS.md');

		const addFile = (path: string, contents: string) => {
			sv.file(path, (content) => {
				if (content) {
					filesExistingAlready.push(path);
					return false;
				}
				if (!filesAdded.includes(path)) filesAdded.push(path);
				return contents;
			});
		};

		for (const ide of options.ide) {
			const client = CLIENTS[ide];
			if (!client) continue;

			// plugin mode: write only the settings file (the plugin bundles MCP + skills + sub-agents)
			if (client.pluginSettings && usePlugin) {
				const plugin = client.pluginSettings;
				sv.file(
					plugin.path,
					transforms.json(({ data }) => {
						data.extraKnownMarketplaces ??= {};
						data.extraKnownMarketplaces[plugin.marketplace] ??= {
							source: { source: 'github', repo: plugin.repo }
						};
						data.enabledPlugins ??= {};
						data.enabledPlugins[plugin.id] = true;
					})
				);
				continue;
			}

			if (!client.agentPath) continue;

			const {
				mcpOptions,
				agentPath,
				agentLink,
				configPath,
				skillsPath,
				agentsPath,
				agentExtension,
				schema,
				customData,
				extraFiles
			} = client;

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

			if (agentLink) addFile(agentLink.path, agentLink.contents);

			const writeMcp = Boolean(mcpOptions) && wantsMcp;
			if (configPath && (writeMcp || customData)) {
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

						if (writeMcp) {
							const key = mcpOptions!.serversKey ?? 'mcpServers';
							data[key] ??= {};
							data[key].svelte =
								options.mcpSetup === 'local'
									? getLocalConfig(mcpOptions)
									: getRemoteConfig(mcpOptions);
						}
					})
				);
			}

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

			if (skillsPath) {
				for (const file of skillFiles) {
					if (!selectedSkills.includes(file.name.split('/')[0])) continue;
					addFile(`${skillsPath}/${file.name}`, file.contents);
				}
			}

			if (agentsPath) {
				for (const file of agentFiles) {
					if (!selectedAgents.includes(file.name.replace(REGEX_MD, ''))) continue;
					const ext = agentExtension ?? '.md';
					const name = file.name.replace(REGEX_MD, ext);
					addFile(`${agentsPath}/${name}`, file.contents);
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

		if (options.delivery === 'plugin' && options.ide.includes('claude-code')) {
			steps.push(
				`Open the project in Claude Code and trust the workspace - the Svelte plugin installs automatically.`
			);
		}

		if (options.ide.includes('other')) {
			steps.push(
				`For other clients: ${color.website(`https://svelte.dev/docs/ai/${options.mcpSetup ?? 'remote'}-setup#Other-clients`)}`
			);
		}

		return steps;
	}
});
