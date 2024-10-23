import { defineAdderTests } from '@sveltejs/cli-core';
import * as html from '@sveltejs/cli-core/html';
import { options } from './options.js';

export const tests = defineAdderTests({
	options,
	optionValues: [{ demo: true }],
	files: [
		{
			name: ({ kit }) => `${kit?.routesDirectory}/+page.svelte`,
			contentType: 'svelte',
			condition: ({ kit }) => Boolean(kit),
			content: ({ htmlAst }) => {
				const div = html.div({ class: 'test' });
				html.appendElement(htmlAst.childNodes, div);
			}
		},
		{
			name: () => 'src/App.svelte',
			contentType: 'svelte',
			condition: ({ kit }) => !kit,
			content: ({ htmlAst }) => {
				const div = html.div({ class: 'test' });
				html.appendElement(htmlAst.childNodes, div);
			}
		}
	],
	tests: [
		{
			name: 'demo test',
			run: async ({ elementExists }) => {
				await elementExists('.test');
			}
		}
	]
});
