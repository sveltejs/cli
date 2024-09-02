import fs from 'node:fs';
import path from 'node:path';
import * as v from 'valibot';
import { Command, Option } from 'commander';
import * as p from '@svelte-cli/clack-prompts';
import {
	create as createKit,
	templates,
	type LanguageType,
	type TemplateType
} from '@svelte-cli/create';
import { runCommand } from '../common.js';
import { runAddCommand } from './add.js';

const langs = ['typescript', 'checkjs', 'none'] as const;
const templateChoices = templates.map((t) => t.name);
const langOption = new Option('--check-types <lang>', 'add type checking').choices(langs);
const templateOption = new Option('--template <type>', 'template to scaffold').choices(
	templateChoices
);

const ProjectPathSchema = v.string();
const OptionsSchema = v.strictObject({
	checkTypes: v.optional(v.picklist(langs)),
	adders: v.boolean(),
	template: v.optional(v.picklist(templateChoices))
});
type Options = v.InferOutput<typeof OptionsSchema>;

export const create = new Command('create')
	.description('scaffolds a new SvelteKit project')
	.argument('[path]', 'where the project will be created', process.cwd())
	.addOption(langOption)
	.addOption(templateOption)
	.option('--no-adders', 'skips interactive adder installer')
	.action((projectPath, opts) => {
		const cwd = v.parse(ProjectPathSchema, projectPath);
		const options = v.parse(OptionsSchema, opts);
		runCommand(async () => {
			await createProject(cwd, options);
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
				if (fs.existsSync(directory!) && fs.readdirSync(directory!).length > 0) {
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
					message: 'Which Svelte app template',
					initialValue: 'demo',
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

	if (options.adders) {
		await runAddCommand(
			{ cwd: projectPath, default: false, install: true, preconditions: true, community: [] },
			[]
		);
	}

	return {
		directory: projectPath
	};
}
