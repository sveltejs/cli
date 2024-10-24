import { test, describe, beforeAll, afterAll } from 'vitest';
import { runEndToEndTests } from '@sveltejs/adder-testing-library';
import adder from '../src/index.js';
import { tests } from './tests.js';

runEndToEndTests(
	'.outputs-e2e',
	[{ config: adder, tests }],
	describe,
	test.concurrent,
	beforeAll,
	afterAll
);
