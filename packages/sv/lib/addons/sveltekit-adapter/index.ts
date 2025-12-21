import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
	defineAddon,
	defineAddonOptions,
	js,
	parse,
	resolveCommand,
	fileExists,
	type AstTypes
} from '../../core.ts';

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
	.add('cfTarget', {
		condition: (options) => options.adapter === 'cloudflare',
		type: 'select',
		question: 'Are you deploying to Workers (assets) or Pages?',
		default: 'workers',
		options: [
			{ value: 'workers', label: 'Workers', hint: 'Recommended way to deploy to Cloudflare' },
			{ value: 'pages', label: 'Pages' }
		]
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
	run: ({ sv, options, files, cwd, packageManager, typescript }) => {
		const adapter = adapters.find((a) => a.id === options.adapter)!;

		// removes previously installed adapters
		sv.file(files.package, (content) => {
			const { data, generateCode } = parse.json(content);
			const devDeps = data['devDependencies'];

			for (const pkg of Object.keys(devDeps)) {
				if (pkg.startsWith('@sveltejs/adapter-')) {
					delete devDeps[pkg];
				}
			}

			// in sk 3, we will keep "preview": "vite preview" like any other adapter
			if (options.adapter === 'cloudflare') {
				if (options.cfTarget === 'workers') {
					data.scripts.preview = 'wrangler dev .svelte-kit/cloudflare/_worker.js';
				} else if (options.cfTarget === 'pages') {
					data.scripts.preview = 'wrangler pages dev .svelte-kit/cloudflare';
				}
			}

			return generateCode();
		});

		sv.devDependency(adapter.package, adapter.version);

		sv.file(files.svelteConfig, (content) => {
			const { ast, comments, generateCode } = parse.script(content);

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
				js.imports.addDefault(ast, { from: adapter.package, as: adapterName });
			}

			const { value: config } = js.exports.createDefault(ast, { fallback: js.object.create({}) });

			// override the adapter property
			js.object.overrideProperties(config, {
				kit: {
					adapter: js.functions.createCall({ name: adapterName, args: [], useIdentifiers: true })
				}
			});

			// reset the comment for non-auto adapters
			if (adapter.package !== '@sveltejs/adapter-auto') {
				const fallback = js.object.create({});
				const cfgKitValue = js.object.property(config, { name: 'kit', fallback });

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

		if (adapter.package === '@sveltejs/adapter-cloudflare') {
			sv.devDependency('wrangler', '^4.56.0');

			// default to jsonc
			const configFormat = fileExists(cwd, 'wrangler.toml') ? 'toml' : 'jsonc';

			// Setup Cloudlfare workers/pages config
			sv.file(`wrangler.${configFormat}`, (content) => {
				const { data, generateCode } =
					configFormat === 'jsonc' ? parse.json(content) : parse.toml(content);

				if (configFormat === 'jsonc') {
					data.$schema ??= './node_modules/wrangler/config-schema.json';
				}

				if (!data.name) {
					const pkg = parse.json(readFileSync(join(cwd, files.package), 'utf-8'));
					data.name = pkg.data.name;
				}

				data.compatibility_date ??= new Date().toISOString().split('T')[0];
				data.compatibility_flags ??= [];

				if (
					!data.compatibility_flags.includes('nodejs_compat') &&
					!data.compatibility_flags.includes('nodejs_als')
				) {
					data.compatibility_flags.push('nodejs_als');
				}

				switch (options.cfTarget) {
					case 'workers':
						data.main = '.svelte-kit/cloudflare/_worker.js';
						data.assets ??= {};
						data.assets.binding = 'ASSETS';
						data.assets.directory = '.svelte-kit/cloudflare';
						data.workers_dev = true;
						data.preview_urls = true;
						break;

					case 'pages':
						data.pages_build_output_dir = '.svelte-kit/cloudflare';
						break;
				}

				return generateCode();
			});

			const jsconfig = fileExists(cwd, 'jsconfig.json');
			const typeChecked = typescript || jsconfig;

			if (typeChecked) {
				// Ignore generated Cloudflare Types
				sv.file(files.gitignore, (content) => {
					return content.includes('.wrangler') && content.includes('worker-configuration.d.ts')
						? content
						: `${content.trimEnd()}\n\n# Cloudflare Types\n/worker-configuration.d.ts`;
				});

				// Setup wrangler types command
				sv.file(files.package, (content) => {
					const { data, generateCode } = parse.json(content);

					data.scripts ??= {};
					data.scripts.types = 'wrangler types';
					const { command, args } = resolveCommand(packageManager, 'run', ['types'])!;
					data.scripts.prepare = data.scripts.prepare
						? `${command} ${args.join(' ')} && ${data.scripts.prepare}`
						: `${command} ${args.join(' ')}`;

					return generateCode();
				});

				// Add Cloudflare generated types to tsconfig
				sv.file(`${jsconfig ? 'jsconfig' : 'tsconfig'}.json`, (content) => {
					const { data, generateCode } = parse.json(content);

					data.compilerOptions ??= {};
					data.compilerOptions.types ??= [];
					data.compilerOptions.types.push('worker-configuration.d.ts');

					return generateCode();
				});

				sv.file('src/app.d.ts', (content) => {
					const { ast, generateCode } = parse.script(content);

					const platform = js.kit.addGlobalAppInterface(ast, { name: 'Platform' });
					if (!platform) {
						throw new Error('Failed detecting `platform` interface in `src/app.d.ts`');
					}

					platform.body.body.push(
						createCloudflarePlatformType('env', 'Env'),
						createCloudflarePlatformType('ctx', 'ExecutionContext'),
						createCloudflarePlatformType('caches', 'CacheStorage'),
						createCloudflarePlatformType('cf', 'IncomingRequestCfProperties', true)
					);

					return generateCode();
				});
			}
		}
	}
});

function createCloudflarePlatformType(
	name: string,
	value: string,
	optional = false
): AstTypes.TSInterfaceBody['body'][number] {
	return {
		type: 'TSPropertySignature',
		key: {
			type: 'Identifier',
			name
		},
		computed: false,
		optional,
		typeAnnotation: {
			type: 'TSTypeAnnotation',
			typeAnnotation: {
				type: 'TSTypeReference',
				typeName: {
					type: 'Identifier',
					name: value
				}
			}
		}
	};
}
