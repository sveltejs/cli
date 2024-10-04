import type { AdderWithoutExplicitArgs } from '@svelte-cli/core';
import path from 'node:path';
import fs from 'node:fs';
import { openPage, stopBrowser } from './browser.ts';
import {
	generateTestCases,
	prepareEndToEndTests,
	prepareSnaphotTests,
	startDevServer,
	stopDevServer
} from './utils.ts';
import { runTests } from './tests.ts';
import { installPackages } from '../core/internal.ts';
import { createOrUpdateFiles, createWorkspace } from '@svelte-cli/core/internal';

const templatesDirectoryName = 'templates';
const addersDirectoryName = 'adders';

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
	const templatesPath = path.join(outputPath, templatesDirectoryName);
	const addersOutputPath = path.join(outputPath, addersDirectoryName);
	const testCases = generateTestCases(adders, addersOutputPath, { ignoreEmptyTests: true });

	beforeAll(async () => {
		await prepareEndToEndTests(outputPath, templatesPath, addersOutputPath, adders, testCases);
	});

	for (const [adderId, adderTestCases] of testCases) {
		describe(adderId, () => {
			const adder = adders.find((x) => x.config.metadata.id == adderId)!;
			const adderTestDetails = adder.tests!;
			beforeAll(adderTestDetails.beforeAll ?? noop);

			for (const testCase of adderTestCases) {
				test(testCase.testName, async () => {
					if (!adder.tests) return;

					const cmd = adder.tests.command ?? 'dev';
					const { url, devServer } = await startDevServer(testCase.cwd, cmd);
					const page = await openPage(url);

					try {
						const errorOcurred = await page.$('vite-error-overlay');
						if (errorOcurred)
							throw new Error('Dev server failed to start correctly. Vite errors present');

						await runTests(page, adder, testCase.options);
					} finally {
						await page.close();
						await stopDevServer(devServer);
					}
				});
			}

			afterAll(adderTestDetails.afterAll ?? noop);
		});
	}

	afterAll(async () => {
		await stopBrowser();
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
	const noop = () => {};
	const outputPath = path.join(process.cwd(), outputDirectory);
	const templatesPath = path.join(outputPath, templatesDirectoryName);
	const addersOutputPath = path.join(outputPath, addersDirectoryName);
	const testCases = generateTestCases(adders, addersOutputPath, { ignoreEmptyTests: false });

	// only process inline adders, as we don't know which files external adders will modify
	adders = adders.filter((x) => x.config.integrationType == 'inline');

	beforeAll(async () => {
		await prepareSnaphotTests(outputPath, templatesPath, addersOutputPath, adders, testCases);
	});

	for (const [adderId, adderTestCases] of testCases) {
		const adder = adders.find((x) => x.config.metadata.id == adderId);

		if (!adder) continue;

		describe(adderId, () => {
			const adderTestDetails = adder.tests!;
			beforeAll(adderTestDetails.beforeAll ?? noop);

			for (const testCase of adderTestCases) {
				test(testCase.testName, ({ expect }) => {
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
				});
			}

			afterAll(adderTestDetails.afterAll ?? noop);
		});
	}

	afterAll(noop);
}
