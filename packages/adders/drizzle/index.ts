import { defineAdder } from '@svelte-cli/core';
import { adder } from './config/adder';
import { checks } from './config/checks';
import { tests } from './config/tests';

export default defineAdder(adder, checks, tests);
