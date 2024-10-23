import { test, describe, beforeAll, afterAll } from 'vitest';
import { getAdderTestDetails, getAdderDetails, officialAdders } from '@sveltejs/adders';
import { runSnapshotTests } from '@sveltejs/adder-testing-library';

// todo: I'm sure there is a better way to do this
const adders = await Promise.all(
	officialAdders.map(async (x) => {
		return {
			config: getAdderDetails(x.id),
			tests: await getAdderTestDetails(x.id)
		};
	})
);

runSnapshotTests(
	'.outputs-snapshots',
	'_snapshots',
	adders,
	describe,
	test.concurrent,
	beforeAll,
	afterAll
);
