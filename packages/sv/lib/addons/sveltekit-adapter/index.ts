import { defineAddon, defineAddonOptions } from '../../core/index.ts';
import { exports, functions, imports, object } from '../../core/tooling/js/index.ts';
import { parseJson, parseScript } from '../../core/tooling/parsers.ts';

const adapters = [
	{ id: 'auto', package: '@sveltejs/adapter-auto', version: '^7.0.0' },
	{ id: 'node', package: '@sveltejs/adapter-node', version: '^5.4.0' },
	{ id: 'static', package: '@sveltejs/adapter-static', version: '^3.0.10' },
	{ id: 'vercel', package: '@sveltejs/adapter-vercel', version: '^6.2.0' },
	{ id: 'cloudflare', package: '@sveltejs/adapter-cloudflare', version: '^7.2.4' },
	{ id: 'netlify', package: '@sveltejs/adapter-netlify', version: '^5.2.4' }
] as const;

const options = defineAddonOptions()
	.add('adapter', {
		type: 'select',
		question: 'Which SvelteKit adapter would you like to use?',
		default: 'auto',
		options: adapters.map((p) => ({ value: p.id, label: p.id, hint: p.package }))
	})
	.build();

export default defineAddon({
	id: 'sveltekit-adapter',
	alias: 'adapter',
	shortDescription: 'deployment',
	homepage: 'https://svelte.dev/docs/kit/adapters',
	options,
	setup: ({ kit, unsupported }) => {
		if (!kit) unsupported('Requires SvelteKit');
	},
	run: ({ sv, options, files }) => {
		const adapter = adapters.find((a) => a.id === options.adapter)!;

		// removes previously installed adapters
		sv.file(files.package, (content) => {
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

		sv.file(files.svelteConfig, (content) => {
			const { ast, comments, generateCode } = parseScript(content);

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
				imports.addDefault(ast, { from: adapter.package, as: adapterName });
			}

			const { value: config } = exports.createDefault(ast, { fallback: object.create({}) });

			// override the adapter property
			object.overrideProperties(config, {
				kit: {
					adapter: functions.createCall({ name: adapterName, args: [], useIdentifiers: true })
				}
			});

			// reset the comment for non-auto adapters
			if (adapter.package !== '@sveltejs/adapter-auto') {
				const fallback = object.create({});
				const cfgKitValue = object.property(config, { name: 'kit', fallback });

				// removes any existing adapter auto comments
				comments.remove(
					(c) =>
						c.loc &&
						cfgKitValue.loc &&
						c.loc.start.line >= cfgKitValue.loc.start.line &&
						c.loc.end.line <= cfgKitValue.loc.end.line
				);
			}

			return generateCode();
		});
	}
});
