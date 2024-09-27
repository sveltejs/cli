import { defineAdderTests, type OptionDefinition, type SvelteFileEditor } from '@svelte-cli/core';
import { options } from './options.ts';
import * as html from '@svelte-cli/core/html';

const divId = 'myDiv';
const typographyDivId = 'myTypographyDiv';

export const tests = defineAdderTests({
	files: [
		{
			name: ({ kit }) => `${kit?.routesDirectory}/+page.svelte`,
			contentType: 'svelte',
			content: (editor) => {
				prepareCoreTest(editor);
				if (editor.options.plugins.includes('typography')) prepareTypographyTest(editor);
			},
			condition: ({ kit }) => Boolean(kit)
		},
		{
			name: () => 'src/App.svelte',
			contentType: 'svelte',
			content: (editor) => {
				prepareCoreTest(editor);
				if (editor.options.plugins.includes('typography')) prepareTypographyTest(editor);
			},
			condition: ({ kit }) => !kit
		}
	],
	options,
	optionValues: [{ plugins: [] }, { plugins: ['typography'] }],
	tests: [
		{
			name: 'core properties',
			run: async ({ expectProperty }) => {
				const selector = '#' + divId;
				await expectProperty(selector, 'background-color', 'rgb(71, 85, 105)');
				await expectProperty(selector, 'border-color', 'rgb(249, 250, 251)');
				await expectProperty(selector, 'border-width', '4px');
				await expectProperty(selector, 'margin-top', '4px');
			}
		},
		{
			name: 'typography properties',
			condition: ({ plugins }) => plugins.includes('typography'),
			run: async ({ expectProperty }) => {
				const selector = '#' + typographyDivId;
				await expectProperty(selector, 'font-size', '18px');
				await expectProperty(selector, 'line-height', '28px');
				await expectProperty(selector, 'text-align', 'right');
				await expectProperty(selector, 'text-decoration-line', 'line-through');
			}
		}
	]
});

function prepareCoreTest<Args extends OptionDefinition>({ htmlAst }: SvelteFileEditor<Args>) {
	const div = html.div({ class: 'bg-slate-600 border-gray-50 border-4 mt-1', id: divId });
	html.appendElement(htmlAst.childNodes, div);
}

function prepareTypographyTest<Args extends OptionDefinition>({ htmlAst }: SvelteFileEditor<Args>) {
	const div = html.element('p', { class: 'text-lg text-right line-through', id: typographyDivId });
	html.appendElement(htmlAst.childNodes, div);
}
