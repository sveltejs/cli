import type { AdderWithoutExplicitArgs, OptionValues, Question } from '@svelte-cli/core';
import path from 'node:path';
import fs from 'node:fs';
import { createOrUpdateFiles, createWorkspace, installPackages } from '@svelte-cli/core/internal';
import { execSync } from 'node:child_process';
import { runTests } from './tests.ts';
import { openPage, startBrowser, stopBrowser } from './browser.ts';
import {
	downloadProjectTemplates,
	ProjectTypes,
	ProjectTypesList,
	startDevServer,
	stopDevServer
} from './utils.ts';

type TestCase = {
	testName: string;
	template: string;
	adder: AdderWithoutExplicitArgs;
	options: OptionValues<Record<string, Question>>;
	cwd: string;
};

export function runEndToEndTests(
	outputDirectory: string,
	adders: AdderWithoutExplicitArgs[],
	describe: (name: string, testFactory: () => void) => void,
	test: (name: string, testFunction: () => Promise<void> | void) => void,
	beforeAll: (fn: () => void) => void,
	afterAll: (fn: () => void) => void
) {
	const noop = () => {};
	const outputPath = path.join(process.cwd(), outputDirectory);
	const templatesPath = path.join(outputPath, 'templates');
	const addersOutputPath = path.join(outputPath, 'adders');
	const testCases = generateTestCases(adders, addersOutputPath);

	beforeAll(async () => {
		await prepareTests(outputPath, templatesPath, addersOutputPath, adders, testCases);
	});

	for (const [adderId, adderTestCases] of testCases) {
		describe(adderId, () => {
			const adder = adders.find((x) => x.config.metadata.id == adderId)!;
			const adderTestDetails = adder.tests!;
			beforeAll(adderTestDetails.beforeAll ?? noop);

			for (const testCase of adderTestCases) {
				test(testCase.testName, async () => {
					await executeAdderTests(testCase.cwd, testCase.adder, testCase.options);
				});
			}

			afterAll(adderTestDetails.afterAll ?? noop);
		});
	}

	afterAll(async () => {
		await stopBrowser();
	});
}

function generateTestCases(adders: AdderWithoutExplicitArgs[], addersOutputPath: string) {
	const testCases = new Map<string, TestCase[]>();
	for (const adder of adders) {
		const adderId = adder.config.metadata.id;
		const adderTestCases: TestCase[] = [];
		const testData = adder.tests;
		if (!testData || !testData.tests || testData.tests.length == 0) continue;

		for (const template of ProjectTypesList) {
			const environments = adder.config.metadata.environments;
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
				const testName = `${adder.config.metadata.id} / ${template} / ${JSON.stringify(options)}`;

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

async function prepareTests(
	outputPath: string,
	templatesPath: string,
	addersPath: string,
	adders: AdderWithoutExplicitArgs[],
	testCases: Map<string, TestCase[]>
) {
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
		dirs.push(...adders.map((a) => `  - 'adders/${a.config.metadata.id}/${type}/*'`));
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

			applyAdderTasks.push(runAdder(testCase.adder, testCase.cwd, testCase.options));
		}

		await Promise.all(applyAdderTasks);
	}

	for (const adderTestCases of testCases.values()) {
		for (const testCase of adderTestCases) {
			const workspace = createWorkspace(testCase.cwd);
			workspace.options = testCase.options;
			createOrUpdateFiles(testCase.adder.tests?.files ?? [], workspace);
		}
	}

	console.log('installing dependencies');
	execSync('pnpm install', { cwd: outputPath, stdio: 'pipe' });

	await startBrowser();

	console.log('start testing');
}

function runAdder(
	adder: AdderWithoutExplicitArgs,
	cwd: string,
	options: OptionValues<Record<string, Question>>
) {
	const { config } = adder;
	const workspace = createWorkspace(cwd);

	workspace.options = options;

	const filesToFormat = new Set<string>();

	// execute adders
	if (config.integrationType === 'inline') {
		const pkgPath = installPackages(config, workspace);
		filesToFormat.add(pkgPath);
		const changedFiles = createOrUpdateFiles(config.files, workspace);
		changedFiles.forEach((file) => filesToFormat.add(file));
	} else if (config.integrationType === 'external') {
		try {
			console.log('execute external adder');
			execSync('npx ' + config.command, {
				cwd,
				env: Object.assign(process.env, config.environment ?? {}),
				stdio: 'pipe'
			});
		} catch (error) {
			const typedError = error as Error;
			throw new Error('Failed executing external command: ' + typedError.message);
		}
	} else {
		throw new Error('Unknown integration type');
	}
}

async function executeAdderTests(
	workingDirectory: string,
	adder: AdderWithoutExplicitArgs,
	options: OptionValues<Record<string, Question>>
) {
	if (!adder.tests) return;

	const cmd = adder.tests.command ?? 'dev';
	const { url, devServer } = await startDevServer(workingDirectory, cmd);
	const page = await openPage(url);

	try {
		const errorOcurred = await page.$('vite-error-overlay');
		if (errorOcurred) throw new Error('Dev server failed to start correctly. Vite errors present');

		await runTests(page, adder, options);
	} finally {
		await page.close();
		await stopDevServer(devServer);
	}
}
