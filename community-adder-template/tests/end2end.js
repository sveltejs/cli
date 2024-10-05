import { test, describe, beforeAll, afterAll } from 'vitest';
import adder from './src/index.js';
import { runEndToEndTests } from '@svelte-cli/adder-testing-library';

runEndToEndTests('.outputs-e2e', [adder], describe, test.concurrent, beforeAll, afterAll);
