import { expect, test } from 'vitest';
import {
	downloadFilesFromPlayground,
	extractPartsFromPlaygroundUrl,
	setupPlaygroundProject,
	validatePlaygroundUrl
} from '../playground.ts';
import { fileURLToPath } from 'node:url';
import { create } from '../index.ts';
import path from 'node:path';
import * as fs from 'node:fs';

const resolvePath = (path: string) => fileURLToPath(new URL(path, import.meta.url));
const testWorkspaceDir = resolvePath('../../../.test-output/create/');

test.for([
	{ input: 'https://svelte.dev/playground/628f435d787a465f9c1f1854134d6f70/', valid: true },
	{ input: 'https://svelte.dev/playground/hello-world', valid: true },
	{
		input:
			'https://svelte.dev/playground/a7aa9fd8daf445dcabd31b6aa6b1946f#H4sIAAAAAAAACm2Oz06EMBDGX2WcmCxEInKtQOLNdxAPhc5mm63Thg67moZ3NwU3e_H6_b5_CVl_ESp8J-c8XP3sDBRkrJApscKjdRRRfSSUn5B9WcDqlnoL4TleyEnWRh3pP33yLMQSUWEbp9kG6QcexJFAtkMHj1G0UHHY5g_l6w1PfmG585dM2vrewe2p6ffnKVetOpqHtj41O7QcFoHRslEX7RbqdhPU_cDtuIh4Bs-Ts9O5S0UJXf-3-NRBs24nNxgVpA2seX4P9gNjhULfgkrmhdbPCkVbd7VsUB21i7T-Akpv1IhdAQAA',
		valid: true
	},
	{ input: 'test', valid: false },
	{ input: 'google.com', valid: false },
	{ input: 'https://google.com', valid: false },
	{ input: 'https://google.com/playground/123', valid: false },
	{ input: 'https://svelte.dev/docs/cli', valid: false }
])('validate playground url $input', (data) => {
	const isValid = validatePlaygroundUrl(data.input);

	expect(isValid).toBe(data.valid);
});

test.for([
	{
		url: 'https://svelte.dev/playground/628f435d787a465f9c1f1854134d6f70/',
		expected: { playgroundId: '628f435d787a465f9c1f1854134d6f70', hash: undefined }
	},
	{
		url: 'https://svelte.dev/playground/hello-world',
		expected: { playgroundId: 'hello-world', hash: undefined }
	},
	{
		url: 'https://svelte.dev/playground/a7aa9fd8daf445dcabd31b6aa6b1946f#H4sIAAAAAAAACm2Oz06EMBDGX2WcmCxEInKtQOLNdxAPhc5mm63Thg67moZ3NwU3e_H6_b5_CVl_ESp8J-c8XP3sDBRkrJApscKjdRRRfSSUn5B9WcDqlnoL4TleyEnWRh3pP33yLMQSUWEbp9kG6QcexJFAtkMHj1G0UHHY5g_l6w1PfmG585dM2vrewe2p6ffnKVetOpqHtj41O7QcFoHRslEX7RbqdhPU_cDtuIh4Bs-Ts9O5S0UJXf-3-NRBs24nNxgVpA2seX4P9gNjhULfgkrmhdbPCkVbd7VsUB21i7T-Akpv1IhdAQAA',
		expected: {
			playgroundId: 'a7aa9fd8daf445dcabd31b6aa6b1946f',
			hash: 'H4sIAAAAAAAACm2Oz06EMBDGX2WcmCxEInKtQOLNdxAPhc5mm63Thg67moZ3NwU3e_H6_b5_CVl_ESp8J-c8XP3sDBRkrJApscKjdRRRfSSUn5B9WcDqlnoL4TleyEnWRh3pP33yLMQSUWEbp9kG6QcexJFAtkMHj1G0UHHY5g_l6w1PfmG585dM2vrewe2p6ffnKVetOpqHtj41O7QcFoHRslEX7RbqdhPU_cDtuIh4Bs-Ts9O5S0UJXf-3-NRBs24nNxgVpA2seX4P9gNjhULfgkrmhdbPCkVbd7VsUB21i7T-Akpv1IhdAQAA'
		}
	}
])('extract parts from playground url $url', (data) => {
	const { playgroundId, hash } = extractPartsFromPlaygroundUrl(data.url);

	expect(playgroundId).toBe(data.expected.playgroundId);
	expect(hash).toBe(data.expected.hash);
});

test.for([
	{
		testName: 'playground id',
		playgroundId: 'hello-world',
		hash: undefined
	},
	{
		testName: 'hash',
		playgroundId: undefined,
		hash: 'H4sIAAAAAAAACm2OTU7DMBCFr2JGSG1FRMjW2JbYcQfCwnGmqlUztuJxC4pyd-SEqhu273t_M5D9QpDwjiFEcY1TGKGBow-YQX7MwD-p4ipAczO_pfScLxi4aoPN-J_uIjESZ5Cgspt8YtNTzwFZVLvQ4jGzZdzv1tXd4fWGXSzEd_5SiWrvHaROndkOz7VqeVDtqduIp1RYDJ5GebGhoN4cojU9qaEwRxKRXPDurOf9QWjzN_ekRbesD1eYpZhXsNTtLWh6ggYYvxkkTwWXzwbY-nD1NII82pBx-QXBqXEFUQEAAA=='
	}
])('download hello world playground from $testName', async (data) => {
	const playground = await downloadFilesFromPlayground({
		playgroundId: data.playgroundId,
		hash: data.hash
	});

	expect(playground.name).toBe('Hello world');
	expect(playground.files).toHaveLength(1);

	const file1 = playground.files[0];
	expect(file1.name).toBe('App.svelte');
	expect(file1.content).toContain('<h1>Hello {name}!</h1>');
});

test('real world download and convert playground', async () => {
	const directory = path.join(testWorkspaceDir, 'real-world-playground');
	if (fs.existsSync(directory)) {
		fs.rmdirSync(directory, { recursive: true });
	}

	await create(directory, {
		name: 'real-world-playground',
		template: 'minimal',
		types: 'typescript'
	});

	const playground = await downloadFilesFromPlayground({
		playgroundId: '770bbef086034b9f8e337bab57efe8d8',
		hash: undefined
	});

	setupPlaygroundProject(playground, directory);

	const pageFilePath = path.join(directory, 'src/routes/+page.svelte');
	const pageContent = fs.readFileSync(pageFilePath, 'utf-8');
	expect(pageContent).toContain('<App />');

	const packageJsonPath = path.join(directory, 'package.json');
	const packageJsonContent = fs.readFileSync(packageJsonPath, 'utf-8');
	expect(packageJsonContent).toContain('"change-case": "latest"');
});
