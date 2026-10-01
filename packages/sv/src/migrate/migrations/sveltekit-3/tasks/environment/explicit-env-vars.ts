import { Walker, js, type AstTypes, type Comments, type SvelteAst } from '@sveltejs/sv-utils';
import { addMigrationTask } from '../../../../migration-task.ts';

type UsageInfo = {
	node: AstTypes.Expression;
	parent: AstTypes.Node | SvelteAst.SvelteNode;
	name: string;
};

type StaticImport = Extract<js.imports.FoundImport, { kind: 'static' }>;

export type EnvScope = 'private' | 'public';

export type EnvVar = {
	type: EnvImport['type'];
	scope: EnvScope;
	name: string;
};

type EnvImport =
	| {
			type: 'dynamic';
			scope: EnvScope;
			found: StaticImport;
			usages: UsageInfo[];
	  }
	| {
			type: 'static';
			scope: EnvScope;
			found: StaticImport;
			importNames: string[];
	  };

type EnvImportResult = EnvImport | 'migration-task';

const ENV_MODULE = /^\$env\/(dynamic|static)\/(public|private)$/;

/** Migrate `$env/*` imports/usages to `$app/env/*` for one program. Returns whether it mutated `ast`. */
export function migrateExplicitEnvVars(
	ast: AstTypes.Program,
	envVars: Map<string, EnvVar>,
	template?: SvelteAst.Fragment,
	comments?: Comments
): boolean {
	let mutated = false;

	const envImports = collectEnvImports(ast, template, comments);
	if (envImports === 'migration-task') {
		mutated = true; // comments were added as a side effect
	} else if (envImports.length > 0) {
		changeEnvImports(ast, envImports);
		replaceEnvUsages(envImports);
		collectEnvVars(envImports, envVars);
		mutated = true;
	}

	if (migrateDynamicEnvImports(ast, envVars, comments, template)) mutated = true;
	if (template && migrateDynamicEnvImports(template, envVars, comments, template)) mutated = true;

	return mutated;
}

/**
 * Rewrite dynamic `import('$env/*')` expressions to `import('$app/env/*')`.
 * Names destructured from the result are collected for the `src/env.ts` declaration;
 * other shapes (namespace binding, rest element, computed keys) are flagged for manual work.
 */
function migrateDynamicEnvImports(
	node: AstTypes.Node | SvelteAst.SvelteNode,
	envVars: Map<string, EnvVar>,
	comments?: Comments,
	svelteFragment?: SvelteAst.Fragment
): boolean {
	let mutated = false;

	for (const found of js.imports.findAll(node as AstTypes.Node, { from: ENV_MODULE })) {
		if (found.kind !== 'dynamic') continue;

		const [, type, scope] = found.source.match(ENV_MODULE) as [string, EnvImport['type'], EnvScope];

		js.imports.setSource(found, `$app/env/${scope}`);
		mutated = true;

		const names = getDestructuredEnvNames(found.path);
		if (names) {
			for (const name of names) {
				envVars.set(name, { type, scope, name });
			}
		} else {
			addUnsupportedDynamicImportComment(
				comments,
				findCommentTarget(found.path) ?? found.node,
				svelteFragment
			);
		}
	}

	return mutated;
}

function getDestructuredEnvNames(
	path: Array<AstTypes.Node | SvelteAst.SvelteNode>
): string[] | undefined {
	for (let i = path.length - 1; i >= 0; i -= 1) {
		const node = path[i];
		if (node.type !== 'VariableDeclarator') continue;
		if (node.id.type !== 'ObjectPattern') return;

		const names: string[] = [];
		for (const property of node.id.properties) {
			if (property.type !== 'Property') return; // RestElement
			if (property.key.type !== 'Identifier' || property.computed) return;
			names.push(property.key.name);
		}
		return names;
	}
}

function addUnsupportedDynamicImportComment(
	comments: Comments | undefined,
	node: AstTypes.Node,
	svelteFragment?: SvelteAst.Fragment
): void {
	const message = 'Declare the imported env variables in src/env.ts manually.';

	if (svelteFragment) {
		addMigrationTask(message, { fragment: svelteFragment, anchor: node as SvelteAst.SvelteNode });
		return;
	}

	if (!comments) return;

	addMigrationTask(message, { comments, node });
}

function collectEnvImports(
	ast: AstTypes.Program,
	template?: SvelteAst.Fragment,
	comments?: Comments
): EnvImport[] | 'migration-task' {
	const envImports: EnvImport[] = [];
	let hasMigrationTask = false;

	const relevantImports = js.imports
		.findAll(ast, { from: /^\$env\// })
		.filter((found): found is StaticImport => found.kind === 'static');

	if (relevantImports.length === 0) {
		return envImports;
	}

	for (const found of relevantImports) {
		const source = found.source;

		const match = source.match(ENV_MODULE);
		if (!match) continue;

		const type = match[1] as EnvImport['type'];
		const scope = match[2] as EnvImport['scope'];

		const envImport =
			type === 'dynamic'
				? collectDynamicEnvImport(ast, found, scope, template, comments)
				: collectStaticEnvImport(ast, found, scope);
		if (envImport === 'migration-task') {
			hasMigrationTask = true;
			continue;
		}
		if (envImport) envImports.push(envImport);
	}

	if (envImports.length === 0 && hasMigrationTask) return 'migration-task';
	return envImports;
}

function collectDynamicEnvImport(
	ast: AstTypes.Program,
	found: StaticImport,
	scope: EnvScope,
	template?: SvelteAst.Fragment,
	comments?: Comments
): EnvImportResult | undefined {
	const importNames = new Set(
		js.imports
			.bindings(ast, { from: found.source, name: 'env' })
			.filter((binding) => binding.declaration === found.node)
			.map((binding) => binding.local)
	);
	if (importNames.size === 0) return;

	const usages = getDynamicEnvUsages(ast, importNames, comments, template);
	if (!usages) {
		return 'migration-task';
	}
	if (template) {
		const templateUsages = getDynamicEnvUsages(template, importNames, comments, template);
		if (!templateUsages) {
			return 'migration-task';
		}

		usages.push(...templateUsages);
	}
	if (usages.length === 0) return;

	return {
		type: 'dynamic',
		scope,
		found,
		usages
	};
}

function collectStaticEnvImport(
	ast: AstTypes.Program,
	found: StaticImport,
	scope: EnvScope
): EnvImport | undefined {
	const importNames = js.imports
		.bindings(ast, { from: found.source })
		.filter((binding) => binding.kind === 'named' && binding.declaration === found.node)
		.map((binding) => binding.imported);
	if (importNames.length === 0) return;

	return {
		type: 'static',
		scope,
		found,
		importNames
	};
}

function getDynamicEnvUsages(
	node: AstTypes.Node | SvelteAst.SvelteNode,
	importNames: Set<string>,
	comments?: Comments,
	svelteFragment?: SvelteAst.Fragment
): UsageInfo[] | undefined {
	const usages: UsageInfo[] = [];
	let hasUnsupportedUsage = false;
	Walker.walk(node as AstTypes.Node, null, {
		MemberExpression(node, walkContext) {
			if (node.object.type === 'Identifier' && importNames.has(node.object.name)) {
				const name = getDynamicEnvUsageName(node);
				if (!name) {
					hasUnsupportedUsage = true;
					addUnsupportedDynamicEnvComment(
						comments,
						findCommentTarget(walkContext.path) ?? node,
						svelteFragment
					);
					walkContext.next();
					return;
				}

				usages.push({
					node,
					parent: walkContext.path[walkContext.path.length - 1],
					name
				});
			}

			walkContext.next();
		}
	});

	if (hasUnsupportedUsage) return;

	return usages;
}

function addUnsupportedDynamicEnvComment(
	comments: Comments | undefined,
	node: AstTypes.Node,
	svelteFragment?: SvelteAst.Fragment
): void {
	const message = 'Rewrite dynamic env lookup manually.';

	if (svelteFragment) {
		addMigrationTask(message, { fragment: svelteFragment, anchor: node as SvelteAst.SvelteNode });
		return;
	}

	if (!comments) return;

	addMigrationTask(message, { comments, node });
}

function findCommentTarget(
	path: Array<AstTypes.Node | SvelteAst.SvelteNode>
): AstTypes.Node | undefined {
	for (let i = path.length - 1; i >= 0; i -= 1) {
		const node = path[i];
		if (
			node.type === 'VariableDeclaration' ||
			node.type === 'ExpressionStatement' ||
			node.type === 'ReturnStatement'
		) {
			return node as AstTypes.Node;
		}
	}
}

function getDynamicEnvUsageName(node: AstTypes.MemberExpression): string | undefined {
	if (!node.computed && node.property.type === 'Identifier') {
		return node.property.name;
	}

	if (
		node.computed &&
		node.property.type === 'Literal' &&
		typeof node.property.value === 'string' &&
		isValidIdentifierName(node.property.value)
	) {
		return node.property.value;
	}
}

function isValidIdentifierName(name: string): boolean {
	return /^[$A-Z_a-z][$\w]*$/.test(name);
}

function changeEnvImports(ast: AstTypes.Program, envImports: EnvImport[]): void {
	const staticImports = envImports.filter((x) => x.type === 'static');
	for (const { scope, found } of staticImports) {
		js.imports.setSource(found, `$app/env/${scope}`);
	}

	const dynamicImports = envImports.filter((x) => x.type === 'dynamic');
	for (const { scope, found, usages } of dynamicImports) {
		js.imports.setSource(found, `$app/env/${scope}`);

		found.node.specifiers = [];
		const uniqueUsages = new Set(usages.map((usage) => usage.name));
		for (const name of uniqueUsages) {
			found.node.specifiers.push({
				type: 'ImportSpecifier',
				imported: {
					type: 'Identifier',
					name
				},
				local: {
					type: 'Identifier',
					name
				}
			});
		}
	}

	mergeEnvImports(ast);
}

/**
 * If we initially have two imports from $env/static/public and $env/dynamic/public
 * they will produce two separate imports which is not totally clean.
 * This function merges multiple imports from the same new source into a single import.
 *
 * Specifiers of duplicated imports are assumed to be unique and are merged together.
 */
function mergeEnvImports(ast: AstTypes.Program): void {
	const seenImports = new Map<string, AstTypes.ImportDeclaration>();

	for (let i = 0; i < ast.body.length; i += 1) {
		const node = ast.body[i];
		if (node.type !== 'ImportDeclaration') continue;
		const source = node.source.value;
		if (typeof source !== 'string' || !source.startsWith('$app/env/')) continue;

		const existingImport = seenImports.get(source);
		if (!existingImport) {
			seenImports.set(source, node);
			continue;
		}

		existingImport.specifiers.push(...node.specifiers);
		ast.body.splice(i, 1);
		i -= 1;
	}
}

function replaceEnvUsages(envImports: EnvImport[]): void {
	const dynamicImports = envImports.filter((x) => x.type === 'dynamic');

	for (const { usages } of dynamicImports) {
		for (const usage of usages) {
			if (!usage.parent) continue;

			js.common.replaceChild(usage.parent, usage.node, {
				type: 'Identifier',
				name: usage.name
			});
		}
	}
}

function collectEnvVars(envImports: EnvImport[], envVars: Map<string, EnvVar>): void {
	for (const envImport of envImports) {
		if (envImport.type === 'static') {
			for (const name of envImport.importNames) {
				envVars.set(name, {
					type: envImport.type,
					scope: envImport.scope,
					name
				});
			}
		} else {
			for (const usage of envImport.usages) {
				envVars.set(usage.name, {
					type: envImport.type,
					scope: envImport.scope,
					name: usage.name
				});
			}
		}
	}
}

export function addEnvDeclarationFile(
	ast: AstTypes.Program,
	comments: Comments,
	envVars: Map<string, EnvVar>
): false | void {
	if (envVars.size === 0) return false;

	js.imports.addNamed(ast, { from: '@sveltejs/kit/env', imports: ['defineEnvVars'] });

	const defineCall = js.functions.createCall({
		name: 'defineEnvVars',
		args: []
	});
	const variablesObject = js.functions.getArgument(defineCall, {
		index: 0,
		fallback: js.object.create({})
	});
	const variablesIdentifier = js.variables.declaration(ast, {
		kind: 'const',
		name: 'variables',
		value: defineCall
	});
	const exportDeclaration = js.exports.createNamed(ast, {
		name: 'variables',
		fallback: variablesIdentifier
	});

	let has_dynamic = false;

	for (const envVar of envVars.values()) {
		const value = js.object.property(variablesObject, {
			name: envVar.name,
			fallback: js.object.create({})
		}) as AstTypes.ObjectExpression;

		has_dynamic ||= envVar.type === 'dynamic';

		js.object.overrideProperties(value, {
			public: envVar.scope === 'public' ? true : undefined,
			static: envVar.type === 'static' ? true : undefined,
			schema:
				envVar.type === 'dynamic'
					? js.functions.createArrow({
							params: ['input'],
							body: {
								type: 'LogicalExpression',
								operator: '??',
								left: { type: 'Identifier', name: 'input' },
								right: { type: 'Literal', value: '', raw: "''" }
							},
							async: false
						})
					: undefined
		});
	}

	if (has_dynamic) {
		addMigrationTask(
			'Review usage of dynamic environment variables. They fall back to the empty string if not present, which may not be what you want.',
			{ comments, node: exportDeclaration }
		);
	}
}
