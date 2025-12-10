import { js, parseSvelte, defineAddon, defineAddonOptions, svelte } from 'sv/core';

const options = defineAddonOptions()
	.add('who', {
		question: 'To whom should the addon say hello?',
		type: 'string',
		default: 'you! 🤗'
	})
	.build();

export default defineAddon({
	id: 'sv-hello',
	options,
	setup: ({ kit, unsupported }) => {
		if (!kit) unsupported('Requires SvelteKit');
	},
	run: ({ kit, sv, options, typescript }) => {
		if (!kit) throw new Error('SvelteKit is required');

		sv.file(`src/lib/sv-hello/content.txt`, (content) => {
			return `This is a text file made by the Community Addon Template demo for the add-on: 'sv-hello'!`;
		});

		sv.file(`src/lib/sv-hello/HelloComponent.svelte`, (content) => {
			// if (!options.demo) return content;
			const { ast, generateCode } = parseSvelte(content);
			const scriptAst = svelte.ensureScript(ast, { langTs: typescript });

			js.imports.addDefault(scriptAst, { as: 'content', from: './content.txt?raw' });

			ast.fragment.nodes.push(...svelte.toFragment('<p>{content}</p>'));
			ast.fragment.nodes.push(
				...svelte.toFragment(`<h2>Hello ${options.who ?? 'Manuel & JYC'}!</h2>`)
			);

			return generateCode();
		});

		sv.file('src/routes/+page.svelte', (content) => {
			// if (!options.demo) return content;
			const { ast, generateCode } = parseSvelte(content);
			const scriptAst = svelte.ensureScript(ast, { langTs: typescript });

			js.imports.addDefault(scriptAst, {
				as: 'HelloComponent',
				from: `$lib/sv-hello/HelloComponent.svelte`
			});

			ast.fragment.nodes.push(...svelte.toFragment('<HelloComponent />'));

			return generateCode();
		});
	}
});
