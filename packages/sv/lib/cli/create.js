/** @import { OptionValues, ResolvedAddon, Workspace } from '../core.js' */
/** @import { LanguageType, TemplateType } from '../create/index.js' */
import * as p from '@clack/prompts';
import { Command, Option } from 'commander';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { detect, resolveCommand } from 'package-manager-detector';
import pc from 'picocolors';
import * as v from 'valibot';

import { create as createKit, templates } from '../create/index.js';
import {
	detectPlaygroundDependencies,
	downloadPlaygroundData,
	parsePlaygroundUrl,
	setupPlaygroundProject,
	validatePlaygroundUrl
} from '../create/playground.js';
import { dist } from '../create/utils.js';
import {
	addonArgsHandler,
	promptAddonQuestions,
	resolveAddons,
	runAddonsApply,
	sanitizeAddons
} from './add/index.js';
import { commonFilePaths, formatFiles, getPackageJson } from './add/utils.js';
import { createWorkspace } from './add/workspace.js';
import * as common from './utils/common.js';
import {
	AGENT_NAMES,
	addPnpmBuildDependencies,
	getUserAgent,
	installDependencies,
	installOption,
	packageManagerPrompt
} from './utils/package-manager.js';

/** @type {readonly ['ts', 'jsdoc']} */
const langs = ['ts', 'jsdoc'];
/** @type {Record<string, LanguageType | undefined>} */
const langMap = {
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

/**
 * @typedef {v.InferOutput<typeof OptionsSchema>} Options
 */

/**
 * @typedef {v.InferOutput<typeof ProjectPathSchema>} ProjectPath
 */

export const create = new Command('create')
	.description('scaffolds a new SvelteKit project')
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
			/**
			 * @param {string} str
			 */
			const highlight = (str) => pc.bold(pc.cyan(str));

			let i = 1;
			/** @type {string[]} */
			const initialSteps = ['📁 Project steps', ''];
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
				const result = resolveCommand(pm, 'install', []);
				if (result) {
					const { args, command } = result;
					initialSteps.push(`  ${i++}: ${highlight(`${command} ${args.join(' ')}`)}`);
				}
			}

			const runResult = resolveCommand(pm, 'run', ['dev', '--open']);
			if (!runResult) {
				p.log.error('Failed to resolve run command');
				process.exit(1);
			}
			const { args, command } = runResult;
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

/**
 * @param {ProjectPath} cwd
 * @param {Options} options
 */
async function createProject(cwd, options) {
	if (options.fromPlayground) {
		p.log.warn(
			'Svelte maintainers have not reviewed playgrounds for malicious code. Use at your discretion.'
		);
	}

	const { directory, template, language } = await p.group(
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
				if (!directory) return;

				if (!fs.existsSync(directory)) return;

				const files = fs.readdirSync(directory);
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
				if (options.fromPlayground) return Promise.resolve(/** @type {TemplateType} */ ('minimal'));

				// TODO JYC:
				// Don't allow the addon template right now to be displayed in the select list
				const availableTemplates = templates.filter((t) => t.name !== 'addon');
				// Later, we will not allow the addon template to be added via the CLI when "--add" is used
				// const availableTemplates =
				// 	options.add.length > 0 ? templates.filter((t) => t.name !== 'addon') : templates;

				return p.select(
					/** @type {Parameters<typeof p.select<TemplateType>>[0]} */ ({
						message: 'Which template would you like?',
						initialValue: 'minimal',
						options: availableTemplates.map((t) => ({
							label: t.title,
							value: t.name,
							hint: t.description
						}))
					})
				);
			},
			language: (o) => {
				if (options.types) return Promise.resolve(options.types);
				if (o.results.template === 'addon') return Promise.resolve('none');
				return p.select(
					/** @type {Parameters<typeof p.select<LanguageType>>[0]} */ ({
						message: 'Add type checking with TypeScript?',
						initialValue: 'typescript',
						options: [
							{ label: 'Yes, using TypeScript syntax', value: 'typescript' },
							{ label: 'Yes, using JavaScript with JSDoc comments', value: 'checkjs' },
							{ label: 'No', value: 'none' }
						]
					})
				);
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
	const basename = path.basename(projectPath);
	const parentDirName = path.basename(path.dirname(projectPath));
	const projectName = parentDirName.startsWith('@') ? `${parentDirName}/${basename}` : basename;

	/** @type {ResolvedAddon[]} */
	let selectedAddons = [];
	/** @type {Record<string, OptionValues<any>>} */
	let answers = {};
	/** @type {Record<string, string[] | undefined>} */
	let sanitizedAddonsMap = {};

	const workspace = await createVirtualWorkspace({
		cwd: projectPath,
		template,
		type: /** @type {LanguageType} */ (language)
	});

	if (template !== 'addon' && (options.addOns || options.add.length > 0)) {
		const addons = options.add.reduce(addonArgsHandler, []);
		const sanitizedAddons = sanitizeAddons(addons);

		// Resolve all addons (official and community) into a unified structure
		const { resolvedAddons, specifierToId } = await resolveAddons(
			sanitizedAddons,
			projectPath,
			options.downloadCheck
		);

		// Map options from original specifiers to resolved IDs
		sanitizedAddonsMap = {};
		for (const addonArg of sanitizedAddons) {
			const resolvedId = specifierToId.get(addonArg.id) ?? addonArg.id;
			sanitizedAddonsMap[resolvedId] = addonArg.options;
		}

		const result = await promptAddonQuestions({
			options: {
				cwd: projectPath,
				install: false,
				gitCheck: false,
				downloadCheck: options.downloadCheck,
				addons: sanitizedAddonsMap
			},
			selectedAddonIds: Object.keys(sanitizedAddonsMap),
			allAddons: resolvedAddons,
			workspace
		});

		selectedAddons = result.selectedAddons;
		answers = result.answers;
	}

	createKit(projectPath, {
		name: projectName,
		template,
		types: /** @type {LanguageType} */ (language)
	});

	if (options.fromPlayground) {
		await createProjectFromPlayground(options.fromPlayground, projectPath);
	}

	p.log.success('Project created');

	/** @type {string[]} */
	let addOnNextSteps = [];
	/** @type {string[]} */
	let argsFormattedAddons = [];
	/** @type {string[]} */
	let addOnFilesToFormat = [];
	if (template !== 'addon' && (options.addOns || options.add.length > 0)) {
		const {
			nextSteps,
			argsFormattedAddons: argsFormatted,
			filesToFormat
		} = await runAddonsApply({
			answers,
			options: {
				cwd: projectPath,
				// in the create command, we don't want to install dependencies, we want to do it after the project is created
				install: false,
				gitCheck: false,
				downloadCheck: options.downloadCheck,
				addons: sanitizedAddonsMap
			},
			selectedAddons,
			addonSetupResults: undefined,
			workspace,
			fromCommand: 'create'
		});
		argsFormattedAddons = argsFormatted;
		addOnFilesToFormat = filesToFormat;
		addOnNextSteps = nextSteps;
	}

	const packageManager =
		options.install === false
			? null
			: options.install === true
				? await packageManagerPrompt(projectPath)
				: options.install;

	// Build args for next time based on non-default options
	/** @type {string[]} */
	const argsFormatted = [];

	argsFormatted.push('--template', template);

	if (language === 'typescript') argsFormatted.push('--types', 'ts');
	else if (language === 'checkjs') argsFormatted.push('--types', 'jsdoc');
	else if (language === 'none') argsFormatted.push('--no-types');

	if (argsFormattedAddons.length > 0) argsFormatted.push('--add', ...argsFormattedAddons);

	const prompt = common.buildAndLogArgs(packageManager, 'create', argsFormatted, [directory]);
	common.updateReadme(directory, prompt);

	await addPnpmBuildDependencies(projectPath, packageManager, ['esbuild']);
	if (packageManager) {
		await installDependencies(packageManager, projectPath);
		await formatFiles({ packageManager, cwd: projectPath, filesToFormat: addOnFilesToFormat });
	}

	return { directory: projectPath, addOnNextSteps, packageManager };
}

/**
 * @param {string} url
 * @param {string} cwd
 * @returns {Promise<void>}
 */
async function createProjectFromPlayground(url, cwd) {
	const urlData = parsePlaygroundUrl(url);
	const playground = await downloadPlaygroundData(urlData);

	// Detect external dependencies and ask for confirmation
	const dependencies = detectPlaygroundDependencies(playground.files);
	const installDeps = await confirmExternalDependencies(Array.from(dependencies.keys()));

	setupPlaygroundProject(url, playground, cwd, installDeps);
}

/**
 * @param {string[]} dependencies
 * @returns {Promise<boolean>}
 */
async function confirmExternalDependencies(dependencies) {
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

/**
 * @typedef {{
 *   cwd: string;
 *   template: TemplateType;
 *   type: LanguageType;
 * }} CreateVirtualWorkspaceOptions
 */

/**
 * @param {CreateVirtualWorkspaceOptions} options
 * @returns {Promise<Workspace>}
 */
export async function createVirtualWorkspace({ cwd, template, type }) {
	/** @type {{ kit?: Workspace['kit']; dependencies: Record<string, string> }} */
	const override = { dependencies: {} };

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

	/** @type {Workspace} */
	const virtualWorkspace = {
		...tentativeWorkspace,
		language: type === 'typescript' ? 'ts' : 'js',
		files: {
			...tentativeWorkspace.files,
			viteConfig: type === 'typescript' ? commonFilePaths.viteConfigTS : commonFilePaths.viteConfig,
			svelteConfig: commonFilePaths.svelteConfig // currently we always use js files, never typescript files
		}
	};

	return virtualWorkspace;
}
