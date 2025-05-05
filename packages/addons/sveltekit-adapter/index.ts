import { defineAddon, defineAddonOptions } from '@sveltejs/cli-core';
import { exports, functions, imports, object, type AstTypes } from '@sveltejs/cli-core/js';
import { parseJson, parseScript } from '@sveltejs/cli-core/parsers';

type Adapter = {
	id: string;
	package: string;
	version: string;
};

const adapters: Adapter[] = [
	{ id: 'auto', package: '@sveltejs/adapter-auto', version: '^6.0.0' },
	{ id: 'node', package: '@sveltejs/adapter-node', version: '^5.2.12' },
	{ id: 'static', package: '@sveltejs/adapter-static', version: '^3.0.8' },
	{ id: 'vercel', package: '@sveltejs/adapter-vercel', version: '^5.6.3' },
	{ id: 'cloudflare', package: '@sveltejs/adapter-cloudflare', version: '^7.0.0' },
	{ id: 'netlify', package: '@sveltejs/adapter-netlify', version: '^5.0.0' }
];

const options = defineAddonOptions({
	adapter: {
		type: 'select',
		question: 'Which SvelteKit adapter would you like to use?',
		options: adapters.map((p) => ({ value: p.id, label: p.id, hint: p.package })),
		default: 'auto'
	}
});

export default defineAddon({
	id: 'sveltekit-adapter',
	alias: 'adapter',
	shortDescription: 'deployment',
	homepage: 'https://svelte.dev/docs/kit/adapters',
	options,
	setup: ({ kit, unsupported }) => {
		if (!kit) unsupported('Requires SvelteKit');
	},
	run: ({ sv, options }) => {
		const adapter = adapters.find((a) => a.id === options.adapter)!;

		// removes previously installed adapters
		sv.file('package.json', (content) => {
			const { data, generateCode } = parseJson(content);
			const devDeps = data['devDependencies'];

			for (const pkg of Object.keys(devDeps)) {
				if (pkg.startsWith('@sveltejs/adapter-')) {
					delete devDeps[pkg];
				}
			}

			return generateCode();
		});

		sv.devDependency(adapter.package, adapter.version);

		sv.file('svelte.config.js', (content) => {
			const { ast, generateCode } = parseScript(content);

			// finds any existing adapter's import declaration
			const importDecls = ast.body.filter((n) => n.type === 'ImportDeclaration');
			const adapterImportDecl = importDecls.find(
				(importDecl) =>
					typeof importDecl.source.value === 'string' &&
					importDecl.source.value.startsWith('@sveltejs/adapter-') &&
					importDecl.importKind === 'value'
			);

			let adapterName = 'adapter';
			if (adapterImportDecl) {
				// replaces the import's source with the new adapter
				adapterImportDecl.source.value = adapter.package;
				// reset raw value, so that the string is re-generated
				adapterImportDecl.source.raw = undefined;

				adapterName = adapterImportDecl.specifiers?.find((s) => s.type === 'ImportDefaultSpecifier')
					?.local?.name as string;
			} else {
				imports.addDefault(ast, adapter.package, adapterName);
			}

			const { value: config } = exports.defaultExport(ast, object.createEmpty());
			const kitConfig = config.properties.find(
				(p) => p.type === 'Property' && p.key.type === 'Identifier' && p.key.name === 'kit'
			) as AstTypes.Property | undefined;

			if (kitConfig && kitConfig.value.type === 'ObjectExpression') {
				const adapterProp = kitConfig.value.properties.find(
					(p) => p.type === 'Property' && p.key.type === 'Identifier' && p.key.name === 'adapter'
				);
				if (adapterProp) {
					adapterProp.leadingComments = [];
				}

				// only overrides the `adapter` property so we can reset it's args
				object.overrideProperties(kitConfig.value, {
					adapter: functions.callByIdentifier(adapterName, [])
				});
			} else {
				// creates the `kit` property when absent
				object.properties(config, {
					kit: object.create({
						adapter: functions.callByIdentifier(adapterName, [])
					})
				});
			}

			return generateCode();
		});
	}
});
