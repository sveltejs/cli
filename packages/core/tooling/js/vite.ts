import { array, functions, imports, object, exports, type AstTypes, common } from './index.ts';

function exportDefaultConfig(
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
			// For wrapper function calls like defineConfig({}) or defineConfig(() => { return {}; })
			const firstArg = functions.getArgument<AstTypes.Expression>(rootObject as any, {
				index: 0,
				fallback: object.create({})
			});

			// Check if the first argument is an arrow function that returns an object
			if (firstArg.type === 'ArrowFunctionExpression') {
				const arrowFunction = firstArg as AstTypes.ArrowFunctionExpression;
				// Handle arrow function case: defineConfig(() => { return { ... }; })
				if (arrowFunction.body.type === 'BlockStatement') {
					// Look for a return statement in the block
					const returnStatement = arrowFunction.body.body.find(
						(stmt: AstTypes.Statement): stmt is AstTypes.ReturnStatement =>
							stmt.type === 'ReturnStatement'
					);

					if (returnStatement && returnStatement.argument?.type === 'ObjectExpression') {
						configObject = returnStatement.argument;
					} else {
						// If no return statement with object found, create fallback object and add return statement
						configObject = object.create({});
						const newReturnStatement: AstTypes.ReturnStatement = {
							type: 'ReturnStatement',
							argument: configObject
						};
						arrowFunction.body.body.push(newReturnStatement);
					}
				} else if (arrowFunction.body.type === 'ObjectExpression') {
					// Handle arrow function with expression body: defineConfig(() => ({ ... }))
					configObject = arrowFunction.body;
				} else {
					// Arrow function doesn't return an object, create fallback and modify the function
					configObject = object.create({});
					arrowFunction.body = configObject;
					arrowFunction.expression = true;
				}
			} else if (firstArg.type === 'ObjectExpression') {
				// Direct object argument: defineConfig({ ... })
				configObject = firstArg;
			} else {
				// Fallback case - create a new object
				configObject = object.create({});
			}
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

function addInArrayOfObject(
	ast: AstTypes.ObjectExpression,
	options: {
		arrayProperty: string;
	} & Parameters<typeof addPlugin>[1]
): void {
	const { code, arrayProperty, mode = 'append' } = options;

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

export const addPlugin = (
	ast: AstTypes.Program,
	options: {
		code: string;
		/** default: `append` */
		mode?: 'append' | 'prepend';
	}
): void => {
	// Step 1: Get the config object, or fallback.
	imports.addNamed(ast, { from: 'vite', imports: { defineConfig: 'defineConfig' } });
	const configObject = exportDefaultConfig(ast, {
		fallback: 'defineConfig()',
		ignoreWrapper: 'defineConfig'
	});

	// Step 2: Add the plugin to the plugins array
	addInArrayOfObject(configObject, {
		arrayProperty: 'plugins',
		...options
	});
};
