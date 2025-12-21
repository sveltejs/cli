import { defineAddon, defineAddonOptions, js, parse, svelte } from 'sv/core';

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
	run: ({ kit, sv, options, typescript }) => {
		if (!kit) throw new Error('SvelteKit is required');

		sv.file(`src/lib/@my-org/sv/content.txt`, () => {
			return `This is a text file made by the Community Addon Template demo for the add-on: '@my-org/sv'!`;
		});

		sv.file(`src/lib/@my-org/sv/HelloComponent.svelte`, (content) => {
			const { ast, generateCode } = parse.svelte(content);
			const scriptAst = svelte.ensureScript(ast, { langTs: typescript });

			js.imports.addDefault(scriptAst, { as: 'content', from: './content.txt?raw' });

			ast.fragment.nodes.push(...svelte.toFragment('<p>{content}</p>'));
			ast.fragment.nodes.push(...svelte.toFragment(`<h2>Hello ${options.who}!</h2>`));

			return generateCode();
		});

		sv.file('src/routes/+page.svelte', (content) => {
			const { ast, generateCode } = parse.svelte(content);
			const scriptAst = svelte.ensureScript(ast, { langTs: typescript });

			js.imports.addDefault(scriptAst, {
				as: 'HelloComponent',
				from: `$lib/@my-org/sv/HelloComponent.svelte`
			});

			ast.fragment.nodes.push(...svelte.toFragment('<HelloComponent />'));

			return generateCode();
		});
	}
});
