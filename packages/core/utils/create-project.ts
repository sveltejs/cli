import path from 'node:path';
import { commonFilePaths, directoryExists, fileExists } from '../files/utils';
import { booleanPrompt, selectPrompt, textPrompt, endPrompts } from './prompts';
import { getPackageJson } from './common';
import { createEmptyWorkspace } from './workspace';
import { spinner } from '@svelte-cli/clack-prompts';
import { create, type TemplateType, type LanguageType } from '@svelte-cli/create';

export async function detectSvelteDirectory(directoryPath: string): Promise<string | null> {
	if (!directoryPath) return null;

	const packageJsonPath = path.join(directoryPath, commonFilePaths.packageJsonFilePath);
	const parentDirectoryPath = path.normalize(path.join(directoryPath, '..'));
	const isRoot = parentDirectoryPath == directoryPath;

	if (!isRoot && !(await directoryExists(directoryPath))) {
		return await detectSvelteDirectory(parentDirectoryPath);
	}

	if (!isRoot && !(await fileExists(packageJsonPath))) {
		return await detectSvelteDirectory(parentDirectoryPath);
	}

	if (isRoot && !(await fileExists(packageJsonPath))) {
		return null;
	}

	const emptyWorkspace = createEmptyWorkspace();
	emptyWorkspace.cwd = directoryPath;
	const { data: packageJson } = await getPackageJson(emptyWorkspace);

	if (packageJson.devDependencies && 'svelte' in packageJson.devDependencies) {
		return directoryPath;
	} else if (!isRoot) {
		return await detectSvelteDirectory(parentDirectoryPath);
	}

	return null;
}

export async function createProject(cwd: string): Promise<{
	projectCreated: boolean;
	directory: string;
}> {
	const createNewProject = await booleanPrompt('Create new Project?', true);
	if (!createNewProject) {
		endPrompts('Exiting.');
		process.exit(0);
	}

	let relativePath = path.relative(process.cwd(), cwd);
	if (!relativePath) {
		relativePath = './';
	}

	let directory = await textPrompt(
		'Where should we create your project?',
		`  (hit Enter to use '${relativePath}')`
	);
	if (!directory) {
		directory = relativePath;
	}

	const template = await selectPrompt<TemplateType>('Which Svelte app template', 'default', [
		{
			label: 'SvelteKit demo app',
			value: 'default',
			hint: 'A demo app showcasing some of the features of SvelteKit - play a word guessing game that works without JavaScript!'
		},
		{
			label: 'Skeleton project',
			value: 'skeleton',
			hint: 'Barebones scaffolding for your new SvelteKit app'
		},
		{
			label: 'Library project',
			value: 'skeletonlib',
			hint: '(Barebones scaffolding for your new Svelte library'
		}
	]);

	const language: LanguageType = await selectPrompt(
		'Add type checking with Typescript?',
		'typescript',
		[
			{ label: 'Yes, using Typescript syntax', value: 'typescript' },
			{ label: 'Yes, using Javascript with JSDoc comments', value: 'checkjs' },
			{ label: 'No', value: null }
		]
	);

	const loadingSpinner = spinner();
	loadingSpinner.start('Initializing template');

	try {
		create(directory, {
			name: path.basename(path.resolve(directory)),
			template,
			types: language
		});
	} catch (error) {
		loadingSpinner.stop('Failed initializing template!');
		const typedError = error as Error;
		console.log('cancelled or failed ' + typedError.message);
		return { projectCreated: false, directory: '' };
	}

	loadingSpinner.stop('Project created');

	return {
		projectCreated: true,
		directory: path.join(process.cwd(), directory)
	};
}
