import { test, describe, beforeAll, afterAll } from 'vitest';
import { getAdderTestDetails } from '../../common.ts';
import { runEndToEndTests } from '@sveltejs/adder-testing-library';

const adders = await getAdderTestDetails();

runEndToEndTests('.outputs-e2e', adders, describe, test.concurrent, beforeAll, afterAll);
