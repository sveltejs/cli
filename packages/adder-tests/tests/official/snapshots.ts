import { test, describe, beforeAll, afterAll } from 'vitest';
import { runSnapshotTests } from '@sveltejs/adder-testing-library';
import { getAdderTestDetails } from '../../common.ts';

const adders = await getAdderTestDetails();

runSnapshotTests(
	'.outputs-snapshots',
	'_snapshots',
	adders,
	describe,
	test.concurrent,
	beforeAll,
	afterAll
);
