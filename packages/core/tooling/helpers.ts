import { array, functions, imports, object, exports, type AstTypes, common } from './js/index.ts';
import { parseScript } from './parsers.ts';

/**
 * Get the target config object from the default export, handling wrapper functions
 *
 * @param ast - The AST of the file to modify
 * @param options.fallback - Expression or string to use as fallback if no default export exists
 * @param options.ignoreWrapper - If specified, unwraps function calls with this name
 *   - For `defineConfig({...})` use `ignoreWrapper: 'defineConfig'` to get the object inside
 *   - Leave undefined to work with the object directly (e.g., `const config: UserConfig = {...}`)
 *
 * @example
 * // For: export default defineConfig({ plugins: [...] })
 * const obj = getConfigObject(ast, { ignoreWrapper: 'defineConfig' });
 * // Returns the object inside defineConfig()
 *
 * @example
 * // For: export default { plugins: [...] }
 * const obj = getConfigObject(ast);
 * // Returns the object directly
 */
export function getConfigObject(
	ast: AstTypes.Program,
	options: {
		fallback?: AstTypes.Expression | string;
		ignoreWrapper?: string;
	} = {}
): AstTypes.ObjectExpression {
	const { fallback, ignoreWrapper } = options;

	// Get or create the default export
	let fallbackExpression: AstTypes.Expression;
	if (fallback) {
		fallbackExpression = typeof fallback === 'string' ? common.parseExpression(fallback) : fallback;
	} else {
		fallbackExpression = object.create({});
	}

	const { value: rootObject } = exports.createDefault(ast, { fallback: fallbackExpression });

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

	return configObject;
}

/**
 * Add an element to an array property in an object
 *
 * @param targetObject - The object to modify
 * @param options.code - JavaScript expression to add (as string)
 * @param options.arrayProperty - Name of the array property to modify
 * @param options.mode - Whether to 'append' (default) or 'prepend' the element
 *
 * @example
 * addToObjectArray(configObj, {
 *   code: 'eslint()',
 *   arrayProperty: 'plugins',
 *   mode: 'append'
 * });
 * // Adds eslint() to the end of the plugins array
 */
export function addToObjectArray(
	targetObject: AstTypes.ObjectExpression,
	options: {
		code: string;
		arrayProperty: string;
		mode?: 'append' | 'prepend';
	}
): void {
	const { code, arrayProperty, mode = 'append' } = options;

	// Get or create the array property
	const targetArray = object.property(targetObject, {
		name: arrayProperty,
		fallback: array.create()
	});

	// Parse the expression
	const expression = common.parseExpression(code);

	// Add to array based on mode
	if (mode === 'prepend') {
		array.prepend(targetArray, expression);
	} else {
		array.append(targetArray, expression);
	}
}

/**
 * Add code (expression) to an array property in a config object
 *
 * This is a convenience function that combines getConfigObject and addToObjectArray.
 *
 * @param options.ignoreWrapper - Controls how to handle wrapper functions:
 *   - `'defineConfig'` - For files like `export default defineConfig({...})`
 *   - `undefined` - For files like `export default {...}` or `const config = {...}`
 *
 * @example
 * // For vite.config.js with defineConfig
 * addToConfigArray(ast, {
 *   code: 'eslint()',
 *   arrayProperty: 'plugins',
 *   ignoreWrapper: 'defineConfig'
 * });
 *
 * @example
 * // For plain object config
 * addToConfigArray(ast, {
 *   code: 'middleware()',
 *   arrayProperty: 'middleware'
 *   // no ignoreWrapper needed
 * });
 */
export function addToConfigArray(
	ast: AstTypes.Program,
	options: {
		code: string;
		arrayProperty: string;
		mode?: 'append' | 'prepend';
		ignoreWrapper?: string;
		fallbackConfig?: AstTypes.Expression | string;
	}
): void {
	// Part 1: Get the target config object
	const configObject = getConfigObject(ast, {
		fallback: options.fallbackConfig,
		ignoreWrapper: options.ignoreWrapper
	});

	// Part 2: Add to the array property
	addToObjectArray(configObject, {
		code: options.code,
		arrayProperty: options.arrayProperty,
		mode: options.mode
	});
}

export const addPlugin = (content: string): string => {
	const { ast, generateCode } = parseScript(content);

	const vitePluginName = 'devtoolsJson';
	imports.addDefault(ast, { from: 'vite-plugin-devtools-json', as: vitePluginName });

	imports.addNamed(ast, { from: 'vite', imports: { defineConfig: 'defineConfig' } });

	addToConfigArray(ast, {
		code: `${vitePluginName}()`,
		arrayProperty: 'plugins',
		ignoreWrapper: 'defineConfig',
		fallbackConfig: 'defineConfig()'
	});

	return generateCode();
};
