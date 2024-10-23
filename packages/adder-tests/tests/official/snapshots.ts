import { test, describe, beforeAll, afterAll } from 'vitest';
import { officialAdders } from '@sveltejs/adders';
import { runSnaphsotTests } from '@sveltejs/adder-testing-library';

runSnaphsotTests(
	'.outputs-snapshots',
	'_snapshots',
	officialAdders,
	describe,
	test.concurrent,
	beforeAll,
	afterAll
);
