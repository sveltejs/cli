import fs from 'node:fs';
import path from 'node:path';
import { log } from '@clack/prompts';
import { color, transforms } from '@sveltejs/sv-utils';
import { type Addon, defineAddon, defineAddonOptions } from '../core/config.ts';
import type { AddonOptions } from '../core/options.ts';
import { dist_dir } from '../create/utils.ts';
import { ADDON_IDS } from './ids.ts';

const REGEX_MD = /\.md$/;

type Client = {
	label: string;
	// committing this settings file enables the Svelte plugin for the client (Claude Code)
	pluginSettings?: { path: string; marketplace: string; repo: string; id: string };
	// always delivered through its own plugin/config, never loose files (opencode, pi)
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
	// other project folders the client also loads skills from (besides skillsPath)
	alsoReadsSkillsFrom?: string[];
	agentsPath?: string;
	agentExtension?: string;
	customData?: Record<string, any>;
	extraFiles?: Array<{ path: string; data: Record<string, any> }>;
};

// Single source of truth per client - drives the `ide` prompt, the conditions and the `run` logic.
const CLIENTS: Record<string, Client> = {
	'claude-code': {
		label: 'Claude Code',
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
		// https://cursor.com/docs/context/skills
		alsoReadsSkillsFrom: ['.agents/skills', '.claude/skills', '.codex/skills'],
		agentsPath: '.cursor/agents',
		mcpOptions: {}
	},
	gemini: {
		label: 'Gemini',
		agentPath: 'GEMINI.md',
		configPath: '.gemini/settings.json',
		skillsPath: '.gemini/skills',
		// https://geminicli.com/docs/cli/skills/
		alsoReadsSkillsFrom: ['.agents/skills'],
		agentsPath: '.gemini/agents',
		schema:
			'https://raw.githubusercontent.com/google-gemini/gemini-cli/main/schemas/settings.schema.json',
		mcpOptions: {}
	},
	opencode: {
		label: 'OpenCode',
		pluginOnly: true,
		agentPath: 'AGENTS.md',
		configPath: '.opencode/opencode.json',
		// only used for opt-in skills the plugin doesn't ship (svelte-mcp-feedback)
		skillsPath: '.opencode/skills',
		// https://opencode.ai/v2/docs/skills/ - `.claude/skills` is left out on purpose: OpenCode 2
		// doesn't load it automatically (worst case, an OpenCode 1 user loads a second copy)
		alsoReadsSkillsFrom: ['.agents/skills'],
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
	pi: {
		label: 'Pi',
		pluginOnly: true,
		agentPath: 'AGENTS.md',
		configPath: '.pi/settings.json',
		// only used for opt-in skills the package doesn't ship (svelte-mcp-feedback)
		skillsPath: '.pi/skills',
		// https://pi.dev/docs/latest/skills
		alsoReadsSkillsFrom: ['.agents/skills'],
		schema: 'https://pi.dev/schemas/settings.schema.json',
		customData: { packages: ['npm:@sveltejs/pi'] },
		extraFiles: [
			{
				path: '.pi/svelte.json',
				data: {
					$schema: 'https://svelte.dev/pi/schema.json'
				}
			}
		]
	},
	vscode: {
		label: 'VS Code',
		agentPath: 'AGENTS.md',
		configPath: '.vscode/mcp.json',
		skillsPath: '.github/skills',
		// https://code.visualstudio.com/docs/copilot/customization/agent-skills
		alsoReadsSkillsFrom: ['.claude/skills', '.agents/skills'],
		agentsPath: '.github/agents',
		agentExtension: '.agent.md',
		mcpOptions: {
			serversKey: 'servers'
		}
	},
	// no known config location: only writes AGENTS.md, next steps link to the docs
	other: {
		label: 'Other',
		agentPath: 'AGENTS.md'
	}
};

// a client can only receive loose tool files if it has somewhere to put them
const acceptsTools = (client?: Client) =>
	Boolean(
		client && !client.pluginOnly && (client.skillsPath || client.agentsPath || client.configPath)
	);
// clients whose plugin replaces loose files only skip them when the plugin is chosen
const wantsLooseTools = (client: Client | undefined, delivery: string | undefined) =>
	acceptsTools(client) && (!client!.pluginSettings || delivery !== 'plugin');
const wantsMcpConfig = (client: Client | undefined, delivery: string | undefined) =>
	Boolean(client?.mcpOptions) && wantsLooseTools(client, delivery);

// Static for curated labels; derive from ai-tools.json (the `skills/`/`agents/` entries) to go dynamic.
const TOOLS: Record<string, { label: string; kind: 'mcp' | 'skill' | 'agent'; hint?: string }> = {
	mcp: { label: 'MCP server', kind: 'mcp' },
	'svelte-code-writer': { label: 'svelte-code-writer', kind: 'skill', hint: 'skill' },
	'svelte-core-bestpractices': { label: 'svelte-core-bestpractices', kind: 'skill', hint: 'skill' },
	'svelte-file-editor': { label: 'svelte-file-editor', kind: 'agent', hint: 'sub-agent' }
};

// Opt-in skills are never bundled with the plugins: asked separately (default none)
// and written as loose files for every client with a skills folder.
const OPT_IN_SKILLS: Record<string, { label: string; hint?: string }> = {
	'svelte-mcp-feedback': {
		label: 'svelte-mcp-feedback',
		hint: 'reports Svelte mistakes you correct to sveltejs/ai-tools'
	}
};

// every project folder a client loads skills from (none if it has no skills folder)
const skillDirsOf = (client: Client) =>
	client.skillsPath ? [client.skillsPath, ...(client.alsoReadsSkillsFrom ?? [])] : [];
const hasSkillIn = (cwd: string, dir: string, skill: string) =>
	fs.existsSync(path.resolve(cwd, dir, skill, 'SKILL.md'));
// checked per client: a skill in `.claude/skills` is visible to Cursor but not to Pi
const isSkillInstalled = (cwd: string, client: Client, skill: string) =>
	skillDirsOf(client).some((dir) => hasSkillIn(cwd, dir, skill));
// how many clients load skills from `dir`: clients whose own folder is shared get written first
const readersOf = (dir: string) =>
	Object.values(CLIENTS).filter((client) => skillDirsOf(client).includes(dir)).length;

export type AiToolsOptions = {
	ide: string[];
	delivery: 'plugin' | 'tools';
	tools: string[];
	mcpSetup: 'local' | 'remote';
	optInSkills: string[];
};

// `isInstalled` lets setup account for the skills already in the project (static definition: none)
const optInSkillsQuestion = (
	isInstalled: (client: Client, skill: string) => boolean = () => false
) => {
	// opt-in skills still missing for at least one of the given clients
	const missingFor = (ides: string[]) =>
		Object.keys(OPT_IN_SKILLS).filter((skill) =>
			ides.some((i) => CLIENTS[i]?.skillsPath && !isInstalled(CLIENTS[i], skill))
		);

	return {
		question: 'Would you like to add any opt-in skills?',
		type: 'multiselect' as const,
		default: [],
		// options can't depend on the selected clients, so list what's missing for any client
		options: missingFor(Object.keys(CLIENTS)).map((value) => ({
			value,
			label: OPT_IN_SKILLS[value].label,
			hint: OPT_IN_SKILLS[value].hint
		})),
		required: false,
		// asked regardless of delivery (the plugins don't ship these skills), but only when
		// something is missing for the selected clients
		// loosely typed: `addOption` passes untyped option values
		condition: ({ ide }: Record<string, any>) => missingFor(ide as string[]).length > 0
	};
};

const options = defineAddonOptions<AiToolsOptions>()
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
		condition: ({ ide }) => ide.some((i) => CLIENTS[i]?.pluginSettings)
	})
	.add('tools', {
		question: 'Which tools would you like to add?',
		type: 'multiselect',
		default: Object.keys(TOOLS),
		options: Object.entries(TOOLS).map(([value, t]) => ({ value, label: t.label, hint: t.hint })),
		required: false,
		condition: ({ ide, delivery }) => ide.some((i) => wantsLooseTools(CLIENTS[i], delivery))
	})
	.add('mcpSetup', {
		question: 'Which MCP setup would you like to use?',
		type: 'select',
		default: 'remote',
		options: [
			{ value: 'local', label: 'Local', hint: 'will use stdio' },
			{ value: 'remote', label: 'Remote', hint: 'will use a remote endpoint' }
		],
		condition: ({ ide, delivery, tools }) =>
			(tools === undefined || tools.includes('mcp')) &&
			ide.some((i) => wantsMcpConfig(CLIENTS[i], delivery))
	})
	// static definition lists every opt-in skill so CLI args (validated before setup) and docs see them all
	.add('optInSkills', optInSkillsQuestion())
	.build();

const addon: Addon<AddonOptions<AiToolsOptions>, 'ai-tools'> = defineAddon({
	id: ADDON_IDS.aiTools,
	shortDescription: 'Svelte AI tools',
	homepage: 'https://svelte.dev/docs/ai',
	options,
	setup: ({ cwd, addOption }) => {
		// skip the question when the selected clients already have every opt-in skill
		addOption(
			'optInSkills',
			optInSkillsQuestion((client, skill) => isSkillInstalled(cwd, client, skill))
		);
	},
	run: ({ sv, options, cwd }) => {
		const usePlugin = options.delivery === 'plugin';

		// pure-plugin path skips the tools question; file-only clients then fall back to all
		const selected = options.tools ?? Object.keys(TOOLS);
		const selectedSkills = selected.filter((t) => TOOLS[t]?.kind === 'skill');
		const selectedAgents = selected.filter((t) => TOOLS[t]?.kind === 'agent');
		const wantsMcp = selected.includes('mcp');
		const selectedOptInSkills = (options.optInSkills ?? []).filter((s) => s in OPT_IN_SKILLS);

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

		const { files } = JSON.parse(
			fs.readFileSync(path.join(dist_dir, 'addons', 'ai-tools.json'), 'utf-8')
		) as {
			files: Array<{ name: string; contents: string }>;
		};
		// Content is namespaced by kind (`mcp/`, `skills/`, `agents/`); strip the
		// prefix so the rest of the addon works with plain relative paths.
		const at = (kind: string) =>
			files
				.filter((file) => file.name.startsWith(`${kind}/`))
				.map((file) => ({ ...file, name: file.name.slice(kind.length + 1) }));
		const mcpFiles = at('mcp');
		const skillFiles = at('skills');
		const agentFiles = at('agents');
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

		// Opt-in skills aren't part of any plugin, so they're written in plugin mode too.
		// Clients load skills from several folders (Cursor and VS Code also read `.claude/skills`),
		// so each skill is only written for clients that can't see it yet, counting the folders written
		// in this run. Clients whose folder is read by others (Claude Code) go first, so e.g.
		// Claude Code + Cursor share `.claude/skills` instead of Cursor loading two copies.
		const optInClients = options.ide
			.map((ide) => CLIENTS[ide])
			.filter((client): client is Client => Boolean(client?.skillsPath))
			.sort((a, b) => readersOf(b.skillsPath!) - readersOf(a.skillsPath!));
		for (const skill of selectedOptInSkills) {
			const files = skillFiles.filter((file) => file.name.split('/')[0] === skill);
			const writtenDirs = new Set<string>();
			for (const client of optInClients) {
				const visible = skillDirsOf(client).some(
					(dir) => writtenDirs.has(dir) || hasSkillIn(cwd, dir, skill)
				);
				if (visible) continue;
				for (const file of files) addFile(`${client.skillsPath}/${file.name}`, file.contents);
				writtenDirs.add(client.skillsPath!);
			}
		}

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
						// several clients share AGENTS.md, so the same path can land here more than once
						if (!filesExistingAlready.includes(agentPath)) filesExistingAlready.push(agentPath);

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

			// plugin-only clients (opencode) get skills and sub-agents from their plugin
			const looseTools = wantsLooseTools(client, options.delivery);

			if (skillsPath && looseTools) {
				for (const file of skillFiles) {
					if (!selectedSkills.includes(file.name.split('/')[0])) continue;
					addFile(`${skillsPath}/${file.name}`, file.contents);
				}
			}

			if (agentsPath && looseTools) {
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

	nextSteps({ options, cwd }) {
		const steps = [];

		// plugin enabled + loose files -> the client would see skills/sub-agents twice
		for (const ide of options.ide) {
			const client = CLIENTS[ide];
			if (!client?.pluginSettings) continue;

			const plugin = client.pluginSettings;
			const settingsPath = path.resolve(cwd, plugin.path);
			if (!fs.existsSync(settingsPath)) continue;

			let pluginEnabled = false;
			try {
				pluginEnabled = Boolean(
					JSON.parse(fs.readFileSync(settingsPath, 'utf8')).enabledPlugins?.[plugin.id]
				);
			} catch {
				// ignore unparsable settings
			}
			if (!pluginEnabled) continue;

			const looseDirs = [client.skillsPath, client.agentsPath].filter(
				(dir): dir is string =>
					Boolean(dir) &&
					fs.existsSync(path.resolve(cwd, dir!)) &&
					fs
						.readdirSync(path.resolve(cwd, dir!))
						.some((entry) => Object.keys(TOOLS).includes(entry.replace(REGEX_MD, '')))
			);
			if (looseDirs.length === 0) continue;

			steps.push(
				`${client.label}: the Svelte plugin is enabled and ${looseDirs.map((d) => color.path(d)).join(' + ')} also exist${looseDirs.length > 1 ? '' : 's'} - remove ${looseDirs.length > 1 ? 'them' : 'it'} (or disable the plugin) to avoid duplicate skills/sub-agents.`
			);
		}

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

export default addon;
