import { defineAdder } from '@svelte-cli/core';
import { adder } from './config/adder.js';
import { tests } from './config/tests.js';

export default defineAdder(adder, tests);
