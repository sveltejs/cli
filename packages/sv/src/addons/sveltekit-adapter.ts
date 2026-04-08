import {
	addNextSteps,
	color,
	text,
	transforms,
	resolveCommandArray,
	fileExists,
	loadPackageJson,
	sanitizeName
} from '@sveltejs/sv-utils';
import { defineAddon, defineAddonOptions } from '../core/config.ts';

const adapters = [
	{ id: 'auto', package: '@sveltejs/adapter-auto', version: '^7.0.0' },
	{ id: 'node', package: '@sveltejs/adapter-node', version: '^5.5.2' },
	{ id: 'static', package: '@sveltejs/adapter-static', version: '^3.0.10' },
	{ id: 'vercel', package: '@sveltejs/adapter-vercel', version: '^6.3.1' },
	{ id: 'cloudflare', package: '@sveltejs/adapter-cloudflare', version: '^7.2.6' },
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
	setup: ({ isKit, unsupported }) => {
		if (!isKit) unsupported('Requires SvelteKit');
	},
	run: ({ sv, options, file, cwd }) => {
		const adapter = adapters.find((a) => a.id === options.adapter)!;

		// removes previously installed adapters
		sv.file(
			file.package,
			transforms.json(({ data }) => {
				const devDeps = data['devDependencies'];

				for (const pkg of Object.keys(devDeps)) {
					if (pkg.startsWith('@sveltejs/adapter-')) {
						delete devDeps[pkg];
					}
				}

				// in sk 3, we will keep "preview": "vite preview" like any other adapter
				if (options.adapter === 'cloudflare') {
					const preview =
						options.cfTarget === 'workers'
							? 'wrangler dev .svelte-kit/cloudflare/_worker.js --port 4173'
							: 'wrangler pages dev .svelte-kit/cloudflare --port 4173';
					data.scripts.preview = preview;
				}
			})
		);

		sv.devDependency(adapter.package, adapter.version);

		sv.file(
			file.svelteConfig,
			transforms.script(({ ast, comments, js }) => {
				// finds any existing adapter's import declaration
				const imports = ast.body.filter((n) => n.type === 'ImportDeclaration');
				const adapterImports = imports.find(
					(importDecl) =>
						typeof importDecl.source.value === 'string' &&
						importDecl.source.value.startsWith('@sveltejs/adapter-') &&
						importDecl.importKind === 'value'
				);

				let adapterName = 'adapter';
				if (adapterImports) {
					// replaces the import's source with the new adapter
					adapterImports.source.value = adapter.package;
					// reset raw value, so that the string is re-generated
					adapterImports.source.raw = undefined;

					const defaultSpecifier = adapterImports.specifiers?.find(
						(s) => s.type === 'ImportDefaultSpecifier'
					);
					adapterName = defaultSpecifier!.local.name;
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
			})
		);

		if (adapter.package === '@sveltejs/adapter-cloudflare') {
			sv.devDependency('wrangler', '^4.63.0');

			// default to jsonc
			const ext = fileExists(cwd, 'wrangler.toml') ? 'toml' : 'jsonc';

			// Setup Cloudflare workers/pages config
			const applyWranglerConfig = (data: Record<string, any>) => {
				if (ext === 'jsonc') {
					data.$schema ??= './node_modules/wrangler/config-schema.json';
				}

				if (!data.name) {
					const pkg = loadPackageJson(cwd);
					data.name = sanitizeName(pkg.data.name, 'wrangler');
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
			};

			sv.file(
				`wrangler.${ext}`,
				ext === 'toml'
					? transforms.toml(({ data }) => applyWranglerConfig(data))
					: transforms.json(({ data }) => applyWranglerConfig(data))
			);

			if (file.typeConfig) {
				sv.file(
					file.gitignore,
					transforms.text(({ content }) => {
						if (content.length === 0) return false;
						return text.upsert(content, '/worker-configuration.d.ts', {
							comment: 'Cloudflare Types'
						});
					})
				);

				// Setup wrangler types command
				sv.file(
					file.package,
					transforms.json(({ data, json }) => {
						json.packageScriptsUpsert(data, 'gen', 'wrangler types');
					})
				);

				// Add Cloudflare generated types to jsconfig/tsconfig
				sv.file(
					file.typeConfig,
					transforms.json(({ data }) => {
						data.compilerOptions ??= {};
						data.compilerOptions.types ??= [];
						data.compilerOptions.types.push('./worker-configuration.d.ts');
					})
				);

				sv.file(
					'src/app.d.ts',
					transforms.script(({ ast, comments, js }) => {
						const platform = js.kit.addGlobalAppInterface(ast, { name: 'Platform' });
						if (!platform) {
							throw new Error('Failed detecting `platform` interface in `src/app.d.ts`');
						}

						// remove the commented out placeholder since we're adding the real one
						comments.remove((c) => c.type === 'Line' && c.value.trim() === 'interface Platform {}');

						platform.body.body.push(
							js.common.createTypeProperty('env', 'Env'),
							js.common.createTypeProperty('ctx', 'ExecutionContext'),
							js.common.createTypeProperty('caches', 'CacheStorage'),
							js.common.createTypeProperty('cf', 'IncomingRequestCfProperties', true)
						);
					})
				);
			}
		}

		if (options.adapter === 'cloudflare') {
			sv.file('README.md', (content) => {
				return addNextSteps(content, [
					'Cloudflare Adapter',
					'- Run `npm run gen` to generate Cloudflare types'
				]);
			});
		}
	},
	nextSteps({ options, packageManager }) {
		const steps: string[] = [];
		if (options.adapter === 'cloudflare') {
			steps.push(
				`Run ${color.command(resolveCommandArray(packageManager, 'run', ['gen']))} to update ${color.addon('cloudflare')} types`
			);
		}
		return steps;
	}
});
