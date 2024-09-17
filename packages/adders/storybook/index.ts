import { defineAdder } from '@svelte-cli/core';
import { adder } from './config/adder.ts';
import { tests } from './config/tests.ts';
import { checks } from './config/checks.ts';

export default defineAdder(adder, checks, tests);
