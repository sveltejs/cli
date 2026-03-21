import { js, parse, svelte } from '@sveltejs/sv-utils';
import { defineAddon, defineAddonOptions } from 'sv';

const options = defineAddonOptions()
	.add('who', {
		question: 'To whom should the addon say hello?',
		type: 'string',
		default: ''
	})
	.build();

export default defineAddon({
	id: '@my-org/sv',
	options,

	setup: ({ isKit, unsupported }) => {
		if (!isKit) unsupported('Requires SvelteKit');
	},

	run: ({ directory, sv, options, language }) => {
		sv.file(`${directory.lib}/@my-org/sv/content.txt`, () => {
			return `This is a text file made by the Community Addon Template demo for the add-on: '@my-org/sv'!`;
		});

		sv.file(`${directory.lib}/@my-org/sv/HelloComponent.svelte`, (content) => {
			const { ast, generateCode } = parse.svelte(content);
			svelte.ensureScript(ast, { language });

			js.imports.addDefault(ast.instance.content, { as: 'content', from: './content.txt?raw' });

			svelte.addFragment(ast, '<p>{content}</p>');
			svelte.addFragment(ast, `<h2>Hello ${options.who}!</h2>`);

			return generateCode();
		});

		sv.file(directory.routes + '/+page.svelte', (content) => {
			const { ast, generateCode } = parse.svelte(content);
			svelte.ensureScript(ast, { language });

			js.imports.addDefault(ast.instance.content, {
				as: 'HelloComponent',
				from: `$lib/@my-org/sv/HelloComponent.svelte`
			});

			svelte.addFragment(ast, '<HelloComponent />');

			return generateCode();
		});
	}
});
