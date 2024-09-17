import { defineAdder } from '@svelte-cli/core';
import { adder } from './config/adder.ts';
import { checks } from './config/checks.ts';
import { tests } from './config/tests.ts';

export default defineAdder(adder, checks, tests);
