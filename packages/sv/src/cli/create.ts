import * as p from '@clack/prompts';
import { color, resolveCommandArray, commonFilePaths, getPackageJson } from '@sveltejs/sv-utils';
import { Command, Option } from 'commander';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import * as v from 'valibot';
import * as common from '../core/common.ts';
import type { LoadedAddon, OptionValues, SetupResult } from '../core/config.ts';
import { formatFiles } from '../core/formatFiles.ts';
import {
	AGENT_NAMES,
	addPnpmBuildDependencies,
	detectPackageManager,
	installDependencies,
	installOption,
	packageManagerPrompt
} from '../core/package-manager.ts';
import { createWorkspace, type Workspace } from '../core/workspace.ts';
import {
	type LanguageType,
	type TemplateType,
	create as createKit,
	templates
} from '../create/index.ts';
import {
	detectPlaygroundDependencies,
	downloadPlaygroundData,
	parsePlaygroundUrl,
	setupPlaygroundProject,
	validatePlaygroundUrl
} from '../create/playground.ts';
import { dist } from '../create/utils.ts';
import {
	addonArgsHandler,
	classifyAddons,
	formatAddonHelpSection,
	promptAddonQuestions,
	resolveAddons,
	runAddonsApply,
	getNextSteps
} from './add.ts';

const langs = ['ts', 'jsdoc'] as const;
const langMap: Record<string, LanguageType> = {
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
const addOption = new Option(
	'--add <addon...>',
	'add-ons to include (see Add-Ons section below)'
).default([]);
export const noDownloadCheckOption = new Option(
	'--no-download-check',
	'skip all download confirmation prompts'
);
export const noInstallOption = new Option('--no-install', 'skip installing dependencies');

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
	dirCheck: v.boolean(),
	downloadCheck: v.boolean()
});
type Options = v.InferOutput<typeof OptionsSchema>;
type ProjectPath = v.InferOutput<typeof ProjectPathSchema>;

export const create = new Command('create')
	.description('Scaffold a new project (--add to include add-ons)')
	.argument('[path]', 'where the project will be created')
	.addOption(templateOption)
	.addOption(langOption)
	.option('--no-types')
	.addOption(noAddonsOption)
	.addOption(addOption)
	.addOption(noInstallOption)
	.option('--from-playground <url>', 'create a project from the svelte playground')
	.option('--no-dir-check', 'even if the folder is not empty, no prompt will be shown')
	.addOption(noDownloadCheckOption)
	.addOption(installOption)
	.configureHelp({
		...common.helpConfig,
		formatHelp(cmd, helper) {
			const s = common.getHelpSections(cmd, helper);

			const addonSection = formatAddonHelpSection({
				styleTitle: s.styleTitle,
				formatItem: (term, desc) =>
					s.formatItem(helper.styleArgumentTerm(term), helper.styleArgumentDescription(desc))
			});

			return [
				...s.usage,
				...s.description,
				...s.arguments,
				...s.options,
				...addonSection,
				s.styleTitle('Non-interactive usage:'),
				'  Provide --template, --types, --add, and --install (or --no-install) to skip prompts entirely.',
				'  Note: --add and --no-add-ons cannot be used together.',
				'',
				s.styleTitle('Examples:'),
				'  sv create my-app --template minimal --types ts --add prettier eslint --install pnpm',
				'  sv create my-app --template minimal --types ts --add prettier vitest="usages:unit" tailwindcss="plugins:none" --install pnpm',
				'  sv create my-app --template minimal --types ts --add drizzle="database:postgresql+client:postgres.js" --no-install',
				''
			].join('\n');
		}
	})
	.action((projectPath, opts) => {
		const cwd = v.parse(ProjectPathSchema, projectPath);
		const options = v.parse(OptionsSchema, opts);

		if (options.fromPlayground && !validatePlaygroundUrl(options.fromPlayground)) {
			console.error(color.error(`Error: Invalid playground URL: ${options.fromPlayground}`));
			process.exit(1);
		}

		common.runCommand(async () => {
			const { directory, addOnNextSteps, packageManager } = await createProject(cwd, options);

			let i = 1;
			const initialSteps: string[] = ['📁 Project steps', ''];
			const relative = path.relative(process.cwd(), directory);
			const pm = packageManager ?? (await detectPackageManager(directory));
			if (relative !== '') {
				const pathHasSpaces = relative.includes(' ');
				initialSteps.push(
					`  ${i++}: ${color.command(`cd ${pathHasSpaces ? `"${relative}"` : relative}`)}`
				);
			}
			if (!packageManager) {
				initialSteps.push(`  ${i++}: ${color.command(resolveCommandArray(pm, 'install', []))}`);
			}

			const steps = [
				...initialSteps,
				`  ${i++}: ${color.command(resolveCommandArray(pm, 'run', ['dev', '--open']))}`,
				'',
				`To close the dev server, hit ${color.command('Ctrl-C')}`
			];

			if (addOnNextSteps.length > 0) {
				steps.push('', '🧩 Add-on steps', '');
				for (const step of addOnNextSteps) {
					const indented = step.replaceAll('  -', '    -');
					steps.push(`  ${indented}`);
				}
			}

			steps.push('', `Stuck? Visit us at ${color.website('https://svelte.dev/chat')}`);

			p.note(steps.join('\n'), "What's next?", { format: (line) => line });
		});
	})
	.showHelpAfterError(true);

async function createProject(cwd: ProjectPath, options: Options) {
	if (options.fromPlayground) {
		p.log.warn(
			'Svelte maintainers have not reviewed playgrounds for malicious code. Use at your discretion.'
		);
	}

	const promptGroupResult = await p.group(
		{
			directory: () => {
				const defaultPath = './';
				if (cwd) {
					return Promise.resolve(common.normalizePosix(cwd));
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

				// TODO JYC:
				// Don't allow the addon template right now to be displayed in the select list
				const availableTemplates = templates.filter((t) => t.name !== 'addon');
				// Later, we will not allow the addon template to be added via the CLI when "--add" is used
				// const availableTemplates =
				// 	options.add.length > 0 ? templates.filter((t) => t.name !== 'addon') : templates;

				return p.select<TemplateType>({
					message: 'Which template would you like?',
					initialValue: 'minimal',
					options: availableTemplates.map((t) => ({
						label: t.title,
						value: t.name,
						hint: t.description
					}))
				});
			},
			language: (o) => {
				if (options.types) return Promise.resolve(options.types);
				if (o.results.template === 'addon') return Promise.resolve<LanguageType>('none');
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
	const { directory, template } = promptGroupResult;
	// this is needed, otherwise, language is unknown
	const language = promptGroupResult.language as LanguageType;

	const projectPath = path.resolve(directory);
	const basename = path.basename(projectPath);
	const parentDirName = path.basename(path.dirname(projectPath));
	let projectName = parentDirName.startsWith('@') ? `${parentDirName}/${basename}` : basename;

	if (template === 'addon' && !projectName.startsWith('@')) {
		// At this stage, we don't support un-scoped add-ons
		// FYI: a demo exists for `npx sv add my-cool-addon`
		const org = await p.text({
			message: `Community add-ons must be published under an npm org. Enter the name of your npm org:`,
			placeholder: '  @my-org',
			validate: (value) => {
				if (!value) return 'Organization name is required';
				if (!value.startsWith('@')) return 'Must start with @';
				if (value.includes('/')) return 'Just the org, not the full package name';
			}
		});
		if (p.isCancel(org)) {
			p.cancel('Operation cancelled.');
			process.exit(0);
		}
		projectName = `${org}/${basename}`;
	}

	if (template === 'addon' && options.add.length > 0) {
		common.errorAndExit(
			`The ${color.command('--add')} flag cannot be used with the ${color.command('addon')} template.`
		);
	}

	let loadedAddons: LoadedAddon[] = [];
	let answers: Record<string, OptionValues<any>> = {};
	let addonsOptionsMap: Record<string, string[] | undefined> = {};

	const workspace = await createVirtualWorkspace({
		cwd: projectPath,
		template,
		type: language
	});

	if (template !== 'addon' && (options.addOns || options.add.length > 0)) {
		const addonInputs = options.add.reduce(addonArgsHandler, []);
		const addonRefs = classifyAddons(addonInputs, projectPath);

		// Resolve all addons (official and community) - returns LoadedAddon[]
		loadedAddons = await resolveAddons(addonRefs, options.downloadCheck);

		// Map options from loaded addons to resolved IDs
		addonsOptionsMap = {};
		for (const loaded of loadedAddons) {
			addonsOptionsMap[loaded.addon.id] = loaded.reference.options;
		}

		const result = await promptAddonQuestions({
			options: {
				cwd: projectPath,
				install: false,
				gitCheck: false,
				downloadCheck: options.downloadCheck,
				addons: addonsOptionsMap
			},
			loadedAddons,
			workspace
		});

		loadedAddons = result.loadedAddons;
		answers = result.answers;
	}

	createKit(projectPath, {
		name: projectName,
		template,
		types: language
	});

	if (options.fromPlayground) {
		await createProjectFromPlayground(options.fromPlayground, projectPath);
	}

	p.log.success('Project created');

	let argsFormattedAddons: string[] = [];
	let addOnFilesToFormat: string[] = [];
	let addOnSuccessfulAddons: LoadedAddon[] = [];
	let addonSetupResults: Record<string, SetupResult> = {};
	if (template !== 'addon' && (options.addOns || options.add.length > 0)) {
		const {
			argsFormattedAddons: argsFormatted,
			filesToFormat,
			successfulAddons,
			setupResults
		} = await runAddonsApply({
			answers,
			options: {
				cwd: projectPath,
				// in the create command, we don't want to install dependencies, we want to do it after the project is created
				install: false,
				gitCheck: false,
				downloadCheck: options.downloadCheck,
				addons: addonsOptionsMap
			},
			loadedAddons,
			setupResults: undefined,
			workspace,
			fromCommand: 'create'
		});
		argsFormattedAddons = argsFormatted;
		addOnFilesToFormat = filesToFormat;
		addOnSuccessfulAddons = successfulAddons;
		addonSetupResults = setupResults;
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

	const prompt = common.buildAndLogArgs(packageManager, 'create', argsFormatted, [directory]);
	common.insertPrompt(directory, prompt);
	if (fs.existsSync(path.join(directory, '.env.example'))) common.insertEnvMsg(directory);

	common.updateAgent(directory, language, packageManager ?? 'npm', loadedAddons);

	if (packageManager) {
		workspace.packageManager = packageManager;
	}
	const addOnNextSteps = getNextSteps(addOnSuccessfulAddons, workspace, answers, addonSetupResults);

	await addPnpmBuildDependencies(projectPath, packageManager, ['esbuild']);
	if (packageManager) {
		await installDependencies(packageManager, projectPath);
		await formatFiles({ packageManager, cwd: projectPath, filesToFormat: addOnFilesToFormat });
	}

	return { directory: projectPath, addOnNextSteps, packageManager };
}

async function createProjectFromPlayground(url: string, cwd: string): Promise<void> {
	const urlData = parsePlaygroundUrl(url);
	const playground = await downloadPlaygroundData(urlData);

	// Detect external dependencies and ask for confirmation
	const dependencies = detectPlaygroundDependencies(playground.files);
	const installDependencies = await confirmExternalDependencies(Array.from(dependencies.keys()));

	setupPlaygroundProject(url, playground, cwd, installDependencies);
}

async function confirmExternalDependencies(dependencies: string[]): Promise<boolean> {
	if (dependencies.length === 0) return false;

	const dependencyList = dependencies.map(color.warning).join(', ');
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
		isKit?: boolean;
		directory?: Workspace['directory'];
		dependencies: Record<string, string>;
	} = { dependencies: {} };

	// These are our default project structure so we know that it's a kit project
	if (template === 'minimal' || template === 'demo' || template === 'library') {
		override.isKit = true;
		override.directory = {
			src: 'src',
			lib: 'src/lib',
			kitRoutes: 'src/routes'
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
		language: type === 'typescript' ? 'ts' : 'js',
		file: {
			...tentativeWorkspace.file,
			viteConfig: type === 'typescript' ? commonFilePaths.viteConfigTS : commonFilePaths.viteConfig,
			svelteConfig: commonFilePaths.svelteConfig // currently we always use js files, never typescript files
		}
	};

	return virtualWorkspace;
}
