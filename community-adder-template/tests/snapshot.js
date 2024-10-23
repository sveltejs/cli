import { test, describe, beforeAll, afterAll } from 'vitest';
import { runSnapshotTests } from '@sveltejs/adder-testing-library';
import adder from '../src/index.js';

runSnapshotTests(
	'.outputs-snapshots',
	'_snapshot',
	[adder],
	describe,
	test.concurrent,
	beforeAll,
	afterAll
);
