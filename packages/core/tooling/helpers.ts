import { array, functions, imports, object, exports, type AstTypes } from './js/index.ts';
import { parseScript } from './parsers.ts';

export const addPlugin = (content: string): string => {
	const { ast, generateCode } = parseScript(content);

	const vitePluginName = 'devtoolsJson';
	imports.addDefault(ast, { from: 'vite-plugin-devtools-json', as: vitePluginName });

	const { value: rootObject } = exports.createDefault(ast, {
		fallback: functions.createCall({ name: 'defineConfig', args: [] })
	});

	// Handle both CallExpression (e.g., defineConfig({})) and ObjectExpression (e.g., { plugins: [] })
	let param1: AstTypes.ObjectExpression;
	if ('arguments' in rootObject && Array.isArray(rootObject.arguments)) {
		// For function calls like defineConfig({})
		param1 = functions.getArgument(rootObject as any, {
			index: 0,
			fallback: object.create({})
		});
	} else {
		// For plain object literals like { plugins: [] } - cast through unknown
		param1 = rootObject as unknown as AstTypes.ObjectExpression;
	}

	const pluginsArray = object.property(param1, { name: 'plugins', fallback: array.create() });
	const pluginFunctionCall = functions.createCall({ name: vitePluginName, args: [] });

	array.append(pluginsArray, pluginFunctionCall);

	// common.appendFromString(ast, { code: `plugins: [sveltekit(), devtoolsJson()]` });

	return generateCode();
};
