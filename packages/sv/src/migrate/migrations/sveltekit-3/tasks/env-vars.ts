import { js, transforms, type AstTypes, type SvelteAst } from '@sveltejs/sv-utils';
import { defineMigrationTask } from '../../../index.ts';

type DeclaredEnvVar = {
	public?: boolean;
	static?: boolean;
};

type EnvSourceInfo = {
	kind: 'static' | 'dynamic';
	scope: 'private' | 'public';
};

type EnvImport = {
	importNode: AstTypes.ImportDeclaration;
	sourceInfo: EnvSourceInfo;
	staticImports: Record<string, string>;
	dynamicAliases: Set<string>;
};

export default defineMigrationTask({
	id: 'env-vars',
	description: 'tbd - migrate environment variables to the new format',
	run: ({ sv, language }) => {
		const declaredVars = new Map<string, DeclaredEnvVar>();

		sv.files(
			{ include: '**/*.{ts,js,svelte}', where: (content) => content.includes('$env/') },
			(content, path) => {
				if (path.endsWith('.svelte')) {
					return transforms.svelteScript({ language }, ({ ast }) => {
						return runMigration(ast.instance.content, declaredVars, ast.fragment);
					})(content);
				}

				return transforms.script(({ ast }) => {
					return runMigration(ast, declaredVars);
				})(content);
			}
		);

		if (declaredVars.size > 0) {
			sv.file(
				'src/env.ts',
				transforms.script(({ ast }) => addEnvDeclarations(ast, declaredVars))
			);
		}

		// TODO: Rename $app/environment to $app/env
		// Explicit environment variables will become the default in SvelteKit 3. The $env/* modules, along with $app/environment, will be removed.
	}
});

function runMigration(
	ast: AstTypes.Program,
	declaredVars: Map<string, DeclaredEnvVar>,
	template?: SvelteAst.Fragment
): void | false {
	const envImports = collectEnvImports(ast);

	if (envImports.length === 0) {
		return false; // no env imports, skip;
	}

	const replacementImports = new Map<'private' | 'public', Record<string, string>>();
	const dynamicAliases = new Map<string, EnvSourceInfo>();

	for (const importNode of envImports) {
		for (const [name, alias] of Object.entries(importNode.staticImports)) {
			addReplacementImport(replacementImports, importNode.sourceInfo.scope, name, alias);
			declareEnvVar(declaredVars, name, importNode.sourceInfo);
		}

		for (const alias of importNode.dynamicAliases) {
			dynamicAliases.set(alias, importNode.sourceInfo);
		}
	}

	for (const usage of replaceDynamicEnvUsages(ast, dynamicAliases)) {
		addReplacementImport(replacementImports, usage.sourceInfo.scope, usage.name, usage.name);
		declareEnvVar(declaredVars, usage.name, usage.sourceInfo);
	}

	// Dynamic env aliases imported in <script> can be referenced from the template too.
	for (const usage of template ? replaceDynamicEnvUsages(template, dynamicAliases) : []) {
		addReplacementImport(replacementImports, usage.sourceInfo.scope, usage.name, usage.name);
		declareEnvVar(declaredVars, usage.name, usage.sourceInfo);
	}

	for (const [scope, imports] of replacementImports) {
		js.imports.addNamed(ast, { from: `$app/env/${scope}`, imports });
	}

	for (const importNode of envImports) {
		removeImport(ast, importNode.importNode);
	}

	return replacementImports.size > 0 ? undefined : false;
}

function collectEnvImports(ast: AstTypes.Program): EnvImport[] {
	const imports = ast.body.filter((node): node is AstTypes.ImportDeclaration => {
		return node.type === 'ImportDeclaration';
	});

	return imports.flatMap((importNode) => {
		const source = importNode.source.value;
		if (typeof source !== 'string') return [];

		const sourceInfo = getEnvSourceInfo(source);
		if (!sourceInfo) return [];

		const staticImports: Record<string, string> = {};
		const dynamicAliases = new Set<string>();

		for (const specifier of importNode.specifiers) {
			if (specifier.type !== 'ImportSpecifier') continue;
			if (specifier.imported.type !== 'Identifier') continue;
			if (specifier.local?.type !== 'Identifier') continue;

			if (sourceInfo.kind === 'static') {
				staticImports[specifier.imported.name] = specifier.local.name;
			} else if (specifier.imported.name === 'env') {
				dynamicAliases.add(specifier.local.name);
			}
		}

		if (Object.keys(staticImports).length === 0 && dynamicAliases.size === 0) return [];

		return [{ importNode, sourceInfo, staticImports, dynamicAliases }];
	});
}

function addReplacementImport(
	imports: Map<'private' | 'public', Record<string, string>>,
	scope: 'private' | 'public',
	name: string,
	alias: string
): void {
	const scopedImports = imports.get(scope) ?? {};
	scopedImports[name] = alias;
	imports.set(scope, scopedImports);
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

function getEnvSourceInfo(source: string): EnvSourceInfo | undefined {
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
	sourceInfo: EnvSourceInfo
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

function replaceDynamicEnvUsages(
	node: AstTypes.Node | SvelteAst.SvelteNode,
	envAliases: Map<string, EnvSourceInfo>
): Array<{ name: string; sourceInfo: EnvSourceInfo }> {
	const usages = new Map<string, { name: string; sourceInfo: EnvSourceInfo }>();

	// Direct member reads become named imports from $app/env/{scope}.
	replaceNode(node, (child) => {
		if (
			child.type === 'MemberExpression' &&
			child.object.type === 'Identifier' &&
			envAliases.has(child.object.name) &&
			!child.computed &&
			child.property.type === 'Identifier'
		) {
			const sourceInfo = envAliases.get(child.object.name)!;
			const name = child.property.name;
			usages.set(`${sourceInfo.scope}:${name}`, { name, sourceInfo });
			return { ...child.property };
		}
	});

	return Array.from(usages.values());
}

function replaceNode(
	node: AstTypes.Node | SvelteAst.SvelteNode,
	replace: (node: AstTypes.Node) => AstTypes.Node | undefined
): AstTypes.Node | SvelteAst.SvelteNode {
	const replacement = isJsNode(node) ? replace(node) : undefined;
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

function isNode(value: unknown): value is AstTypes.Node | SvelteAst.SvelteNode {
	return typeof value === 'object' && value !== null && 'type' in value;
}

function isJsNode(value: unknown): value is AstTypes.Node {
	return isNode(value) && typeof (value as { type?: unknown }).type === 'string';
}
