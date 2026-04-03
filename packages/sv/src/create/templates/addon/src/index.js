import { transforms } from './sv-utils.js';
import { defineAddon, defineAddonOptions } from 'sv';

const options = defineAddonOptions()
	.add('who', {
		question: 'To whom should the addon say hello?',
		type: 'string',
		default: ''
	})
	.build();

export default defineAddon({
	id: '~SV-NAME-TODO~',
	options,

	setup: ({ isKit, unsupported }) => {
		if (!isKit) unsupported('Requires SvelteKit');
	},

	run: ({ directory, sv, options, language }) => {
		sv.file(
			`${directory.lib}/~SV-NAME-TODO~/content.txt`,
			transforms.text(() => {
				return `This is a text file made by the Community Addon Template demo for the add-on: '~SV-NAME-TODO~'!`;
			})
		);

		sv.file(
			`${directory.lib}/~SV-NAME-TODO~/HelloComponent.svelte`,
			transforms.svelteScript({ language }, ({ ast, svelte, js }) => {
				js.imports.addDefault(ast.instance.content, {
					as: 'content',
					from: './content.txt?raw'
				});

				svelte.addFragment(ast, '<p>{content}</p>');
				svelte.addFragment(ast, `<h2>Hello ${options.who}!</h2>`);
			})
		);

		sv.file(
			directory.kitRoutes + '/+page.svelte',
			transforms.svelteScript({ language }, ({ ast, svelte, js }) => {
				js.imports.addDefault(ast.instance.content, {
					as: 'HelloComponent',
					from: `$lib/~SV-NAME-TODO~/HelloComponent.svelte`
				});

				svelte.addFragment(ast, '<HelloComponent />');
			})
		);
	}
});
