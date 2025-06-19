import { defineAddon } from '@sveltejs/cli-core';
import { array, exports, functions, imports, object } from '@sveltejs/cli-core/js';
import { parseScript } from '@sveltejs/cli-core/parsers';

export default defineAddon({
	id: 'mdsvex',
	shortDescription: 'svelte + markdown',
	homepage: 'https://mdsvex.pngwn.io',
	options: {},
	run: ({ sv }) => {
		sv.devDependency('mdsvex', '^0.12.3');

		sv.file('svelte.config.js', (content) => {
			const { ast, generateCode } = parseScript(content);

			imports.addNamed(ast, { from: 'mdsvex', imports: { mdsvex: 'mdsvex' } });

			const { value: exportDefault } = exports.createDefault(ast, {
				fallback: object.create({})
			});

			// preprocess
			let preprocessorArray = object.property(exportDefault, {
				name: 'preprocess',
				fallback: array.create()
			});
			const isArray = preprocessorArray.type === 'ArrayExpression';

			if (!isArray) {
				const previousElement = preprocessorArray;
				preprocessorArray = array.create();
				array.append(preprocessorArray, previousElement);
				object.overrideProperty(exportDefault, {
					name: 'preprocess',
					value: preprocessorArray
				});
			}

			const mdsvexCall = functions.createCall({ name: 'mdsvex', args: [] });
			array.append(preprocessorArray, mdsvexCall);

			// extensions
			const extensionsArray = object.property(exportDefault, {
				name: 'extensions',
				fallback: array.create()
			});
			array.append(extensionsArray, '.svelte');
			array.append(extensionsArray, '.svx');

			return generateCode();
		});
	}
});
