import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import * as v from 'valibot';
import { Command, Option } from 'commander';
import * as p from '@clack/prompts';
import pc from 'picocolors';
import {
	create as createKit,
	templates,
	type LanguageType,
	type TemplateType
} from '@sveltejs/create';
import * as common from '../utils/common.ts';
import { runAddCommand } from './add/index.ts';
import { detect, resolveCommand, type AgentName } from 'package-manager-detector';
import {
	addPnpmBuildDependencies,
	AGENT_NAMES,
	getUserAgent,
	installDependencies,
	installOption,
	packageManagerPrompt
} from '../utils/package-manager.ts';

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

const ProjectPathSchema = v.optional(v.string());
const OptionsSchema = v.strictObject({
	types: v.pipe(
		v.optional(v.union([v.picklist(langs), v.boolean()])),
		v.transform((lang) => langMap[String(lang)])
	),
	addOns: v.boolean(),
	install: v.union([v.boolean(), v.picklist(AGENT_NAMES)]),
	template: v.optional(v.picklist(templateChoices))
});
type Options = v.InferOutput<typeof OptionsSchema>;
type ProjectPath = v.InferOutput<typeof ProjectPathSchema>;

export const create = new Command('create')
	.description('scaffolds a new SvelteKit project')
	.argument('[path]', 'where the project will be created')
	.addOption(templateOption)
	.addOption(langOption)
	.option('--no-types')
	.option('--no-add-ons', 'skips interactive add-on installer')
	.option('--no-install', 'skip installing dependencies')
	.addOption(installOption)
	.configureHelp(common.helpConfig)
	.action((projectPath, opts) => {
		const cwd = v.parse(ProjectPathSchema, projectPath);
		const options = v.parse(OptionsSchema, opts);
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
	});

async function createProject(cwd: ProjectPath, options: Options) {
	const { directory, template, language } = await p.group(
		{
			directory: () => {
				if (cwd) {
					return Promise.resolve(path.resolve(cwd));
				}
				const defaultPath = './';
				return p.text({
					message: 'Where would you like your project to be created?',
					placeholder: `  (hit Enter to use '${defaultPath}')`,
					defaultValue: defaultPath
				});
			},
			force: async ({ results: { directory } }) => {
				if (
					fs.existsSync(directory!) &&
					fs.readdirSync(directory!).filter((x) => !x.startsWith('.git')).length > 0
				) {
					const force = await p.confirm({
						message: 'Directory not empty. Continue?',
						initialValue: false
					});
					if (p.isCancel(force) || !force) {
						p.cancel('Exiting.');
						process.exit(0);
					}
				}
			},
			template: () => {
				if (options.template) return Promise.resolve(options.template);
				return p.select<TemplateType>({
					message: 'Which template would you like?',
					initialValue: 'minimal',
					options: templates.map((t) => ({ label: t.title, value: t.name, hint: t.description }))
				});
			},
			language: (o) => {
				if (options.types) return Promise.resolve(options.types);
				if (o.results.template === 'addon') return Promise.resolve('none'); // TODO JYC
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
	createKit(projectPath, {
		name: path.basename(projectPath),
		template,
		types: language as LanguageType // TODO JYC not sure why?!
	});

	p.log.success('Project created');

	let packageManager: AgentName | undefined | null;
	let addOnNextSteps: string[] = [];

	const installDeps = async (install: true | AgentName) => {
		packageManager = install === true ? await packageManagerPrompt(projectPath) : install;
		addPnpmBuildDependencies(projectPath, packageManager, ['esbuild']);
		if (packageManager) await installDependencies(packageManager, projectPath);
	};

	// TODO JYC: no add-ons for addon template
	if (options.addOns && options.template !== 'addon') {
		// `runAddCommand` includes installing dependencies
		const { nextSteps, packageManager: pm } = await runAddCommand(
			{
				cwd: projectPath,
				install: options.install,
				gitCheck: false,
				community: [],
				addons: {}
			},
			[]
		);
		packageManager = pm;
		addOnNextSteps = nextSteps;
	} else if (options.install) {
		// `--no-add-ons` was set, so we'll prompt to install deps manually
		await installDeps(options.install);
	}

	// no add-ons were selected (which means the install prompt was skipped in `runAddCommand`),
	// so we'll prompt to install
	if (packageManager === null && options.install) {
		await installDeps(options.install);
	}

	return { directory: projectPath, addOnNextSteps, packageManager };
}
