import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import * as v from 'valibot';
import { Command, Option } from 'commander';
import * as p from '@sveltejs/clack-prompts';
import pc from 'picocolors';
import {
	create as createKit,
	templates,
	type LanguageType,
	type TemplateType
} from '@sveltejs/create';
import * as common from '../common.js';
import { runAddCommand } from './add/index.ts';

const langs = ['typescript', 'checkjs', 'none'] as const;
const templateChoices = templates.map((t) => t.name);
const langOption = new Option('--check-types <lang>', 'add type checking').choices(langs);
const templateOption = new Option('--template <type>', 'template to scaffold').choices(
	templateChoices
);

const ProjectPathSchema = v.string();
const OptionsSchema = v.strictObject({
	checkTypes: v.optional(v.picklist(langs)),
	integrations: v.boolean(),
	install: v.boolean(),
	template: v.optional(v.picklist(templateChoices))
});
type Options = v.InferOutput<typeof OptionsSchema>;

export const create = new Command('create')
	.description('scaffolds a new SvelteKit project')
	.argument('[path]', 'where the project will be created', process.cwd())
	.addOption(langOption)
	.addOption(templateOption)
	.option('--no-integrations', 'skips interactive integration installer')
	.option('--no-install', 'skips installing dependencies')
	.configureHelp(common.helpConfig)
	.action((projectPath, opts) => {
		const cwd = v.parse(ProjectPathSchema, projectPath);
		const options = v.parse(OptionsSchema, opts);
		common.runCommand(async () => {
			const { directory, integrationNextSteps } = await createProject(cwd, options);
			const highlight = (str: string) => pc.bold(pc.cyan(str));

			let i = 1;
			const initialSteps: string[] = [];
			const relative = path.relative(process.cwd(), directory);
			const pm = common.detectPackageManager(cwd);
			if (relative !== '') {
				initialSteps.push(`${i++}: ${highlight(`cd ${relative}`)}`);
			}
			if (!common.packageManager) {
				initialSteps.push(`${i++}: ${highlight(`${pm} install`)}`);
			}

			const steps = [
				...initialSteps,
				`${i++}: ${highlight('git init && git add -A && git commit -m "Initial commit"')} (optional)`,
				`${i++}: ${highlight(`${pm} run dev -- --open`)}`,
				'',
				`To close the dev server, hit ${highlight('Ctrl-C')}`,
				'',
				`Stuck? Visit us at ${pc.cyan('https://svelte.dev/chat')}`
			];

			if (integrationNextSteps) p.box(integrationNextSteps, 'Integration next steps');
			p.box(steps.join('\n'), 'Project next steps');
		});
	});

async function createProject(cwd: string, options: Options) {
	const { directory, template, language } = await p.group(
		{
			directory: () => {
				const relativePath = path.relative(process.cwd(), cwd);
				if (relativePath) return Promise.resolve(relativePath);
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
			language: () => {
				if (options.checkTypes) return Promise.resolve(options.checkTypes);
				return p.select<LanguageType>({
					message: 'Add type checking with Typescript?',
					initialValue: 'typescript',
					options: [
						{ label: 'Yes, using Typescript syntax', value: 'typescript' },
						{ label: 'Yes, using Javascript with JSDoc comments', value: 'checkjs' },
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

	const initSpinner = p.spinner();
	initSpinner.start('Initializing template');

	const projectPath = path.resolve(directory);
	createKit(projectPath, {
		name: path.basename(projectPath),
		template,
		types: language
	});

	initSpinner.stop('Project created');

	let integrationNextSteps;
	if (options.integrations) {
		const { nextSteps } = await runAddCommand(
			{ cwd: projectPath, install: false, preconditions: true, community: [] },
			[]
		);
		integrationNextSteps = nextSteps;
	}
	// show install prompt even if no integrations are selected
	if (options.install) {
		// `runAddCommand` includes the installing dependencies prompt. if it's skipped,
		// then we'll prompt to install dependencies here
		await common.suggestInstallingDependencies(projectPath);
	}

	return { directory: projectPath, integrationNextSteps };
}
