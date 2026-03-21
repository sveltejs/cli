import { js, svelte, transforms } from '@sveltejs/sv-utils';
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

	setup: ({ kit, unsupported }) => {
		if (!kit) unsupported('Requires SvelteKit');
	},

	run: ({ kit, sv, options, cancel }) => {
		if (!kit) return cancel('SvelteKit is required');

		sv.file(
			`src/lib/~SV-NAME-TODO~/content.txt`,
			transforms.text((data) => {
				data.content = `This is a text file made by the Community Addon Template demo for the add-on: '~SV-NAME-TODO~'!`;
			})
		);

		sv.file(
			`src/lib/~SV-NAME-TODO~/HelloComponent.svelte`,
			transforms.svelte((ast, { language }) => {
				svelte.ensureScript(ast, { language });

				js.imports.addDefault(ast.instance.content, {
					as: 'content',
					from: './content.txt?raw'
				});

				svelte.addFragment(ast, '<p>{content}</p>');
				svelte.addFragment(ast, `<h2>Hello ${options.who}!</h2>`);
			})
		);

		sv.file(
			kit.routesDirectory + '/+page.svelte',
			transforms.svelte((ast, { language }) => {
				svelte.ensureScript(ast, { language });

				js.imports.addDefault(ast.instance.content, {
					as: 'HelloComponent',
					from: `$lib/~SV-NAME-TODO~/HelloComponent.svelte`
				});

				svelte.addFragment(ast, '<HelloComponent />');
			})
		);
	}
});
