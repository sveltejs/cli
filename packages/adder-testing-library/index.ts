import type { AdderWithoutExplicitArgs, OptionValues, Question, Tests } from '@svelte-cli/core';
import path from 'node:path';
import fs from 'node:fs';
import { create } from 'sv';
import degit from 'degit';
import { createOrUpdateFiles, createWorkspace, installPackages } from '@svelte-cli/core/internal';
import {
	ChildProcess,
	execSync,
	spawn,
	type ChildProcessWithoutNullStreams
} from 'node:child_process';
import { chromium, type Browser, type Page } from 'playwright';
import terminate from 'terminate';

type TestCase = {
	testName: string;
	template: string;
	adder: AdderWithoutExplicitArgs;
	options: OptionValues<Record<string, Question>>;
	cwd: string;
};
const ProjectTypes = {
	Svelte_JS: 'svelte-js',
	Svelte_TS: 'svelte-ts',
	Kit_JS: 'kit-js',
	Kit_JS_Comments: 'kit-js-comments',
	Kit_TS: 'kit-ts'
};
export const ProjectTypesList = Object.values(ProjectTypes);
const headless = false;
let browser: Browser;

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

async function downloadProjectTemplates(outputPath: string) {
	for (const templateType of ProjectTypesList) {
		const templateOutputPath = path.join(outputPath, templateType);

		if (templateType.includes('kit')) {
			create(templateOutputPath, {
				name: templateType,
				template: 'skeleton',
				types:
					templateType == ProjectTypes.Kit_TS
						? 'typescript'
						: templateType == ProjectTypes.Kit_JS_Comments
							? 'checkjs'
							: 'none'
			});
		} else {
			const templateName =
				templateType == ProjectTypes.Svelte_TS ? 'template-svelte-ts' : 'template-svelte-ts';

			const emitter = degit(`vitejs/vite/packages/create-vite/${templateName}`, {
				cache: false,
				force: true,
				verbose: false
			});

			await emitter.clone(templateOutputPath);
		}
	}
}

async function runAdder(
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
		// TODO was moved to cli and is thus not accessible anymore
		// await processExternalAdder(config, cwd);
	} else {
		throw new Error('Unknown integration type');
	}
}

export async function startBrowser() {
	browser = await chromium.launch({ headless });
	console.log('browser started');
}

export async function openPage(url: string) {
	const page = await browser.newPage();

	await page.goto(url, { timeout: 60_000 });
	await page.waitForLoadState('networkidle');

	// always use light mode. Otherwise the tests might depend on the OS setting
	// of each developer and thus leads to inconsistent test results.
	await page.emulateMedia({ colorScheme: 'light' });

	return page;
}

export async function stopBrowser() {
	if (!browser) return;
	await browser.close();
}

export async function executeAdderTests(
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

		// TODO
		// if (testOptions.pauseExecutionAfterBrowser) {
		// 	await prompts.textPrompt('Browser opened! Press any key to continue!');
		// }

		console.log('run tests now for ' + workingDirectory);
		await runTests(page, adder, options);
	} finally {
		await page.close();
		await stopDevServer(devServer);
	}
}

export async function startDevServer(
	output: string,
	command: string
): Promise<{ url: string; devServer: ChildProcessWithoutNullStreams }> {
	try {
		// TODO wtf is this necessary for the drizlle db:push to work?
		// await executeCli('pnpm', ['run', 'build'], output);
		return await executeCli('pnpm', ['run', command], output, {
			onData: (data, program, resolve) => {
				const regexUnicode = /[^\x20-\xaf]+/g;
				const withoutUnicode = data.replace(regexUnicode, '');

				const regexUnicodeDigits = /\[[0-9]{1,2}m/g;
				const withoutColors = withoutUnicode.replace(regexUnicodeDigits, '');

				const regexUrl = /http:\/\/[^:\s]+:[0-9]+\//g;
				const urls = withoutColors.match(regexUrl);

				if (urls && urls.length > 0) {
					const url = urls[0];
					resolve({ url, devServer: program });
				}
			}
		});
	} catch (error) {
		const typedError = error as Error;
		throw new Error('Failed to start dev server' + typedError.message);
	}
}

export async function stopDevServer(devServer: ChildProcessWithoutNullStreams) {
	if (!devServer.pid) return;

	await forceKill(devServer);
}

async function forceKill(devServer: ChildProcessWithoutNullStreams): Promise<void> {
	return new Promise((resolve) => {
		if (!devServer.pid) return;

		// just killing the process was not enough, because the process itself
		// spawns child process, that also need to be killed!
		terminate(devServer.pid, () => {
			resolve();
		});
	});
}

export async function executeCli(
	command: string,
	commandArgs: string[],
	cwd: string,
	options?: {
		onData?: (data: string, program: ChildProcess, resolve: (value?: any) => any) => void;
		stdio?: 'pipe' | 'inherit';
		env?: Record<string, string>;
	}
): Promise<any> {
	const stdio = options?.stdio ?? 'pipe';
	const env = options?.env ?? process.env;

	const program = spawn(command, commandArgs, { stdio, shell: true, cwd, env });

	return await new Promise((resolve, reject) => {
		let errorText = '';
		program.stderr?.on('data', (data: Buffer) => {
			const value = data.toString();
			errorText += value;
		});

		program.stdout?.on('data', (data: Buffer) => {
			const value = data.toString();
			options?.onData?.(value, program, resolve);
		});

		program.on('exit', (code) => {
			if (code == 0) {
				resolve(undefined);
			} else {
				reject(new Error(errorText));
			}
		});
	});
}

export async function runTests(
	page: Page,
	adder: AdderWithoutExplicitArgs,
	options: OptionValues<Record<string, Question>>
) {
	const tests: Tests = {
		expectProperty: async (selector, property, expectedValue) => {
			await expectProperty(page, selector, property, expectedValue);
		},
		elementExists: async (selector) => {
			await elementExists(page, selector);
		},
		click: async (selector, path) => {
			await click(page, selector, path);
		},
		expectUrlPath: (path) => {
			expectUrlPath(page, path);
		}
	};

	await executeAdderRealTests(adder, tests, options);
}

// TODO naming of the function
async function executeAdderRealTests(
	adder: AdderWithoutExplicitArgs,
	testMethods: Tests,
	options: OptionValues<Record<string, Question>>
) {
	if (!adder.tests || adder.tests.tests.length == 0)
		throw new Error('Cannot test adder without tests!');

	for (const test of adder.tests.tests) {
		if (test.condition && !test.condition(options)) continue;

		await test.run(testMethods);
	}
}

async function elementExists(page: Page, selector: string) {
	const elementToCheck = await page.$(selector);
	if (!elementToCheck) {
		throw new Error('No element found for selector ' + selector);
	}

	return elementToCheck;
}

/**
 * @param path If the click action results in a navigation, provide the expected path
 *
 * @example
 * ```js
 * await click(page, "a.some-link", "/some-path");
 * ```
 */
async function click(page: Page, selector: string, path?: string) {
	await elementExists(page, selector);

	await page.click(selector);

	if (path) {
		await page.waitForURL((url) => url.pathname === path);
	}
}

function expectUrlPath(page: Page, path: string) {
	const url = new URL(page.url());

	if (url.pathname !== path) {
		throw new Error(`Found path ${url.pathname} but expected ${path}!`);
	}
}

async function expectProperty(
	page: Page,
	selector: string,
	property: string,
	expectedValue: string
) {
	const elementToCheck = await elementExists(page, selector);

	const computedStyle = await page.evaluate(
		([element, pV]) => window.getComputedStyle(element).getPropertyValue(pV),
		[elementToCheck, property] as const
	);

	if (computedStyle !== expectedValue) {
		throw new Error(
			`Expected '${expectedValue}' but got '${computedStyle}' for selector '${selector}'`
		);
	}

	return computedStyle;
}
