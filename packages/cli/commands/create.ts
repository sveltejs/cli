import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import * as p from '@clack/prompts';
import type { OptionValues, Workspace } from '@sveltejs/cli-core';
import {
	create as createKit,
	templates,
	type LanguageType,
	type TemplateType
} from '@sveltejs/create';
import {
	detectPlaygroundDependencies,
	downloadPlaygroundData,
	parsePlaygroundUrl,
	setupPlaygroundProject,
	validatePlaygroundUrl
} from '@sveltejs/create/playground';
import { Command, Option } from 'commander';
import { detect, resolveCommand } from 'package-manager-detector';
import pc from 'picocolors';
import * as v from 'valibot';

import * as common from '../utils/common.ts';
import {
	addPnpmBuildDependencies,
	AGENT_NAMES,
	getUserAgent,
	installDependencies,
	installOption,
	packageManagerPrompt
} from '../utils/package-manager.ts';
import {
	addonArgsHandler,
	promptAddonQuestions,
	runAddonsApply,
	sanitizeAddons,
	type SelectedAddon
} from './add/index.ts';
import { commonFilePaths, getPackageJson } from './add/utils.ts';
import { createWorkspace } from './add/workspace.ts';
import { dist } from '../../create/utils.ts';

const langs = ['ts', 'jsdoc'] as const;
const langMap: Record<string, LanguageType | undefined> = {
	ts: 'typescript',
	jsdoc: 'checkjs',
	false: 'none'
};
const templateChoices = templates.map((t) => t.name);
const langOption = new Option('--types <lang>', 'add type checking').choices(langs);
const templateOption = new Option('--template <type>', 'template to scaffold').choices(
	templateChoices
);
const noAddonsOption = new Option('--no-add-ons', 'do not prompt to add add-ons').conflicts('add');
const addOption = new Option('--add <addon...>', 'add-on to include').default([]);

const ProjectPathSchema = v.optional(v.string());
const OptionsSchema = v.strictObject({
	types: v.pipe(
		v.optional(v.union([v.picklist(langs), v.boolean()])),
		v.transform((lang) => langMap[String(lang)])
	),
	addOns: v.boolean(),
	add: v.array(v.string()),
	install: v.union([v.boolean(), v.picklist(AGENT_NAMES)]),
	template: v.optional(v.picklist(templateChoices)),
	fromPlayground: v.optional(v.string()),
	dirCheck: v.boolean()
});
type Options = v.InferOutput<typeof OptionsSchema>;
type ProjectPath = v.InferOutput<typeof ProjectPathSchema>;

export const create = new Command('create')
	.description('scaffolds a new SvelteKit project')
	.argument('[path]', 'where the project will be created')
	.addOption(templateOption)
	.addOption(langOption)
	.option('--no-types')
	.addOption(noAddonsOption)
	.addOption(addOption)
	.option('--no-install', 'skip installing dependencies')
	.option('--from-playground <url>', 'create a project from the svelte playground')
	.option('--no-dir-check', 'even if the folder is not empty, no prompt will be shown')
	.addOption(installOption)
	.configureHelp(common.helpConfig)
	.action((projectPath, opts) => {
		const cwd = v.parse(ProjectPathSchema, projectPath);
		const options = v.parse(OptionsSchema, opts);

		if (options.fromPlayground && !validatePlaygroundUrl(options.fromPlayground)) {
			console.error(pc.red(`Error: Invalid playground URL: ${options.fromPlayground}`));
			process.exit(1);
		}

		common.runCommand(async () => {
			const { directory, addOnNextSteps, packageManager } = await createProject(cwd, options);
			const highlight = (str: string) => pc.bold(pc.cyan(str));

			let i = 1;
			const initialSteps: string[] = ['📁 Project steps', ''];
			const relative = path.relative(process.cwd(), directory);
			const pm =
				packageManager ?? (await detect({ cwd: directory }))?.name ?? getUserAgent() ?? 'npm';
			if (relative !== '') {
				const pathHasSpaces = relative.includes(' ');
				initialSteps.push(
					`  ${i++}: ${highlight(`cd ${pathHasSpaces ? `"${relative}"` : relative}`)}`
				);
			}
			if (!packageManager) {
				const { args, command } = resolveCommand(pm, 'install', [])!;
				initialSteps.push(`  ${i++}: ${highlight(`${command} ${args.join(' ')}`)}`);
			}

			const { args, command } = resolveCommand(pm, 'run', ['dev', '--open'])!;
			const pmRunCmd = `${command} ${args.join(' ')}`;
			const steps = [
				...initialSteps,
				`  ${i++}: ${highlight(pmRunCmd)}`,
				'',
				`To close the dev server, hit ${highlight('Ctrl-C')}`
			];

			if (addOnNextSteps.length > 0) {
				steps.push('', '🧩 Add-on steps', '');
				for (const step of addOnNextSteps) {
					const indented = step.replaceAll('  -', '    -');
					steps.push(`  ${indented}`);
				}
			}

			steps.push('', `Stuck? Visit us at ${pc.cyan('https://svelte.dev/chat')}`);

			p.note(steps.join('\n'), "What's next?", { format: (line) => line });
		});
	})
	.showHelpAfterError(true);

async function createProject(cwd: ProjectPath, options: Options) {
	if (options.fromPlayground) {
		p.log.warn(
			'The Svelte maintainers have not reviewed playgrounds for malicious code. Use at your discretion.'
		);
	}

	const { directory, template, language } = await p.group(
		{
			directory: () => {
				const defaultPath = './';
				if (cwd) {
					return Promise.resolve(cwd);
				}
				return p.text({
					message: 'Where would you like your project to be created?',
					placeholder: `  (hit Enter to use '${defaultPath}')`,
					defaultValue: defaultPath
				});
			},
			force: async ({ results: { directory } }) => {
				if (!options.dirCheck) return;

				if (!fs.existsSync(directory!)) return;

				const files = fs.readdirSync(directory!);
				const hasNonIgnoredFiles = files.some((file) => !file.startsWith('.git'));
				if (!hasNonIgnoredFiles) return;

				const force = await p.confirm({
					message: 'Directory not empty. Continue?',
					initialValue: false
				});
				if (p.isCancel(force) || !force) {
					p.cancel('Exiting.');
					process.exit(0);
				}
			},
			template: () => {
				if (options.template) return Promise.resolve(options.template);
				// always use the minimal template for playground projects
				if (options.fromPlayground) return Promise.resolve<TemplateType>('minimal');

				return p.select<TemplateType>({
					message: 'Which template would you like?',
					initialValue: 'minimal',
					options: templates.map((t) => ({ label: t.title, value: t.name, hint: t.description }))
				});
			},
			language: () => {
				if (options.types) return Promise.resolve(options.types);
				return p.select<LanguageType>({
					message: 'Add type checking with TypeScript?',
					initialValue: 'typescript',
					options: [
						{ label: 'Yes, using TypeScript syntax', value: 'typescript' },
						{ label: 'Yes, using JavaScript with JSDoc comments', value: 'checkjs' },
						{ label: 'No', value: 'none' }
					]
				});
			}
		},
		{
			onCancel: () => {
				p.cancel('Operation cancelled.');
				process.exit(0);
			}
		}
	);

	const projectPath = path.resolve(directory);
	const projectName = path.basename(projectPath);

	let selectedAddons: SelectedAddon[] = [];
	let answersOfficial: Record<string, OptionValues<any>> = {};
	let answersCommunity: Record<string, OptionValues<any>> = {};
	let sanitizedAddonsMap: Record<string, string[] | undefined> = {};

	const workspace = await createVirtualWorkspace({
		cwd: projectPath,
		template,
		type: language
	});

	if (options.addOns || options.add.length > 0) {
		const addons = options.add.reduce(addonArgsHandler, []);
		sanitizedAddonsMap = sanitizeAddons(addons).reduce<Record<string, string[] | undefined>>(
			(acc, curr) => {
				acc[curr.id] = curr.options;
				return acc;
			},
			{}
		);

		const result = await promptAddonQuestions({
			options: {
				cwd: projectPath,
				install: false,
				gitCheck: false,
				community: [],
				addons: sanitizedAddonsMap
			},
			selectedAddonIds: Object.keys(sanitizedAddonsMap),
			workspace
		});

		selectedAddons = result.selectedAddons;
		answersOfficial = result.answersOfficial;
		answersCommunity = result.answersCommunity;
	}

	createKit(projectPath, {
		name: projectName,
		template,
		types: language
	});

	if (options.fromPlayground) {
		await createProjectFromPlayground(
			options.fromPlayground,
			projectPath,
			language === 'typescript'
		);
	}

	p.log.success('Project created');

	let addOnNextSteps: string[] = [];
	let argsFormattedAddons: string[] = [];
	if (options.addOns || options.add.length > 0) {
		const { nextSteps, argsFormattedAddons: argsFormatted } = await runAddonsApply({
			answersOfficial,
			answersCommunity,
			options: {
				cwd: projectPath,
				install: false,
				gitCheck: false,
				community: [],
				addons: sanitizedAddonsMap
			},
			selectedAddons,
			addonSetupResults: undefined,
			workspace,
			fromCommand: 'create'
		});
		argsFormattedAddons = argsFormatted;

		addOnNextSteps = nextSteps;
	}

	const packageManager =
		options.install === false
			? null
			: options.install === true
				? await packageManagerPrompt(projectPath)
				: options.install;

	// Build args for next time based on non-default options
	const argsFormatted: string[] = [];

	argsFormatted.push('--template', template);

	if (language === 'typescript') argsFormatted.push('--types', 'ts');
	else if (language === 'checkjs') argsFormatted.push('--types', 'jsdoc');
	else if (language === 'none') argsFormatted.push('--no-types');

	if (argsFormattedAddons.length > 0) argsFormatted.push('--add', ...argsFormattedAddons);

	common.logArgs(packageManager, 'create', argsFormatted, [directory]);

	await addPnpmBuildDependencies(projectPath, packageManager, ['esbuild']);
	if (packageManager) await installDependencies(packageManager, projectPath);

	return { directory: projectPath, addOnNextSteps, packageManager };
}

async function createProjectFromPlayground(
	url: string,
	cwd: string,
	typescript: boolean
): Promise<void> {
	const urlData = parsePlaygroundUrl(url);
	const playground = await downloadPlaygroundData(urlData);

	// Detect external dependencies and ask for confirmation
	const dependencies = detectPlaygroundDependencies(playground.files);
	const installDependencies = await confirmExternalDependencies(Array.from(dependencies.keys()));

	setupPlaygroundProject(url, playground, cwd, installDependencies, typescript);
}

async function confirmExternalDependencies(dependencies: string[]): Promise<boolean> {
	if (dependencies.length === 0) return false;

	const dependencyList = dependencies.map(pc.yellowBright).join(', ');
	p.log.warn(
		`The following external dependencies were found in the playground:\n\n${dependencyList}`
	);

	const installDeps = await p.confirm({
		message: 'Do you want to install these external dependencies?',
		initialValue: false
	});
	if (p.isCancel(installDeps)) {
		p.cancel('Operation cancelled.');
		process.exit(0);
	}

	return installDeps;
}

interface CreateVirtualWorkspaceOptions {
	cwd: string;
	template: TemplateType;
	type: LanguageType;
}

export async function createVirtualWorkspace({
	cwd,
	template,
	type
}: CreateVirtualWorkspaceOptions): Promise<Workspace> {
	const override: {
		kit?: Workspace['kit'];
		dependencies: Record<string, string>;
	} = { dependencies: {} };

	// These are our default project structure so we know that it's a kit project
	if (template === 'minimal' || template === 'demo' || template === 'library') {
		override.kit = {
			routesDirectory: 'src/routes',
			libDirectory: 'src/lib'
		};
	}

	// Let's read the package.json of the template we will use and add the dependencies to the override
	const templatePackageJsonPath = dist(`templates/${template}`);
	const { data: packageJson } = getPackageJson(templatePackageJsonPath);
	override.dependencies = {
		...packageJson.devDependencies,
		...packageJson.dependencies,
		...override.dependencies
	};

	const tentativeWorkspace = await createWorkspace({ cwd, override });

	const virtualWorkspace: Workspace = {
		...tentativeWorkspace,
		typescript: type === 'typescript',
		files: {
			...tentativeWorkspace.files,
			viteConfig: type === 'typescript' ? commonFilePaths.viteConfigTS : commonFilePaths.viteConfig,
			svelteConfig: commonFilePaths.svelteConfig // currently we always use js files, never typescript files
		}
	};

	return virtualWorkspace;
}
