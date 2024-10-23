import { test, describe, beforeAll, afterAll } from 'vitest';
import adder from './src/index.js';
import { runSnaphsotTests } from '@sveltejs/adder-testing-library';

runSnaphsotTests(
	'.outputs-snapshots',
	'_snapshot',
	[adder],
	describe,
	test.concurrent,
	beforeAll,
	afterAll
);
