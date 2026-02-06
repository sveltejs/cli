import { defineAddon, defineAddonOptions } from 'sv';
import { js, parse, svelte } from '@sveltejs/sv-utils';

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

	setup: ({ kit, unsupported }) => {
		if (!kit) unsupported('Requires SvelteKit');
	},

	run: ({ kit, sv, options, language, cancel }) => {
		if (!kit) return cancel('SvelteKit is required');

		sv.file(`src/lib/@my-org/sv/content.txt`, () => {
			return `This is a text file made by the Community Addon Template demo for the add-on: '@my-org/sv'!`;
		});

		sv.file(`src/lib/@my-org/sv/HelloComponent.svelte`, (content) => {
			const { ast, generateCode } = parse.svelte(content);
			svelte.ensureScript(ast, { language });

			js.imports.addDefault(ast.instance.content, { as: 'content', from: './content.txt?raw' });

			svelte.addFragment(ast, '<p>{content}</p>');
			svelte.addFragment(ast, `<h2>Hello ${options.who}!</h2>`);

			return generateCode();
		});

		sv.file(kit.routesDirectory + '/+page.svelte', (content) => {
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
