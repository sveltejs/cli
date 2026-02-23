import { type AstTypes, array, common, exports, functions, imports, object, variables } from './index.ts';

function isConfigWrapper(
	callExpression: AstTypes.CallExpression,
	knownWrappers: string[]
): boolean {
	// Check if this is a call to defineConfig or any function that looks like a config wrapper
	if (callExpression.callee.type !== 'Identifier') return false;

	const calleeName = callExpression.callee.name;

	// Check if it's a known wrapper
	if (knownWrappers.includes(calleeName)) return true;

	// Check if it's imported from 'vite' (this would require analyzing imports, but for now we'll be conservative)
	// For now, assume any function call with a single object argument is a config wrapper
	const isObjectCall =
		callExpression.arguments.length === 1 &&
		callExpression.arguments[0]?.type === 'ObjectExpression';

	return knownWrappers.includes(calleeName) || isObjectCall;
}

function exportDefaultConfig(
	ast: AstTypes.Program,
	options: {
		fallback?: { code: string; additional?: (ast: AstTypes.Program) => void };
		ignoreWrapper: string[];
	}
): AstTypes.ObjectExpression {
	const { fallback, ignoreWrapper } = options;

	// Get or create the default export
	let fallbackExpression: AstTypes.Expression;
	if (fallback) {
		fallbackExpression =
			typeof fallback.code === 'string' ? common.parseExpression(fallback.code) : fallback.code;
	} else {
		fallbackExpression = object.create({});
	}

	const { value, isFallback } = exports.createDefault(ast, { fallback: fallbackExpression });
	if (isFallback) {
		options.fallback?.additional?.(ast);
	}

	// Handle TypeScript `satisfies` expressions
	const rootObject = value.type === 'TSSatisfiesExpression' ? value.expression : value;

	// Handle wrapper functions (e.g., defineConfig({})) if ignoreWrapper is specified
	let configObject: AstTypes.ObjectExpression;

	// Early bail-out: if not a call expression
	if (!('arguments' in rootObject) || !Array.isArray(rootObject.arguments)) {
		configObject = rootObject as unknown as AstTypes.ObjectExpression;
		return configObject;
	}

	// Early bail-out: if not a call expression
	if (rootObject.type !== 'CallExpression' || rootObject.callee.type !== 'Identifier') {
		configObject = rootObject as unknown as AstTypes.ObjectExpression;
		return configObject;
	}

	// Check if this is a config wrapper function call
	if (!isConfigWrapper(rootObject as AstTypes.CallExpression, ignoreWrapper)) {
		configObject = rootObject as unknown as AstTypes.ObjectExpression;
		return configObject;
	}

	// Main logic: handle the wrapper function call
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

	return configObject as AstTypes.ObjectExpression;
}

function addInArrayOfObject(
	programAst: AstTypes.Program,
	ast: AstTypes.ObjectExpression,
	options: {
		arrayProperty: string;
	} & Parameters<typeof addPlugin>[1]
): void {
	const { code, arrayProperty, mode = 'append' } = options;

	const targetArray = configProperty(programAst, ast, {
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
	const configObject = getConfig(ast);

	// Step 2: Add the plugin to the plugins array
	addInArrayOfObject(ast, configObject, {
		arrayProperty: 'plugins',
		...options
	});
};

/**
 * Like `object.property`, but resolves shorthand identifier references
 * (e.g. `{ plugins }`) by looking up the variable in the program AST.
 */
export function configProperty<T extends AstTypes.Expression | AstTypes.Identifier>(
	ast: AstTypes.Program,
	config: AstTypes.ObjectExpression,
	options: { name: string; fallback: T }
): T {
	const value = object.property(config, options);
	const node = value as AstTypes.Node;
	if (node.type === 'Identifier') {
		const varDecl = variables.declaration(ast, {
			kind: 'const',
			name: node.name,
			value: options.fallback
		});
		if (ast.body.includes(varDecl)) {
			return (varDecl.declarations[0] as AstTypes.VariableDeclarator).init as T;
		}
	}
	return value;
}

export const getConfig = (ast: AstTypes.Program): AstTypes.ObjectExpression => {
	return exportDefaultConfig(ast, {
		fallback: {
			code: 'defineConfig()',
			additional: (ast) => imports.addNamed(ast, { imports: ['defineConfig'], from: 'vite' })
		},
		ignoreWrapper: ['defineConfig']
	});
};
