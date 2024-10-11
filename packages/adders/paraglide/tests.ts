import { defineAdderTests } from '@svelte-cli/core';
import { options } from './index.ts';
// e2e tests make no sense in this context

export const tests = defineAdderTests({
	files: [],
	options,
	optionValues: [],
	tests: []
});
