import { defineAddon, js, parse } from '../core.ts';

export default defineAddon({
	id: 'mdsvex',
	shortDescription: 'svelte + markdown',
	homepage: 'https://mdsvex.pngwn.io',
	options: {},
	run: ({ sv, files }) => {
		sv.devDependency('mdsvex', '^0.12.6');

		sv.file(files.svelteConfig, (content) => {
			const { ast, generateCode } = parse.script(content);

			js.imports.addNamed(ast, { from: 'mdsvex', imports: ['mdsvex'] });

			const { value: exportDefault } = js.exports.createDefault(ast, {
				fallback: js.object.create({})
			});

			// preprocess
			let preprocessorArray = js.object.property(exportDefault, {
				name: 'preprocess',
				fallback: js.array.create()
			});
			const isArray = preprocessorArray.type === 'ArrayExpression';

			if (!isArray) {
				const previousElement = preprocessorArray;
				preprocessorArray = js.array.create();
				js.array.append(preprocessorArray, previousElement);
				js.object.overrideProperties(exportDefault, {
					preprocess: preprocessorArray
				});
			}

			const mdsvexCall = js.functions.createCall({ name: 'mdsvex', args: [] });
			js.array.append(preprocessorArray, mdsvexCall);

			// extensions
			const extensionsArray = js.object.property(exportDefault, {
				name: 'extensions',
				fallback: js.array.create()
			});
			js.array.append(extensionsArray, '.svelte');
			js.array.append(extensionsArray, '.svx');

			return generateCode();
		});
	}
});
