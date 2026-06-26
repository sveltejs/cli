import { svelteConfig } from '@sveltejs/sv-utils';
import { defineAddon } from '../core/config.ts';

export default defineAddon({
	id: 'mdsvex',
	shortDescription: 'svelte + markdown',
	homepage: 'https://mdsvex.pngwn.io',
	options: {},
	run: ({ sv, cwd }) => {
		sv.devDependency('mdsvex', '^0.12.7');

		svelteConfig.edit({ sv, cwd }, ({ ast, property, override, js }) => {
			js.imports.addNamed(ast, { from: 'mdsvex', imports: ['mdsvex'] });

			// preprocess
			let preprocessorArray = property('preprocess', { fallback: js.array.create() });
			const isArray = preprocessorArray.type === 'ArrayExpression';

			if (!isArray) {
				const previousElement = preprocessorArray;
				preprocessorArray = js.array.create();
				js.array.append(preprocessorArray, previousElement);
				override({ preprocess: preprocessorArray });
			}

			const mdsvexCall = js.functions.createCall({ name: 'mdsvex', args: [] });
			mdsvexCall.arguments.push(js.object.create({ extensions: ['.svx', '.md'] }));
			js.array.append(preprocessorArray, mdsvexCall);

			// extensions
			const extensionsArray = property('extensions', { fallback: js.array.create() });
			js.array.append(extensionsArray, '.svelte');
			js.array.append(extensionsArray, '.svx');
			js.array.append(extensionsArray, '.md');
		});
	}
});
