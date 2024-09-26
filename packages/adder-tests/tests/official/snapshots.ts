import { test, describe, beforeAll, afterAll } from 'vitest';
import { adderIds, getAdderDetails } from '@svelte-cli/adders';
import { runSnaphsotTests } from '@svelte-cli/adder-testing-library';

const adders = adderIds.flatMap((x) => getAdderDetails(x));

runSnaphsotTests(
	'.outputs-snapshots',
	'_snapshots',
	adders,
	describe,
	test.concurrent,
	beforeAll,
	afterAll
);
