import { js, transforms, type AstTypes } from '@sveltejs/sv-utils';
import { defineMigrationTask } from '../../../index.ts';

type DeclaredEnvVar = {
	public?: boolean;
	static?: boolean;
};

export default defineMigrationTask({
	id: 'env-vars',
	description: 'tbd - migrate environment variables to the new format',
	run: ({ sv, language }) => {
		const declaredVars = new Map<string, DeclaredEnvVar>();

		// TODO: find a way to combine both calls because it still duplicates some stuff
		sv.files(
			{ include: '**/*.svelte', where: (content) => content.includes('$env/') },
			transforms.svelteScript({ language }, ({ ast }) => {
				return changeImports(ast.instance.content, declaredVars);
			})
		);
		sv.files(
			{ include: '**/*.{ts,js}', where: (content) => content.includes('$env/') },
			transforms.script(({ ast }) => {
				return changeImports(ast, declaredVars);
			})
		);

		if (declaredVars.size > 0) {
			sv.file('src/env.ts', transforms.script(({ ast }) => addEnvDeclarations(ast, declaredVars)));
		}

		// TODO: Rename $app/environment to $app/env
		// Explicit environment variables will become the default in SvelteKit 3. The $env/* modules, along with $app/environment, will be removed.
	}
});

function changeImports(
	ast: AstTypes.Program,
	declaredVars: Map<string, DeclaredEnvVar>
): void | false {
	const imports = ast.body.filter((node): node is AstTypes.ImportDeclaration => {
		return node.type === 'ImportDeclaration';
	});
	const envImports = imports.filter(
		(i) => typeof i.source.value === 'string' && i.source.value.startsWith('$env')
	);

	if (envImports.length === 0) {
		return false; // no env imports, skip;
	}

	let changed = false;

	for (const importNode of envImports) {
		const source = importNode.source.value;
		if (typeof source !== 'string') continue;

		const sourceInfo = getEnvSourceInfo(source);
		if (!sourceInfo) continue;

		const importsToAdd: Record<string, string> = {};
		const dynamicEnvAliases = new Set<string>();

		for (const specifier of importNode.specifiers) {
			if (specifier.type !== 'ImportSpecifier') continue;
			if (specifier.imported.type !== 'Identifier') continue;
			if (specifier.local?.type !== 'Identifier') continue;

			if (sourceInfo.kind === 'static') {
				importsToAdd[specifier.imported.name] = specifier.local.name;
				declareEnvVar(declaredVars, specifier.imported.name, sourceInfo);
			} else if (specifier.imported.name === 'env') {
				dynamicEnvAliases.add(specifier.local.name);
			}
		}

		if (dynamicEnvAliases.size > 0) {
			for (const name of replaceDynamicEnvReferences(ast, dynamicEnvAliases)) {
				importsToAdd[name] = name;
				declareEnvVar(declaredVars, name, sourceInfo);
			}
		}

		if (Object.keys(importsToAdd).length > 0) {
			js.imports.addNamed(ast, {
				from: `$app/env/${sourceInfo.scope}`,
				imports: importsToAdd
			});
			removeImport(ast, importNode);
			changed = true;
		}
	}

	return changed ? undefined : false;
}

function addEnvDeclarations(
	ast: AstTypes.Program,
	declaredVars: Map<string, DeclaredEnvVar>
): void {
	js.imports.addNamed(ast, { from: '@sveltejs/kit/hooks', imports: ['defineEnvVars'] });
	const variables = getOrCreateVariablesObject(ast);

	for (const [name, spec] of declaredVars) {
		const property = js.object.propertyNode(variables, {
			name,
			fallback: js.object.create({})
		});
		if (property.value.type !== 'ObjectExpression') {
			property.value = js.object.create({});
		}

		js.object.overrideProperties(property.value, {
			public: spec.public ? true : undefined,
			static: spec.static ? true : undefined
		});
	}
}

function getOrCreateVariablesObject(ast: AstTypes.Program): AstTypes.ObjectExpression {
	for (const node of ast.body) {
		if (node.type !== 'ExportNamedDeclaration') continue;
		const declaration = node.declaration;
		if (declaration?.type !== 'VariableDeclaration') continue;
		const declarator = declaration.declarations[0];

		if (
			declarator?.type === 'VariableDeclarator' &&
			declarator.id.type === 'Identifier' &&
			declarator.id.name === 'variables' &&
			declarator.init?.type === 'CallExpression' &&
			declarator.init.callee.type === 'Identifier' &&
			declarator.init.callee.name === 'defineEnvVars' &&
			declarator.init.arguments[0]?.type === 'ObjectExpression'
		) {
			return declarator.init.arguments[0] as AstTypes.ObjectExpression;
		}
	}

	const statement = js.common.parseStatement(
		'export const variables = defineEnvVars({});'
	) as unknown as AstTypes.ExportNamedDeclaration;
	ast.body.push(statement);

	const declaration = statement.declaration as AstTypes.VariableDeclaration;
	const declarator = declaration.declarations[0] as AstTypes.VariableDeclarator;
	const call = declarator.init as AstTypes.CallExpression;
	return call.arguments[0] as AstTypes.ObjectExpression;
}

function getEnvSourceInfo(source: string):
	| {
			kind: 'static' | 'dynamic';
			scope: 'private' | 'public';
	  }
	| undefined {
	const match = /^\$env\/(static|dynamic)\/(private|public)$/.exec(source);
	if (!match) return;

	return {
		kind: match[1] as 'static' | 'dynamic',
		scope: match[2] as 'private' | 'public'
	};
}

function declareEnvVar(
	declaredVars: Map<string, DeclaredEnvVar>,
	name: string,
	sourceInfo: { kind: 'static' | 'dynamic'; scope: 'private' | 'public' }
): void {
	const current = declaredVars.get(name) ?? {};
	declaredVars.set(name, {
		public: current.public || sourceInfo.scope === 'public' || undefined,
		static: current.static || sourceInfo.kind === 'static' || undefined
	});
}

function removeImport(ast: AstTypes.Program, importNode: AstTypes.ImportDeclaration): void {
	const index = ast.body.indexOf(importNode);
	if (index !== -1) ast.body.splice(index, 1);
}

function replaceDynamicEnvReferences(
	node: AstTypes.Node,
	envAliases: Set<string>
): Set<string> {
	const names = new Set<string>();

	// Direct member reads become named imports from $app/env/{scope}.
	replaceNode(node, (child) => {
		if (
			child.type === 'MemberExpression' &&
			child.object.type === 'Identifier' &&
			envAliases.has(child.object.name) &&
			!child.computed &&
			child.property.type === 'Identifier'
		) {
			names.add(child.property.name);
			return {
				type: 'Identifier',
				name: child.property.name
			};
		}
	});

	return names;
}

function replaceNode(
	node: AstTypes.Node,
	replace: (node: AstTypes.Node) => AstTypes.Node | undefined
): AstTypes.Node {
	const replacement = replace(node);
	if (replacement) return replacement;

	const record = node as unknown as Record<string, unknown>;
	for (const key in node) {
		const value = record[key];

		if (Array.isArray(value)) {
			for (let i = 0; i < value.length; i += 1) {
				const child = value[i];
				if (isNode(child)) {
					value[i] = replaceNode(child, replace);
				}
			}
		} else if (isNode(value)) {
			record[key] = replaceNode(value, replace);
		}
	}

	return node;
}

function isNode(value: unknown): value is AstTypes.Node {
	return typeof value === 'object' && value !== null && 'type' in value;
}
