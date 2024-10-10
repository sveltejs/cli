import { options } from './options.ts';
import { defineAdderConfig } from '@svelte-cli/core';
import { array, exports, functions, imports, object } from '@svelte-cli/core/js';
import { parseScript } from '@svelte-cli/core/parsers';

export const adder = defineAdderConfig({
	metadata: {
		id: 'mdsvex',
		name: 'mdsvex',
		description: 'svelte in markdown',
		environments: { svelte: true, kit: true },
		website: {
			logo: './mdsvex.svg',
			keywords: ['mdsvex', 'svelte', 'markdown'],
			documentation: 'https://mdsvex.pngwn.io/docs'
		}
	},
	options,
	packages: [{ name: 'mdsvex', version: '^0.11.2', dev: true }],
	files: [
		{
			name: () => 'svelte.config.js',
			content: ({ content }) => {
				const { ast, generateCode } = parseScript(content);

				imports.addNamed(ast, 'mdsvex', { mdsvex: 'mdsvex' });

				const { value: exportDefault } = exports.defaultExport(ast, object.createEmpty());

				// preprocess
				let preprocessorArray = object.property(exportDefault, 'preprocess', array.createEmpty());
				const isArray = preprocessorArray.type === 'ArrayExpression';

				if (!isArray) {
					const previousElement = preprocessorArray;
					preprocessorArray = array.createEmpty();
					array.push(preprocessorArray, previousElement);
					object.overrideProperty(exportDefault, 'preprocess', preprocessorArray);
				}

				const mdsvexCall = functions.call('mdsvex', []);
				array.push(preprocessorArray, mdsvexCall);

				// extensions
				const extensionsArray = object.property(exportDefault, 'extensions', array.createEmpty());
				array.push(extensionsArray, '.svelte');
				array.push(extensionsArray, '.svx');

				return generateCode();
			}
		}
	]
});
