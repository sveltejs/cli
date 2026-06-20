import {
	Walker,
	js,
	transforms,
	type AstTypes,
	type Comments,
	type SvelteAst
} from '@sveltejs/sv-utils';
import { defineMigrationTask } from '../../../index.ts';

type UsageInfo = {
	node: AstTypes.Expression;
	parent: AstTypes.Node | SvelteAst.SvelteNode;
	name: string;
};

type EnvScope = 'private' | 'public';

type EnvImport =
	| {
			type: 'dynamic';
			scope: EnvScope;
			importNode: AstTypes.ImportDeclaration;
			usages: UsageInfo[];
	  }
	| {
			type: 'static';
			scope: EnvScope;
			importNode: AstTypes.ImportDeclaration;
			importNames: string[];
	  };

type EnvVar = {
	type: EnvImport['type'];
	scope: EnvScope;
	name: string;
};

type EnvImportResult = EnvImport | 'migration-task';

export default defineMigrationTask({
	id: 'env-vars',
	description: 'tbd - migrate environment variables to the new format',
	run: ({ sv, language }) => {
		const envVars = new Map<string, EnvVar>();

		sv.files(
			{ include: '**/*.{ts,js,svelte}', where: (content) => content.includes('$env/') },
			(content, path) => {
				if (path.endsWith('.svelte')) {
					return transforms.svelteScript({ language }, ({ ast }) => {
						return runMigration(ast.instance.content, envVars, ast.fragment);
					})(content);
				}

				return transforms.script(({ ast, comments }) => {
					return runMigration(ast, envVars, undefined, comments);
				})(content);
			}
		);

		if (envVars.size > 0) {
			sv.file(
				'src/env.ts',
				transforms.script(({ ast }) => addEnvDeclarationFile(ast, envVars))
			);
		}
	}
});

function runMigration(
	ast: AstTypes.Program,
	envVars: Map<string, EnvVar>,
	template?: SvelteAst.Fragment,
	comments?: Comments
): void | false {
	const envImports = collectEnvImports(ast, template, comments);

	if (envImports === 'migration-task') {
		return;
	}

	if (envImports.length === 0) {
		return false; // no env imports, skip;
	}

	changeEnvImports(ast, envImports);
	replaceEnvUsages(envImports);
	collectEnvVars(envImports, envVars);
}

function collectEnvImports(
	ast: AstTypes.Program,
	template?: SvelteAst.Fragment,
	comments?: Comments
): EnvImport[] | 'migration-task' {
	const envImports: EnvImport[] = [];
	let hasMigrationTask = false;

	const relevantImports = ast.body
		.filter((x) => x.type === 'ImportDeclaration')
		.filter(
			(x) =>
				x.source?.value && typeof x.source.value === 'string' && x.source.value.startsWith('$env/')
		);

	if (relevantImports.length === 0) {
		return envImports;
	}

	for (const importNode of relevantImports) {
		const source = importNode.source.value as string;

		const match = source.match(/^\$env\/(dynamic|static)\/(public|private)$/);
		if (!match) continue;

		const type = match[1] as EnvImport['type'];
		const scope = match[2] as EnvImport['scope'];

		const envImport =
			type === 'dynamic'
				? collectDynamicEnvImport(ast, importNode, scope, template, comments)
				: collectStaticEnvImport(importNode, scope);
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
	importNode: AstTypes.ImportDeclaration,
	scope: EnvScope,
	template?: SvelteAst.Fragment,
	comments?: Comments
): EnvImportResult | undefined {
	const hasEnvImport = importNode.specifiers.some(
		(specifier) =>
			specifier.type === 'ImportSpecifier' &&
			specifier.imported.type === 'Identifier' &&
			specifier.imported.name === 'env' &&
			specifier.local?.type === 'Identifier'
	);
	if (!hasEnvImport) return;

	const usages = getDynamicEnvUsages(ast, importNode, comments);
	if (!usages) {
		return 'migration-task';
	}
	if (template) {
		const templateUsages = getDynamicEnvUsages(template, importNode, comments);
		if (!templateUsages) {
			return 'migration-task';
		}

		usages.push(...templateUsages);
	}
	if (usages.length === 0) return;

	return {
		type: 'dynamic',
		scope,
		importNode,
		usages
	};
}

function collectStaticEnvImport(
	importNode: AstTypes.ImportDeclaration,
	scope: EnvScope
): EnvImport | undefined {
	const importNames = importNode.specifiers.flatMap((specifier) => {
		if (specifier.type !== 'ImportSpecifier') return [];
		if (specifier.imported.type !== 'Identifier') return [];

		return [specifier.imported.name];
	});
	if (importNames.length === 0) return;

	return {
		type: 'static',
		scope,
		importNode,
		importNames
	};
}

function getDynamicEnvUsages(
	node: AstTypes.Node | SvelteAst.SvelteNode,
	importNode: AstTypes.ImportDeclaration,
	comments?: Comments
): UsageInfo[] | undefined {
	const importNames = new Set<string>();

	for (const specifier of importNode.specifiers) {
		if (specifier.type !== 'ImportSpecifier') continue;
		if (specifier.imported.type !== 'Identifier') continue;
		if (specifier.imported.name !== 'env') continue;
		if (specifier.local?.type !== 'Identifier') continue;

		importNames.add(specifier.local.name);
	}

	const usages: UsageInfo[] = [];
	let hasUnsupportedUsage = false;
	Walker.walk(node as AstTypes.Node, null, {
		MemberExpression(
			node: AstTypes.MemberExpression,
			walkContext: Walker.Context<AstTypes.Node, null>
		) {
			if (node.object.type === 'Identifier' && importNames.has(node.object.name)) {
				const name = getDynamicEnvUsageName(node);
				if (!name) {
					hasUnsupportedUsage = true;
					addUnsupportedDynamicEnvComment(
						comments,
						findCommentTarget(walkContext.path) ?? node
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

function addUnsupportedDynamicEnvComment(comments: Comments | undefined, node: AstTypes.Node): void {
	if (!comments) return;

	comments.add(node, {
		type: 'Line',
		value: ' @migration-task Rewrite dynamic env lookup manually.'
	});
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
	// change the import source for static imports. Nothing else to do
	const staticImports = envImports.filter((x) => x.type === 'static');
	for (const { scope, importNode } of staticImports) {
		if (!importNode.source.value) continue;

		const newSource = `$app/env/${scope}`;
		importNode.source.value = newSource;
		importNode.source.raw = undefined; // let the printer decide the raw value
	}

	// change the import source for dynamic imports and change all usages
	const dynamicImports = envImports.filter((x) => x.type === 'dynamic');
	for (const { scope, importNode, usages } of dynamicImports) {
		if (!importNode.source.value) continue;

		const newSource = `$app/env/${scope}`;
		importNode.source.value = newSource;
		importNode.source.raw = undefined; // let the printer decide the raw value

		importNode.specifiers = [];
		const uniqueUsages = new Set(usages.map((usage) => usage.name));
		for (const name of uniqueUsages) {
			importNode.specifiers.push({
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
	// not relevant for static imports
	const dynamicImports = envImports.filter((x) => x.type === 'dynamic');

	for (const { usages } of dynamicImports) {
		for (const usage of usages) {
			if (!usage.parent) continue;

			replaceChildNode(usage.parent, usage.node, {
				type: 'Identifier',
				name: usage.name
			});
		}
	}
}

function replaceChildNode(
	parent: AstTypes.Node | SvelteAst.SvelteNode,
	node: AstTypes.Node,
	replacement: AstTypes.Node
): void {
	// The matched member expression can sit in many different JS or Svelte-template fields
	// (`init`, `expression`, `value`, event/attribute expressions, array entries, etc.).
	// Since zimmerframe already gives us the exact parent, replacing by object identity here is
	// more robust than trying to statically enumerate every possible parent shape.
	const record = parent as unknown as Record<string, unknown>;

	for (const key in record) {
		const value = record[key];

		if (value === node) {
			record[key] = replacement;
			return;
		}

		if (Array.isArray(value)) {
			const index = value.indexOf(node);
			if (index !== -1) {
				value[index] = replacement;
				return;
			}
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

function addEnvDeclarationFile(ast: AstTypes.Program, envVars: Map<string, EnvVar>): false | void {
	if (envVars.size === 0) return false;

	js.imports.addNamed(ast, { from: '@sveltejs/kit/hooks', imports: ['defineEnvVars'] });

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
	js.exports.createNamed(ast, {
		name: 'variables',
		fallback: variablesIdentifier
	});

	for (const envVar of envVars.values()) {
		const value = js.object.property(variablesObject, {
			name: envVar.name,
			fallback: js.object.create({})
		}) as AstTypes.ObjectExpression;

		js.object.overrideProperties(value, {
			public: envVar.scope === 'public' ? true : undefined,
			static: envVar.type === 'static' ? true : undefined
		});
	}
}
