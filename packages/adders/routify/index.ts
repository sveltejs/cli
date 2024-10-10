import { defineAdder } from '@svelte-cli/core';
import { adder } from './config/adder.ts';
import { tests } from './config/tests.ts';

export default defineAdder(adder, tests);
