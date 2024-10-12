import { defineAdderTests } from '@sveltejs/cli-core';
import { options } from './index.ts';

export const tests = defineAdderTests({
	files: [],
	options,
	optionValues: [],
	tests: []
});
