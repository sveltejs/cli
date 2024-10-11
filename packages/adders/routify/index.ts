import { defineAdder } from '@svelte-cli/core';
import { array, exports, functions, imports, object, variables } from '@svelte-cli/core/js';
import * as html from '@svelte-cli/core/html';
import { parseScript, parseSvelte } from '@svelte-cli/core/parsers';

export default defineAdder({
	id: 'routify',
	name: 'Routify',
	description: 'The Router that Grows With You',
	environments: { svelte: true, kit: false },
	logo: './routify.svg',
	documentation: 'https://routify.dev',
	options: {},
	packages: [{ name: '@roxi/routify', version: 'next', dev: true }],
	files: [
		{
			name: ({ typescript }) => `vite.config.${typescript ? 'ts' : 'js'}`,
			content: ({ content }) => {
				const { ast, generateCode } = parseScript(content);
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
				return generateCode();
			}
		},
		{
			name: () => 'src/App.svelte',
			content: ({ content }) => {
				const { script, template, generateCode } = parseSvelte(content);
				imports.addNamed(script.ast, '@roxi/routify', {
					Router: 'Router',
					createRouter: 'createRouter'
				});
				imports.addDefault(script.ast, '../.routify/routes.default.js', 'routes');

				const routesObject = object.createEmpty();
				const routesIdentifier = variables.identifier('routes');
				object.property(routesObject, 'routes', routesIdentifier);
				const createRouterFunction = functions.call('createRouter', []);
				createRouterFunction.arguments.push(routesObject);
				const routerVariableDeclaration = variables.declaration(
					script.ast,
					'const',
					'router',
					createRouterFunction
				);
				exports.namedExport(script.ast, 'router', routerVariableDeclaration);

				const router = html.element('Router', { '{router}': '' });
				html.insertElement(template.ast.childNodes, router);
				return generateCode({ script: script.generateCode(), template: template.generateCode() });
			}
		},
		{
			name: () => 'src/routes/index.svelte',
			content: ({ content }) => {
				const htmlString = `${routifyDemoHtml}<p>On index</p>`;
				return content + htmlString;
			}
		},
		{
			name: () => 'src/routes/demo.svelte',
			content: ({ content }) => {
				const htmlString = `${routifyDemoHtml}<p>On demo</p>`;
				return content + htmlString;
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
