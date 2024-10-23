import { test, describe, beforeAll, afterAll } from 'vitest';
import { getAdderDetails, getAdderTestDetails, officialAdders } from '@sveltejs/adders';
import { runEndToEndTests } from '@sveltejs/adder-testing-library';

// todo: I'm sure there is a better way to do this
const adders = await Promise.all(
	officialAdders.map(async (x) => {
		return {
			config: getAdderDetails(x.id),
			tests: await getAdderTestDetails(x.id)
		};
	})
);

runEndToEndTests('.outputs-e2e', adders, describe, test.concurrent, beforeAll, afterAll);
