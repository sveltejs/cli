import { defineAdderConfig } from '@svelte-cli/core';
import { options } from './options.ts';
import { array, functions, imports, object, variables } from '@svelte-cli/core/js';
import * as html from '@svelte-cli/core/html';

export const adder = defineAdderConfig({
	metadata: {
		id: 'routify',
		name: 'Routify',
		description: 'The Router that Grows With You',
		environments: { svelte: true, kit: false },
		website: {
			logo: './routify.svg',
			keywords: ['routify', 'svelte', 'router'],
			documentation: 'https://routify.dev'
		}
	},
	options,
	integrationType: 'inline',
	packages: [{ name: '@roxi/routify', version: 'next', dev: true }],
	files: [
		{
			name: ({ typescript }) => `vite.config.${typescript ? 'ts' : 'js'}`,
			contentType: 'script',
			content: ({ ast }) => {
				const vitePluginName = 'routify';
				imports.addDefault(ast, '@roxi/routify/vite-plugin', vitePluginName);

				const { value: rootObject } = exports.defaultExport(
					ast,
					functions.call('defineConfig', [])
				);
				const param1 = functions.argumentByIndex(rootObject, 0, object.createEmpty());

				const pluginsArray = object.property(param1, 'plugins', array.createEmpty());
				const pluginFunctionCall = functions.call(vitePluginName, []);
				const pluginConfig = object.createEmpty();
				functions.argumentByIndex(pluginFunctionCall, 0, pluginConfig);

				array.push(pluginsArray, pluginFunctionCall);
			}
		},
		{
			name: () => 'src/App.svelte',
			contentType: 'svelte',
			content: ({ jsAst, htmlAst }) => {
				imports.addNamed(jsAst, '@roxi/routify', {
					Router: 'Router',
					createRouter: 'createRouter'
				});
				imports.addDefault(jsAst, '../.routify/routes.default.js', 'routes');

				const routesObject = object.createEmpty();
				const routesIdentifier = variables.identifier('routes');
				object.property(routesObject, 'routes', routesIdentifier);
				const createRouterFunction = functions.call('createRouter', []);
				createRouterFunction.arguments.push(routesObject);
				const routerVariableDeclaration = variables.declaration(
					jsAst,
					'const',
					'router',
					createRouterFunction
				);
				exports.namedExport(jsAst, 'router', routerVariableDeclaration);

				const router = html.element('Router', { '{router}': '' });
				html.insertElement(htmlAst.childNodes, router);
			}
		},
		{
			name: () => 'src/routes/index.svelte',
			contentType: 'svelte',
			content: ({ htmlAst }) => {
				const htmlString = `${routifyDemoHtml}<p>On index</p>`;
				html.addFromRawHtml(htmlAst.childNodes, htmlString);
			}
		},
		{
			name: () => 'src/routes/demo.svelte',
			contentType: 'svelte',
			content: ({ htmlAst }) => {
				const htmlString = `${routifyDemoHtml}<p>On demo</p>`;
				html.addFromRawHtml(htmlAst.childNodes, htmlString);
			}
		}
	]
});

const routifyDemoHtml = `
<div class="routify-demo">
    <a class="index" style="margin: 5px;" href="/">Index</a>
    <a class="demo" style="margin: 5px;" href="/demo">Demo</a>
</div>
`;
