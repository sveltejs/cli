import {
	colors,
	defineAddon,
	defineAddonOptions,
	isVersionUnsupportedBelow
} from '@sveltejs/cli-core';
import { common, exports, object, type AstTypes } from '@sveltejs/cli-core/js';
import { parseScript } from '@sveltejs/cli-core/parsers';
import { addToDemoPage } from '../common.ts';
import { capitalCase, kebabCase, pascalCase } from 'change-case';

const defaultDemoName = 'myPost';
const options = defineAddonOptions({
	withDemo: {
		question: `Do you want to include a demo? ${colors.dim('(includes a query & demo page)')}`,
		type: 'boolean',
		default: true
	},
	demo: {
		question: 'Which name would you like to use for the demo?',
		type: 'string',
		default: '',
		placeholder: defaultDemoName,
		condition: ({ withDemo }) => withDemo === true
	}
});

export default defineAddon({
	id: 'remote-functions',
	shortDescription: 'remote functions',
	homepage: 'https://svelte.dev/docs/kit/remote-functions',
	options,
	setup: ({ kit, unsupported }) => {
		if (!kit) unsupported('Requires SvelteKit');
	},

	run: ({ sv, options, dependencyVersion, kit, typescript }) => {
		if (!kit) throw new Error('SvelteKit is required');
		const ext = typescript ? 'ts' : 'js';

		// minimum sveltekit version
		const minimumVersion = '2.27';
		const kitVersion = dependencyVersion('@sveltejs/kit') ?? '0.0.0';
		const unsupported = isVersionUnsupportedBelow(kitVersion!, minimumVersion);
		if (unsupported) {
			sv.devDependency('@sveltejs/kit', '^2.27.0');
		}

		// experimental flags
		sv.file('svelte.config.js', (content) => {
			const { ast, generateCode } = parseScript(content);

			const { value: config } = exports.createDefault(ast, { fallback: object.create({}) });

			// Handle kit.experimental.remoteFunctions
			const kitConfig = config.properties.find(
				(p) => p.type === 'Property' && p.key.type === 'Identifier' && p.key.name === 'kit'
			) as AstTypes.Property | undefined;

			if (kitConfig && kitConfig.value.type === 'ObjectExpression') {
				// Check if experimental property exists in kit
				const experimentalProp = kitConfig.value.properties.find(
					(p) =>
						p.type === 'Property' && p.key.type === 'Identifier' && p.key.name === 'experimental'
				) as AstTypes.Property | undefined;

				if (experimentalProp && experimentalProp.value.type === 'ObjectExpression') {
					// Add remoteFunctions: true to existing experimental
					object.overrideProperty(experimentalProp.value, {
						name: 'remoteFunctions',
						value: common.createLiteral(true)
					});
				} else {
					// Create experimental property with remoteFunctions: true
					object.addProperties(kitConfig.value, {
						properties: {
							experimental: object.create({
								remoteFunctions: true
							})
						}
					});
				}
			} else {
				// Create kit property with experimental.remoteFunctions
				object.addProperties(config, {
					properties: {
						kit: object.create({
							experimental: {
								remoteFunctions: true
							}
						})
					}
				});
			}

			// Handle compilerOptions.experimental.async
			const compilerOptionsProp = config.properties.find(
				(p) =>
					p.type === 'Property' && p.key.type === 'Identifier' && p.key.name === 'compilerOptions'
			) as AstTypes.Property | undefined;

			if (compilerOptionsProp && compilerOptionsProp.value.type === 'ObjectExpression') {
				// Check if experimental property exists in compilerOptions
				const compilerExperimentalProp = compilerOptionsProp.value.properties.find(
					(p) =>
						p.type === 'Property' && p.key.type === 'Identifier' && p.key.name === 'experimental'
				) as AstTypes.Property | undefined;

				if (
					compilerExperimentalProp &&
					compilerExperimentalProp.value.type === 'ObjectExpression'
				) {
					// Add async: true to existing experimental
					object.overrideProperty(compilerExperimentalProp.value, {
						name: 'async',
						value: common.createLiteral(true)
					});
				} else {
					// Create experimental property with async: true
					object.addProperties(compilerOptionsProp.value, {
						properties: {
							experimental: object.create({
								async: true
							})
						}
					});
				}
			} else {
				// Create compilerOptions property with experimental.async
				object.addProperties(config, {
					properties: {
						compilerOptions: object.create({
							experimental: {
								async: true
							}
						})
					}
				});
			}

			return generateCode();
		});

		// demo management
		const withDemo = options.withDemo;
		if (withDemo) {
			const name = options.demo || defaultDemoName;
			const kebabPlural = kebabCase(name) + 's';
			const pascalPlural = pascalCase(name) + 's';
			const capital = capitalCase(name);
			const capitalPlural = capital + 's';
			sv.file(`${kit.routesDirectory}/demo/+page.svelte`, (content) => {
				return addToDemoPage(content, kebabPlural);
			});

			sv.file(`${kit.routesDirectory}/demo/${kebabPlural}/${kebabPlural}.remote.${ext}`, () => {
				return `import { query } from '$app/server';

export const get${pascalPlural} = query(async () => {
  // Usually, you would get the list from your database...
	const list = [
		${Array.from({ length: 5 }, (_, i) => {
			return `{ title: '${capital} ${i + 1}' }`;
		})}
	];

	return list;
});`;
			});

			const script = typescript ? "<script lang='ts'>" : '<script>';
			sv.file(`${kit.routesDirectory}/demo/${kebabPlural}/+layout.svelte`, () => {
				return `${script}
	let { children } = $props();
</script>

<svelte:boundary>
	{@render children()}

	{#snippet failed()}
		boundary oops!
	{/snippet}
</svelte:boundary>`;
			});

			sv.file(`${kit.routesDirectory}/demo/${kebabPlural}/+page.svelte`, () => {
				return `${script}
	import { get${pascalPlural} } from './${kebabPlural}.remote';

	const query = get${pascalPlural}();
</script>

<h1>${capitalPlural}</h1>

{#if query.error}
	<p>query oops!</p>
{:else if query.loading}
	<p>loading...</p>
{:else}
	<ul>
		{#each query.current as { title }}
			<li>{title}</li>
		{/each}
	</ul>
{/if}`;
			});
		}
	}
});
