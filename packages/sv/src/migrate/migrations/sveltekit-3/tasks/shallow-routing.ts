import { js, transforms, Walker, type AstTypes } from '@sveltejs/sv-utils';
import { defineMigrationTask } from '../../../index.ts';

const NAVIGATION_MODULE = '$app/navigation';
const SHALLOW_METHODS = new Map([
	['pushState', false],
	['replaceState', true]
]);
const NAVIGATION_HOOKS = new Set(['beforeNavigate', 'afterNavigate', 'onNavigate']);
type NamedImportSpecifier = AstTypes.ImportSpecifier & { imported: AstTypes.Identifier };

export default defineMigrationTask({
	id: 'shallow-routing',
	description: 'Migrate shallow routing to goto()',
	run: ({ sv, language }) => {
		sv.files(
			{
				include: '**/*.{js,ts,svelte}',
				where: (content) => content.includes(NAVIGATION_MODULE)
			},
			(content, file) => {
				if (file.endsWith('.svelte')) {
					return transforms.svelteScript({ language }, ({ ast }) => {
						if (!migrateShallowRouting(ast.instance.content)) return false;
					})(content);
				}

				return transforms.script(({ ast }) => {
					if (!migrateShallowRouting(ast)) return false;
				})(content);
			}
		);
	}
});

function migrateShallowRouting(ast: AstTypes.Program): boolean {
	const methods = new Map<string, boolean>();
	const hooks = new Set<string>();
	const oldSpecifiers: NamedImportSpecifier[] = [];
	const navigationImports: AstTypes.ImportDeclaration[] = [];
	let gotoLocal: string | undefined;

	for (const binding of js.imports.bindings(ast, { from: NAVIGATION_MODULE })) {
		if (binding.imported === 'goto') gotoLocal = binding.local;
		if (NAVIGATION_HOOKS.has(binding.imported)) hooks.add(binding.local);

		const replace = SHALLOW_METHODS.get(binding.imported);
		if (replace !== undefined) methods.set(binding.local, replace);
		if (replace !== undefined && binding.kind === 'named') {
			oldSpecifiers.push(binding.specifier as NamedImportSpecifier);
		}
	}

	for (const statement of ast.body) {
		if (statement.type !== 'ImportDeclaration' || statement.source.value !== NAVIGATION_MODULE) {
			continue;
		}
		navigationImports.push(statement);
	}

	if (methods.size === 0 && hooks.size === 0) return false;

	// calls that spread their arguments cannot be rewritten to `goto(url, options)`.
	// their imports have to be kept so that the remaining call sites keep working
	const { unmigratable, migratable } = scanMethodCalls(ast, methods);
	const removable = oldSpecifiers.filter((specifier) => !unmigratable.has(specifier.local.name));

	let changed = false;
	if (!gotoLocal && migratable) {
		const specifier = removable.shift();
		if (specifier) {
			// repurpose a no longer needed import as the `goto` import
			const wasUnaliased = specifier.local.name === specifier.imported.name;
			gotoLocal = specifier.local.name;
			if (wasUnaliased && js.identifiers.freeName([ast], 'goto') === 'goto') {
				specifier.imported.name = 'goto';
				specifier.local.name = 'goto';
				gotoLocal = 'goto';
			} else {
				// keep the local name (e.g. `import { goto as pushState }`) to avoid
				// colliding with an existing `goto` binding or breaking an aliased import.
				// use a fresh node in case `imported` and `local` share the same node
				specifier.imported = js.variables.createIdentifier('goto');
			}
		} else {
			// every shallow routing import has to be kept, so add a new `goto` import
			gotoLocal = js.identifiers.freeName([ast], 'goto');
			const declaration = navigationImports.find((navigationImport) =>
				navigationImport.specifiers.some((s) => oldSpecifiers.includes(s as NamedImportSpecifier))
			)!;
			declaration.specifiers.push({
				type: 'ImportSpecifier',
				imported: js.variables.createIdentifier('goto'),
				local: js.variables.createIdentifier(gotoLocal)
			});
		}
		changed = true;
	}

	if (removable.length > 0) {
		const emptiedImports = new Set<AstTypes.ImportDeclaration>();
		for (const declaration of navigationImports) {
			if (declaration.specifiers.length === 0) continue; // pre-existing side-effect import
			declaration.specifiers = declaration.specifiers.filter(
				(specifier) => !removable.includes(specifier as NamedImportSpecifier)
			);
			if (declaration.specifiers.length === 0) emptiedImports.add(declaration);
		}
		ast.body = ast.body.filter(
			(statement) => statement.type !== 'ImportDeclaration' || !emptiedImports.has(statement)
		);
		changed = true;
	}

	Walker.walk(ast as AstTypes.Node, null, {
		CallExpression(node: AstTypes.CallExpression, { next }: Walker.Context<AstTypes.Node, null>) {
			if (node.callee.type !== 'Identifier') {
				next();
				return;
			}

			const replace = methods.get(node.callee.name);
			if (
				replace !== undefined &&
				gotoLocal &&
				!node.arguments.some((argument) => argument.type === 'SpreadElement')
			) {
				const state = node.arguments[1] as AstTypes.Expression | undefined;
				node.callee.name = gotoLocal;
				node.arguments = [
					...(node.arguments[0] ? [node.arguments[0]] : []),
					gotoOptions(replace, state)
				];
				changed = true;
			}

			if (hooks.has(node.callee.name) && migrateNavigationHook(node)) changed = true;
			next();
		}
	});

	return changed;
}

function scanMethodCalls(
	ast: AstTypes.Program,
	methods: Map<string, boolean>
): { unmigratable: Set<string>; migratable: boolean } {
	const unmigratable = new Set<string>();
	let migratable = false;
	Walker.walk(ast as AstTypes.Node, null, {
		CallExpression(node: AstTypes.CallExpression, { next }: Walker.Context<AstTypes.Node, null>) {
			if (node.callee.type === 'Identifier' && methods.has(node.callee.name)) {
				if (node.arguments.some((argument) => argument.type === 'SpreadElement')) {
					unmigratable.add(node.callee.name);
				} else {
					migratable = true;
				}
			}
			next();
		}
	});
	return { unmigratable, migratable };
}

function gotoOptions(
	replace: boolean,
	state: AstTypes.Expression | undefined
): AstTypes.ObjectExpression {
	return js.object.create({
		shallow: js.common.createLiteral(true),
		replace: replace ? js.common.createLiteral(true) : undefined,
		state: state?.type === 'ObjectExpression' && state.properties.length === 0 ? undefined : state
	});
}

function migrateNavigationHook(call: AstTypes.CallExpression): boolean {
	const callback = call.arguments[0];
	if (callback?.type !== 'ArrowFunctionExpression' && callback?.type !== 'FunctionExpression') {
		return false;
	}

	const shallow = shallowTest(callback);
	if (!shallow) return false;

	const guard: AstTypes.IfStatement = {
		type: 'IfStatement',
		test: shallow,
		consequent: { type: 'ReturnStatement', argument: null }
	};

	if (callback.body.type === 'BlockStatement') {
		if (startsWithShallowGuard(callback.body, shallow)) return false;
		callback.body.body.unshift(guard);
	} else {
		callback.body = {
			type: 'BlockStatement',
			body: [guard, { type: 'ReturnStatement', argument: callback.body }]
		};
	}

	return true;
}

function shallowTest(
	callback: AstTypes.ArrowFunctionExpression | AstTypes.FunctionExpression
): AstTypes.Expression | undefined {
	const parameter = callback.params[0];
	if (!parameter) {
		callback.params.push({
			type: 'ObjectPattern',
			properties: [patternProperty('shallow')]
		});
		return js.variables.createIdentifier('shallow');
	}

	if (parameter.type === 'Identifier') return member(parameter.name, 'shallow');
	if (parameter.type === 'AssignmentPattern' && parameter.left.type === 'Identifier') {
		return member(parameter.left.name, 'shallow');
	}
	if (parameter.type !== 'ObjectPattern') return undefined;

	for (const entry of parameter.properties) {
		if (entry.type !== 'Property') continue;
		const key = entry.key;
		if (
			(key.type !== 'Identifier' || key.name !== 'shallow') &&
			(key.type !== 'Literal' || key.value !== 'shallow')
		) {
			continue;
		}
		if (entry.value.type === 'Identifier') return js.variables.createIdentifier(entry.value.name);
		if (entry.value.type === 'AssignmentPattern' && entry.value.left.type === 'Identifier') {
			return js.variables.createIdentifier(entry.value.left.name);
		}
		return undefined;
	}

	const restIndex = parameter.properties.findIndex((entry) => entry.type === 'RestElement');
	const shallowProperty = patternProperty('shallow');
	if (restIndex === -1) parameter.properties.push(shallowProperty);
	else parameter.properties.splice(restIndex, 0, shallowProperty);
	return js.variables.createIdentifier('shallow');
}

function startsWithShallowGuard(
	body: AstTypes.BlockStatement,
	shallow: AstTypes.Expression
): boolean {
	const first = body.body[0];
	return (
		first?.type === 'IfStatement' &&
		first.consequent.type === 'ReturnStatement' &&
		first.consequent.argument === null &&
		sameExpression(first.test, shallow)
	);
}

function sameExpression(left: AstTypes.Expression, right: AstTypes.Expression): boolean {
	if (left.type === 'Identifier' && right.type === 'Identifier') return left.name === right.name;
	return (
		left.type === 'MemberExpression' &&
		right.type === 'MemberExpression' &&
		left.object.type === 'Identifier' &&
		right.object.type === 'Identifier' &&
		left.object.name === right.object.name &&
		left.property.type === 'Identifier' &&
		right.property.type === 'Identifier' &&
		left.property.name === right.property.name
	);
}

function patternProperty(name: string): AstTypes.AssignmentProperty {
	const value = js.variables.createIdentifier(name);
	return {
		type: 'Property',
		key: js.variables.createIdentifier(name),
		value,
		kind: 'init',
		method: false,
		shorthand: true,
		computed: false
	};
}

function member(object: string, property: string): AstTypes.MemberExpression {
	return {
		type: 'MemberExpression',
		object: js.variables.createIdentifier(object),
		property: js.variables.createIdentifier(property),
		computed: false,
		optional: false
	};
}
