import { execSync, spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import tiged from 'tiged';
import terminate from 'terminate';
import { create, createOrUpdateFiles, createWorkspace, installPackages } from 'sv';
import { type OptionValues, type Question } from '@sveltejs/cli-core';
import { startBrowser } from './browser.ts';
import type { AdderWithTests } from './index.ts';

export type TestCase = {
	testName: string;
	template: string;
	adder: AdderWithTests;
	options: OptionValues<Record<string, Question>>;
	cwd: string;
};

export const ProjectTypes = {
	Svelte_JS: 'svelte-js',
	Svelte_TS: 'svelte-ts',
	Kit_JS: 'kit-js',
	Kit_JS_Comments: 'kit-js-comments',
	Kit_TS: 'kit-ts'
};
export const ProjectTypesList: string[] = Object.values(ProjectTypes);

export async function forceKill(devServer: ChildProcessWithoutNullStreams): Promise<void> {
	return new Promise((resolve) => {
		if (!devServer.pid) return;

		// just killing the process was not enough, because the process itself
		// spawns child process, that also need to be killed!
		terminate(devServer.pid, () => {
			resolve();
		});
	});
}

export async function downloadProjectTemplates(outputPath: string): Promise<void> {
	for (const templateType of ProjectTypesList) {
		const templateOutputPath = path.join(outputPath, templateType);

		if (templateType.includes('kit')) {
			create(templateOutputPath, {
				name: templateType,
				template: 'minimal',
				types:
					templateType == ProjectTypes.Kit_TS
						? 'typescript'
						: templateType == ProjectTypes.Kit_JS_Comments
							? 'checkjs'
							: 'none'
			});
		} else {
			const templateName =
				templateType == ProjectTypes.Svelte_TS ? 'template-svelte-ts' : 'template-svelte';

			const emitter = tiged(`vitejs/vite/packages/create-vite/${templateName}`, {
				cache: false,
				force: true,
				verbose: false
			});

			await emitter.clone(templateOutputPath);
		}
	}
}

export async function startDevServer(
	output: string,
	command: string
): Promise<{ url: string; devServer: ChildProcessWithoutNullStreams }> {
	try {
		const program = spawn('pnpm', ['run', command], { stdio: 'pipe', shell: true, cwd: output });

		return await new Promise((resolve) => {
			program.stdout?.on('data', (data: Buffer) => {
				const value = data.toString();

				// extract dev server url from console output
				const regexUnicode = /[^\x20-\xaf]+/g;
				const withoutUnicode = value.replace(regexUnicode, '');

				const regexUnicodeDigits = /\[[0-9]{1,2}m/g;
				const withoutColors = withoutUnicode.replace(regexUnicodeDigits, '');

				const regexUrl = /http:\/\/[^:\s]+:[0-9]+\//g;
				const urls = withoutColors.match(regexUrl);

				if (urls && urls.length > 0) {
					const url = urls[0];
					resolve({ url, devServer: program });
				}
			});
		});
	} catch (error) {
		const typedError = error as Error;
		throw new Error('Failed to start dev server' + typedError.message);
	}
}

export async function stopDevServer(devServer: ChildProcessWithoutNullStreams): Promise<void> {
	if (!devServer.pid) return;

	await forceKill(devServer);
}

export function generateTestCases(
	adders: AdderWithTests[],
	addersOutputPath: string,
	options: { ignoreEmptyTests: boolean }
): Map<string, TestCase[]> {
	const testCases = new Map<string, TestCase[]>();
	for (const adder of adders) {
		const adderId = adder.config.id;
		const adderTestCases: TestCase[] = [];
		const testData = adder.tests;
		if (!testData || !testData.tests || (options.ignoreEmptyTests && testData.tests.length == 0))
			continue;

		for (const template of ProjectTypesList) {
			const environments = adder.config.environments;
			if (
				(!environments.kit && template.includes('kit')) ||
				(!environments.svelte && template.includes('svelte'))
			) {
				continue;
			}

			const optionsCombinations = testData.optionValues;
			// if list if empty, add empty options so that one testcase gets run
			if (optionsCombinations.length == 0) optionsCombinations.push({});

			for (const options of optionsCombinations) {
				let optionDirectoryName = Object.entries(options)
					.map(([key, value]) => `${key}=${value}`)
					.join('+');
				if (!optionDirectoryName) optionDirectoryName = 'default';
				const cwd = path.join(addersOutputPath, adderId, template, optionDirectoryName);
				const testName = `${adder.config.id} / ${template} / ${JSON.stringify(options)}`;

				const testCase: TestCase = {
					testName,
					adder,
					options,
					template,
					cwd
				};

				adderTestCases.push(testCase);
			}
		}

		testCases.set(adderId, adderTestCases);
	}
	return testCases;
}

export async function prepareEndToEndTests(
	outputPath: string,
	templatesPath: string,
	addersPath: string,
	adders: AdderWithTests[],
	testCases: Map<string, TestCase[]>
): Promise<void> {
	console.log('deleting old files');
	// only delete adders and templates directory. Trying to delete `node_modules`
	// typically fails because some `esbuild` binary is locked
	fs.rmSync(addersPath, { recursive: true, force: true });
	fs.rmSync(templatesPath, { recursive: true, force: true });

	fs.mkdirSync(outputPath, { recursive: true });

	console.log('downloading project templates');
	await downloadProjectTemplates(templatesPath);

	const dirs: string[] = [];
	for (const type of Object.values(ProjectTypes)) {
		dirs.push(...adders.map((a) => `  - 'adders/${a.config.id}/${type}/*'`));
	}

	const pnpmWorkspace = `packages:\n${dirs.join('\n')}\n`;
	fs.writeFileSync(path.join(outputPath, 'pnpm-workspace.yaml'), pnpmWorkspace, {
		encoding: 'utf8'
	});

	const testRootPkgJson = JSON.stringify({ name: 'test-root', version: '0.0.0', type: 'module' });
	fs.writeFileSync(path.join(outputPath, 'package.json'), testRootPkgJson, {
		encoding: 'utf8'
	});

	console.log('executing adders');
	for (const adderTestCases of testCases.values()) {
		const applyAdderTasks = [];
		for (const testCase of adderTestCases) {
			fs.mkdirSync(testCase.cwd, { recursive: true });

			// copy template into working directory
			const templatePath = path.join(templatesPath, testCase.template);
			fs.cpSync(templatePath, testCase.cwd, { recursive: true });

			applyAdderTasks.push(runAdder(testCase.adder, testCase.cwd, testCase.options, adders));
		}

		await Promise.all(applyAdderTasks);
	}

	console.log('preparing test files');
	for (const adderTestCases of testCases.values()) {
		for (const testCase of adderTestCases) {
			const workspace = createWorkspace({ cwd: testCase.cwd });
			workspace.options = testCase.options;
			createOrUpdateFiles(testCase.adder.tests?.files ?? [], workspace);
		}
	}

	console.log('installing dependencies');
	execSync('pnpm install', { cwd: outputPath, stdio: 'pipe' });

	await startBrowser();

	console.log('start testing');
}

export async function prepareSnaphotTests(
	outputPath: string,
	templatesPath: string,
	addersPath: string,
	testCases: Map<string, TestCase[]>
): Promise<void> {
	console.log('deleting old files');
	// only delete adders and templates directory. Trying to delete `node_modules`
	// typically fails because some `esbuild` binary is locked
	fs.rmSync(addersPath, { recursive: true, force: true });
	fs.rmSync(templatesPath, { recursive: true, force: true });

	fs.mkdirSync(outputPath, { recursive: true });

	console.log('downloading project templates');
	await downloadProjectTemplates(templatesPath);

	console.log('preparing adder templates');
	// create all relevant directories with the templates
	for (const adderTestCases of testCases.values()) {
		for (const testCase of adderTestCases) {
			fs.mkdirSync(testCase.cwd, { recursive: true });

			// copy template into working directory
			const templatePath = path.join(templatesPath, testCase.template);
			fs.cpSync(templatePath, testCase.cwd, { recursive: true });
		}
	}
}

export function runAdder(
	adder: AdderWithTests,
	cwd: string,
	options: OptionValues<Record<string, Question>>,
	adders: AdderWithTests[]
): Set<string> {
	const { config } = adder;
	const workspace = createWorkspace({ cwd });

	workspace.options = options;

	const filesToFormat = new Set<string>();

	// execute adders
	if (config.dependsOn) {
		for (const dependencyAdderId of config.dependsOn) {
			const dependencyAdder = adders.find((x) => x.config.id == dependencyAdderId);

			if (!dependencyAdder)
				throw new Error(
					`failed to find required dependency '${dependencyAdderId}' of adder ${adder.config.id}`
				);

			// apply default adder options
			const options: Record<string, any> = {};
			for (const [key, question] of Object.entries(dependencyAdder.config.options)) {
				options[key] = question.default;
			}

			runAdder(dependencyAdder, cwd, options as OptionValues<Record<string, Question>>, adders);
		}
	}

	const pkgPath = installPackages(config, workspace);
	filesToFormat.add(pkgPath);
	const changedFiles = createOrUpdateFiles(config.files, workspace);
	changedFiles.forEach((file) => filesToFormat.add(file));

	if (config.scripts && config.scripts.length > 0) {
		for (const script of config.scripts) {
			if (script.condition?.(workspace) === false) continue;

			try {
				execSync('pnpx ' + script.args.join(' '), {
					cwd: workspace.cwd,
					stdio: 'pipe'
				});
			} catch (error) {
				const typedError = error as Error;
				throw new Error(`Failed to execute scripts '${script.description}': ` + typedError.message);
			}
		}
	}

	return filesToFormat;
}
