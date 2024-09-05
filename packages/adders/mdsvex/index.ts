import { defineAdder } from '@svelte-cli/core';
import { adder } from './config/adder.js';
import { tests } from './config/tests.js';
import { checks } from './config/checks.js';

export default defineAdder(adder, checks, tests);
