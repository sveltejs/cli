import { defineAdderTests } from '@svelte-cli/core';
import { options } from './options.ts';

const divId = 'myDiv';
const typographyDivId = 'myTypographyDiv';

export const tests = defineAdderTests({
	files: [
		{
			name: ({ kit }) => `${kit?.routesDirectory}/+page.svelte`,
			content: ({ content, options }) => {
				content = prepareCoreTest(content);
				if (options.plugins.includes('typography')) content = prepareTypographyTest(content);
				return content;
			},
			condition: ({ kit }) => Boolean(kit)
		},
		{
			name: () => 'src/App.svelte',
			content: ({ content, options }) => {
				content = prepareCoreTest(content);
				if (options.plugins.includes('typography')) content = prepareTypographyTest(content);
				return content;
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

function prepareCoreTest(content: string) {
	const div = `<div class="bg-slate-600 border-gray-50 border-4 mt-1" id="${divId}"></div>`;
	return content + div;
}

function prepareTypographyTest(content: string) {
	const p = `<p class="text-lg text-right line-through" id="${typographyDivId}"></p>`;
	return content + p;
}
