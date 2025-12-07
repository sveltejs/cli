import { js, parseSvelte, defineAddon, defineAddonOptions, svelte } from 'sv/core';

export const options = defineAddonOptions()
	// .add('demo', {
	// 	question: 'Do you want to use a demo?',
	// 	type: 'boolean',
	// 	default: false
	// })
	.build();

export default defineAddon({
	id: 'create-addon',
	options,
	setup: ({ kit, unsupported }) => {
		if (!kit) unsupported('Requires SvelteKit');
	},
	run: ({ sv, options, typescript }) => {
		sv.file(`src/lib/create-addon/addon-template-demo.txt`, (content) => {
			// if (!options.demo) return content;
			return `This is a text file made by the Community Addon Template demo! with your add-on: create-addon!`;
		});

		sv.file(`src/lib/create-addon/DemoComponent.svelte`, (content) => {
			// if (!options.demo) return content;
			const { ast, generateCode } = parseSvelte(content);
			const scriptAst = svelte.ensureScript(ast, { langTs: typescript });

			js.imports.addDefault(scriptAst, { from: './addon-template-demo.txt?raw', as: 'demo' });

			return generateCode();
		});

		sv.file('src/routes/+page.svelte', (content) => {
			// if (!options.demo) return content;
			const { ast, generateCode } = parseSvelte(content);
			const scriptAst = svelte.ensureScript(ast, { langTs: typescript });

			js.imports.addDefault(scriptAst, {
				from: `$lib/create-addon/DemoComponent.svelte`,
				as: 'DemoComponent'
			});

			ast.fragment.nodes.push(...svelte.toFragment('<DemoComponent />'));

			return generateCode();
		});
	}
});
