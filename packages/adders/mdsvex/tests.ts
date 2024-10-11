import { defineAdderTests, type OptionDefinition, type FileEditor } from '@sveltejs/cli-core';
import { imports } from '@sveltejs/cli-core/js';
import * as html from '@sveltejs/cli-core/html';
import { parseSvelte } from '@sveltejs/cli-core/parsers';

export const tests = defineAdderTests({
	files: [
		{
			name: ({ kit }) => `${kit?.routesDirectory}/+page.svelte`,
			content: useMarkdownFile,
			condition: ({ kit }) => Boolean(kit)
		},
		{
			name: () => 'src/App.svelte',
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
	options: {},
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

function addMarkdownFile<Args extends OptionDefinition>({ content }: FileEditor<Args>) {
	// example taken from website: https://mdsvex.pngwn.io
	return (
		content +
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

function useMarkdownFile<Args extends OptionDefinition>({ content }: FileEditor<Args>) {
	const { script, template, generateCode } = parseSvelte(content);
	imports.addDefault(script.ast, './Demo.svx', 'Demo');

	const div = html.div({ class: 'mdsvex' });
	html.appendElement(template.ast.childNodes, div);
	const mdsvexNode = html.element('Demo');
	html.appendElement(div.childNodes, mdsvexNode);
	return generateCode({ script: script.generateCode(), template: template.generateCode() });
}
