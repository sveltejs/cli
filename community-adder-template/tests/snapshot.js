import { test, describe, beforeAll, afterAll } from 'vitest';
import { runSnapshotTests } from '@sveltejs/adder-testing-library';
import adder from '../src/index.js';
import { tests } from './tests.js';

runSnapshotTests(
	'.outputs-snapshots',
	'_snapshot',
	[{ config: adder, tests }],
	describe,
	test.concurrent,
	beforeAll,
	afterAll
);
