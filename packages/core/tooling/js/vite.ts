import { array, functions, imports, object, exports, type AstTypes, common } from './index.ts';
import { parseScript } from '../parsers.ts';

export function exportDefaultConfig(
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

export function addInArrayOfObject(
	ast: AstTypes.ObjectExpression,
	options: {
		array: string;
		code: string;
		/** default: `append` */
		mode?: 'append' | 'prepend';
	}
): void {
	const { code, array: arrayProperty, mode = 'append' } = options;

	// Get or create the array property
	const targetArray = object.property(ast, {
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

export const addPluginToViteConfig = (
	content: string,
	fn: (
		ast: AstTypes.Program,
		o: {
			configObject: AstTypes.ObjectExpression;
			add: (options: { code: string; mode?: 'append' | 'prepend' }) => void;
		}
	) => void
): string => {
	const { ast, generateCode } = parseScript(content);

	// Step 1: Get the config object, or fallback.
	imports.addNamed(ast, { from: 'vite', imports: { defineConfig: 'defineConfig' } });
	const configObject = exportDefaultConfig(ast, {
		fallback: 'defineConfig()',
		ignoreWrapper: 'defineConfig'
	});

	// Step 2: Add the plugin to the plugins array
	fn(ast, {
		configObject,
		add: (options) =>
			addInArrayOfObject(configObject, {
				array: 'plugins',
				...options
			})
	});

	return generateCode();
};
