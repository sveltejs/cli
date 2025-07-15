import { array, functions, imports, object, exports, type AstTypes, common } from './js/index.ts';
import { parseScript } from './parsers.ts';

/**
 * Add code (expression) to an array property in a config object
 */
export function addToConfigArray(
	ast: AstTypes.Program,
	options: {
		code: string;
		arrayProperty: string;
		ignoreWrapper?: string;
		fallbackConfig?: AstTypes.Expression | string;
	}
): void {
	const { code, arrayProperty, ignoreWrapper, fallbackConfig } = options;

	// Get or create the default export
	let fallback: AstTypes.Expression;
	if (fallbackConfig) {
		fallback =
			typeof fallbackConfig === 'string' ? common.parseExpression(fallbackConfig) : fallbackConfig;
	} else {
		fallback = object.create({});
	}

	const { value: rootObject } = exports.createDefault(ast, { fallback });

	// Handle wrapper functions (e.g., defineConfig({})) if ignoreWrapper is specified
	let configObject: AstTypes.ObjectExpression;
	if (ignoreWrapper && 'arguments' in rootObject && Array.isArray(rootObject.arguments)) {
		// Check if this is the wrapper we want to ignore
		if (
			rootObject.type === 'CallExpression' &&
			rootObject.callee.type === 'Identifier' &&
			rootObject.callee.name === ignoreWrapper
		) {
			// For wrapper function calls like defineConfig({})
			configObject = functions.getArgument(rootObject as any, {
				index: 0,
				fallback: object.create({})
			});
		} else {
			// For other function calls, treat as the config object
			configObject = rootObject as unknown as AstTypes.ObjectExpression;
		}
	} else {
		// For plain object literals
		configObject = rootObject as unknown as AstTypes.ObjectExpression;
	}

	// Get or create the array property
	const targetArray = object.property(configObject, {
		name: arrayProperty,
		fallback: array.create()
	});

	// Parse and append the expression
	const expression = common.parseExpression(code);
	array.append(targetArray, expression);
}

export const addPlugin = (content: string): string => {
	const { ast, generateCode } = parseScript(content);

	const vitePluginName = 'devtoolsJson';
	imports.addDefault(ast, { from: 'vite-plugin-devtools-json', as: vitePluginName });

	addToConfigArray(ast, {
		code: `${vitePluginName}()`,
		arrayProperty: 'plugins',
		ignoreWrapper: 'defineConfig'
	});

	return generateCode();
};
