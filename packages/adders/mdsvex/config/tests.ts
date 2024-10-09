import {
	defineAdderTests,
	type SvelteFileEditor,
	type TextFileEditor,
	type OptionDefinition
} from '@svelte-cli/core';
import { options } from './options.ts';
import { imports } from '@svelte-cli/core/js';
import * as html from '@svelte-cli/core/html';

export const tests = defineAdderTests({
	files: [
		{
			name: ({ kit }) => `${kit?.routesDirectory}/+page.svelte`,
			contentType: 'svelte',
			content: useMarkdownFile,
			condition: ({ kit }) => Boolean(kit)
		},
		{
			name: () => 'src/App.svelte',
			contentType: 'svelte',
			content: useMarkdownFile,
			condition: ({ kit }) => !kit
		},
		{
			name: ({ kit }) => `${kit?.routesDirectory}/Demo.svx`,
			content: addMarkdownFile,
			condition: ({ kit }) => Boolean(kit)
		},
		{
			name: () => 'src/Demo.svx',
			content: addMarkdownFile,
			condition: ({ kit }) => !kit
		}
	],
	options,
	optionValues: [],
	tests: [
		{
			name: 'elements exist',
			run: async ({ elementExists }) => {
				await elementExists('.mdsvex h1');
				await elementExists('.mdsvex h2');
				await elementExists('.mdsvex p');
			}
		}
	]
});

function addMarkdownFile<Args extends OptionDefinition>(editor: TextFileEditor<Args>) {
	// example taken from website: https://mdsvex.pngwn.io
	return (
		editor.content +
		`
---
title: Svex up your markdown
---

# { title }

## Good stuff in your markdown

Markdown is pretty good but sometimes you just need more.
`
	);
}

function useMarkdownFile<Args extends OptionDefinition>({
	jsAst,
	htmlAst
}: SvelteFileEditor<Args>) {
	imports.addDefault(jsAst, './Demo.svx', 'Demo');

	const div = html.div({ class: 'mdsvex' });
	html.appendElement(htmlAst.childNodes, div);
	const mdsvexNode = html.element('Demo');
	html.appendElement(div.childNodes, mdsvexNode);
}
