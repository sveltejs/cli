import { expect, test } from 'vitest';
import {
	downloadFilesFromPlayground,
	extractPartsFromPlaygroundUrl,
	validatePlaygroundUrl
} from '../playground.ts';

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

test('download playground test', async () => {
	const t1 = await downloadFilesFromPlayground({
		playgroundId: 'hello-world',
		hash: undefined
	});
	const t2 = await downloadFilesFromPlayground({
		playgroundId: undefined,
		hash: 'H4sIAAAAAAAACm2Oz06EMBDGX2WcmCxEInKtQOLNdxAPhc5mm63Thg67moZ3NwU3e_H6_b5_CVl_ESp8J-c8XP3sDBRkrJApscKjdRRRfSSUn5B9WcDqlnoL4TleyEnWRh3pP33yLMQSUWEbp9kG6QcexJFAtkMHj1G0UHHY5g_l6w1PfmG585dM2vrewe2p6ffnKVetOpqHtj41O7QcFoHRslEX7RbqdhPU_cDtuIh4Bs-Ts9O5S0UJXf-3-NRBs24nNxgVpA2seX4P9gNjhULfgkrmhdbPCkVbd7VsUB21i7T-Akpv1IhdAQAA'
	});
	console.log(t1);
	console.log(t2);
	expect(true).toBe(true); // Just a placeholder to ensure the test runs without errors
});
