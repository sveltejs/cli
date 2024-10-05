import type { AdderWithoutExplicitArgs, TestType } from '@svelte-cli/core';
import path from 'node:path';
import fs from 'node:fs';
import { openPage, stopBrowser } from './browser.ts';
import {
	generateTestCases,
	prepareEndToEndTests,
	prepareSnaphotTests,
	startDevServer,
	stopDevServer,
	type TestCase
} from './utils.ts';
import { startTests } from './tests.ts';
import { installPackages } from '../core/internal.ts';
import { createOrUpdateFiles, createWorkspace } from '@svelte-cli/core/internal';

const templatesDirectoryName = 'templates';
const addersDirectoryName = 'adders';

export function runEndToEndTests(
	outputDirectory: string,
	adders: AdderWithoutExplicitArgs[],
	describe: (name: string, testFactory: () => void) => void,
	test: (name: string, testFunction: (args: TestArguments) => Promise<void> | void) => void,
	beforeAll: (fn: () => void) => void,
	afterAll: (fn: () => void) => void
) {
	const outputPath = path.join(process.cwd(), outputDirectory);
	const templatesPath = path.join(outputPath, templatesDirectoryName);
	const addersOutputPath = path.join(outputPath, addersDirectoryName);
	const testCases = generateTestCases(adders, addersOutputPath, { ignoreEmptyTests: true });

	runTests(adders, testCases, 'end2end', {
		describe,
		test,
		beforeAll,
		afterAll,
		prepare: async () => {
			await prepareEndToEndTests(outputPath, templatesPath, addersOutputPath, adders, testCases);
		},
		run: async (testCase, adder) => {
			const cmd = adder.tests!.command ?? 'dev';
			const { url, devServer } = await startDevServer(testCase.cwd, cmd);
			const page = await openPage(url);

			try {
				const errorOcurred = await page.$('vite-error-overlay');
				if (errorOcurred)
					throw new Error('Dev server failed to start correctly. Vite errors present');

				await startTests(page, adder, testCase.options);
			} finally {
				await page.close();
				await stopDevServer(devServer);
			}
		},
		tearDown: async () => {
			await stopBrowser();
		}
	});
}

type TestArguments = {
	expect: (content: string) => { toMatchFileSnapshot: (filePath: string) => void };
};

export function runSnaphsotTests(
	outputDirectory: string,
	snapshotDirectory: string,
	adders: AdderWithoutExplicitArgs[],
	describe: (name: string, testFactory: () => void) => void,
	test: (name: string, testFunction: (args: TestArguments) => Promise<void> | void) => void,
	beforeAll: (fn: () => void) => void,
	afterAll: (fn: () => void) => void
) {
	const outputPath = path.join(process.cwd(), outputDirectory);
	const templatesPath = path.join(outputPath, templatesDirectoryName);
	const addersOutputPath = path.join(outputPath, addersDirectoryName);
	const testCases = generateTestCases(adders, addersOutputPath, { ignoreEmptyTests: false });

	runTests(adders, testCases, 'snapshot', {
		describe,
		test,
		beforeAll,
		afterAll,
		prepare: async () => {
			await prepareSnaphotTests(outputPath, templatesPath, addersOutputPath, adders, testCases);
		},
		run: (testCase, _, { expect }) => {
			const { config } = testCase.adder;
			if (config.integrationType !== 'inline') return;

			const filesToFormat = new Set<string>();
			const workspace = createWorkspace(testCase.cwd);
			workspace.options = testCase.options;
			const pkgPath = installPackages(config, workspace);
			filesToFormat.add(pkgPath);
			const changedFiles = createOrUpdateFiles(config.files, workspace);
			changedFiles.forEach((file) => filesToFormat.add(file));

			for (const changedFile of changedFiles) {
				const fullFilePath = path.join(testCase.cwd, changedFile);
				const content = fs.readFileSync(fullFilePath).toString();

				const relativeTestCasePath = testCase.cwd.replace(addersOutputPath, '');
				const snapshotPath = path.join(
					process.cwd(),
					snapshotDirectory,
					relativeTestCasePath,
					changedFile
				);

				expect(content).toMatchFileSnapshot(snapshotPath);
			}
		},
		tearDown: async () => {}
	});
}

export function runTests(
	adders: AdderWithoutExplicitArgs[],
	testCases: Map<string, TestCase[]>,
	testType: TestType,
	options: {
		describe: (name: string, testFactory: () => void) => void;
		test: (name: string, testFunction: (args: TestArguments) => Promise<void> | void) => void;
		beforeAll: (fn: () => void) => void;
		afterAll: (fn: () => void) => void;
		prepare: () => Promise<void>;
		run: (
			testCase: TestCase,
			adder: AdderWithoutExplicitArgs,
			args: TestArguments
		) => Promise<void> | void;
		tearDown: () => Promise<void>;
	}
) {
	options.beforeAll(async () => {
		await options.prepare();
	});

	for (const [adderId, adderTestCases] of testCases) {
		options.describe(adderId, () => {
			const adder = adders.find((x) => x.config.metadata.id == adderId)!;
			if (!adder) throw new Error('failed to find ' + adderId);
			const adderTestDetails = adder.tests!;
			options.beforeAll(async () => {
				if (adderTestDetails.beforeAll) await adderTestDetails.beforeAll(testType);
			});

			for (const testCase of adderTestCases) {
				options.test(testCase.testName, async (testArgs) => {
					if (!adder.tests) return;

					if (adder.tests.beforeEach) await adder.tests.beforeEach(testCase.cwd, testType);

					try {
						await options.run(testCase, adder, testArgs);
					} finally {
						if (adder.tests.afterEach) await adder.tests.afterEach(testCase.cwd, testType);
					}
				});
			}

			options.afterAll(async () => {
				if (adderTestDetails.afterAll) await adderTestDetails.afterAll(testType);
			});
		});
	}

	options.afterAll(async () => {
		await options.tearDown();
	});
}
