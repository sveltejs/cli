import { Walker, transforms, type AstTypes, type SvelteAst } from '@sveltejs/sv-utils';
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
	  };

export default defineMigrationTask({
	id: 'env-vars',
	description: 'tbd - migrate environment variables to the new format',
	run: ({ sv, language }) => {
		sv.files(
			{ include: '**/*.{ts,js,svelte}', where: (content) => content.includes('$env/') },
			(content, path) => {
				if (path.endsWith('.svelte')) {
					return transforms.svelteScript({ language }, ({ ast }) => {
						return runMigration(ast.instance.content, ast.fragment);
					})(content);
				}

				return transforms.script(({ ast }) => {
					return runMigration(ast);
				})(content);
			}
		);

		// if (declaredVars.size > 0) {
		// 	sv.file(
		// 		'src/env.ts',
		// 		transforms.script(({ ast }) => addEnvDeclarations(ast, declaredVars))
		// 	);
		// }
	}
});

function runMigration(ast: AstTypes.Program, template?: SvelteAst.Fragment): void | false {
	const envImports = collectEnvImports(ast, template);

	if (envImports.length === 0) {
		return false; // no env imports, skip;
	}

	changeEnvImports(ast, envImports);
	replaceEnvUsages(envImports);
}

function collectEnvImports(ast: AstTypes.Program, template?: SvelteAst.Fragment): EnvImport[] {
	const envImports: EnvImport[] = [];

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

		if (type === 'dynamic') {
			const envSpecifier = importNode.specifiers.find(
				(specifier) =>
					specifier.type === 'ImportSpecifier' &&
					specifier.imported.type === 'Identifier' &&
					specifier.imported.name === 'env' &&
					specifier.local?.type === 'Identifier'
			);
			if (!envSpecifier || envSpecifier.type !== 'ImportSpecifier') continue;
			if (
				envSpecifier.imported.type !== 'Identifier' ||
				envSpecifier.local?.type !== 'Identifier'
			) {
				continue;
			}

			const usages = getDynamicEnvUsages(ast, importNode);
			if (template) {
				usages.push(...getDynamicEnvUsages(template, importNode));
			}

			envImports.push({
				type,
				scope,
				importNode,
				usages
			});
		} else {
			envImports.push({
				type,
				scope,
				importNode
			});
		}
	}

	return envImports;
}

function getDynamicEnvUsages(
	node: AstTypes.Node | SvelteAst.SvelteNode,
	importNode: AstTypes.ImportDeclaration
): UsageInfo[] {
	const importNames = new Set<string>();

	for (const specifier of importNode.specifiers) {
		if (specifier.type !== 'ImportSpecifier') continue;
		if (specifier.imported.type !== 'Identifier') continue;
		if (specifier.imported.name !== 'env') continue;
		if (specifier.local?.type !== 'Identifier') continue;

		importNames.add(specifier.local.name);
	}

	const usages: UsageInfo[] = [];
	Walker.walk(node as AstTypes.Node, null, {
		MemberExpression(
			node: AstTypes.MemberExpression,
			context: Walker.Context<AstTypes.Node, null>
		) {
			if (
				node.object.type === 'Identifier' &&
				importNames.has(node.object.name) &&
				!node.computed &&
				node.property.type === 'Identifier'
			) {
				usages.push({
					node,
					parent: context.path[context.path.length - 1],
					name: node.property.name
				});
			}

			context.next();
		}
	});

	return usages;
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
