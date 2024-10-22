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
import { detectSync, type AgentName } from 'package-manager-detector';

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
			const { directory, integrationNextSteps, packageManager } = await createProject(cwd, options);
			const highlight = (str: string) => pc.bold(pc.cyan(str));

			let i = 1;
			const initialSteps: string[] = [];
			const relative = path.relative(process.cwd(), directory);
			const pm = packageManager ?? detectSync({ cwd })?.name ?? common.getUserAgent() ?? 'npm';
			if (relative !== '') {
				const pathWithSpaces = relative.includes(' ');
				initialSteps.push(
					`${i++}: ${highlight(`cd ${pathWithSpaces ? `"${relative}"` : relative}`)}`
				);
			}
			if (!packageManager) {
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

			p.box(steps.join('\n'), 'Project next steps');
			if (integrationNextSteps) p.box(integrationNextSteps, 'Integration next steps');
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

	const projectPath = path.resolve(directory);
	createKit(projectPath, {
		name: path.basename(projectPath),
		template,
		types: language
	});

	p.log.success('Project created');

	let packageManager: AgentName | undefined | null;
	let integrationNextSteps: string | undefined;
	const installDeps = async () => {
		packageManager = await common.packageManagerPrompt(projectPath);
		if (packageManager) await common.installDependencies(packageManager, projectPath);
	};

	if (options.integrations) {
		// `runAddCommand` includes installing dependencies
		const { nextSteps, packageManager: pm } = await runAddCommand(
			{ cwd: projectPath, install: options.install, preconditions: true, community: [] },
			[]
		);
		packageManager = pm;
		integrationNextSteps = nextSteps;
	} else if (options.install) {
		// `--no-integrations` was set, so we'll prompt to install deps manually
		await installDeps();
	}

	// no integrations were selected (which means the install prompt was skipped in `runAddCommand`),
	// so we'll prompt to install
	if (packageManager === null && options.install) {
		await installDeps();
	}

	return { directory: projectPath, integrationNextSteps, packageManager };
}
