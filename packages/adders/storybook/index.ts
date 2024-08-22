import { defineAdder } from '@svelte-cli/core';
import { adder } from './config/adder';
import { tests } from './config/tests';
import { checks } from './config/checks';

export default defineAdder(adder, checks, tests);
