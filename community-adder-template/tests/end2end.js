import { test, describe, beforeAll, afterAll } from 'vitest';
import { runEndToEndTests } from '@sveltejs/adder-testing-library';
import adder from '../src/index.js';

runEndToEndTests('.outputs-e2e', [adder], describe, test.concurrent, beforeAll, afterAll);
