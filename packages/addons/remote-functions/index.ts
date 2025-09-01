import {
	colors,
	defineAddon,
	defineAddonOptions,
	isVersionUnsupportedBelow
} from '@sveltejs/cli-core';
import { common, exports, object } from '@sveltejs/cli-core/js';
import { parseScript } from '@sveltejs/cli-core/parsers';
import { addToDemoPage } from '../common.ts';
import { titleCase, kebabCase, pascalCase } from 'scule';

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

		// ensure svelte & sveltekit versions
		const ensureVersion = (pkg: string, atLeast: string, setTo: string) => {
			const depVersion = dependencyVersion(pkg) ?? '0.0.0';
			const unsupported = isVersionUnsupportedBelow(depVersion, atLeast);
			if (unsupported) sv.devDependency(pkg, setTo);
		};
		ensureVersion('@sveltejs/kit', '2.27', '^2.27.0');
		ensureVersion('svelte', '5.36', '^5.36.0');

		// experimental flags
		sv.file('svelte.config.js', (content) => {
			const { ast, generateCode } = parseScript(content);

			const { value: config } = exports.createDefault(ast, { fallback: object.create({}) });

			// Handle kit.experimental.remoteFunctions
			{
				const kitConfig = object.property(config, {
					name: 'kit',
					fallback: object.create({
						experimental: {
							remoteFunctions: true
						}
					})
				});

				if (kitConfig.type === 'ObjectExpression') {
					const experimentalConfig = object.property(kitConfig, {
						name: 'experimental',
						fallback: object.create({
							remoteFunctions: true
						})
					});

					object.overrideProperty(experimentalConfig, {
						name: 'remoteFunctions',
						value: common.createLiteral(true)
					});
				}
			}

			// Handle compilerOptions.experimental.async
			{
				const compilerOptionsConfig = object.property(config, {
					name: 'compilerOptions',
					fallback: object.create({
						experimental: {
							async: true
						}
					})
				});

				if (compilerOptionsConfig.type === 'ObjectExpression') {
					const compilerExperimentalConfig = object.property(compilerOptionsConfig, {
						name: 'experimental',
						fallback: object.create({
							async: true
						})
					});

					object.overrideProperty(compilerExperimentalConfig, {
						name: 'async',
						value: common.createLiteral(true)
					});
				}
			}

			return generateCode();
		});

		// demo management
		const withDemo = options.withDemo;
		if (withDemo) {
			const name = options.demo || defaultDemoName;
			const kebabPlural = kebabCase(name) + 's';
			const pascalPlural = pascalCase(name) + 's';
			const title = titleCase(name);
			const titlePlural = title + 's';
			sv.file(`${kit.routesDirectory}/demo/+page.svelte`, (content) => {
				return addToDemoPage(content, kebabPlural);
			});

			sv.file(`${kit.routesDirectory}/demo/${kebabPlural}/${kebabPlural}.remote.${ext}`, () => {
				return `import { query } from '$app/server';

export const get${pascalPlural} = query(async () => {
  // Usually, you would get the list from your database...
	const list = [
		${Array.from({ length: 5 }, (_, i) => {
			return `{ title: '${title} ${i + 1}' }`;
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

<h1>${titlePlural}</h1>

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
