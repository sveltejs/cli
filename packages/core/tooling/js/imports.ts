import { type Ast } from 'svelte/compiler';
import { Walker, type AstTypes } from '@svelte-cli/ast-tooling';
import MagicString from 'magic-string';
import { areNodesEqual } from './common.ts';
import { dedent } from '../../index.ts';

export function addEmpty(ast: Ast, contents: MagicString, importFrom: string): void {
	if (!ast.instance?.content?.body?.length) {
		contents.prepend(dedent`
			<script>
				import '${importFrom}';
			</script>

		`)
		return;
	}

	// check if already imported
	for (const statement of ast.instance.content.body) {
		if (statement.type === 'ImportDeclaration' && statement.source.value === '../app.css') {
			return;
		}
	}

	const first_statement = ast.instance.content.body[0];
	const is_first_line_import = first_statement.type === 'ImportDeclaration';
	contents.prependLeft(
		ast.instance.content.body[0].start,
		`import '${importFrom}';` + (is_first_line_import ? '\n\t' : '\n\n\t')
	);
}

export function addDefault(ast: AstTypes.Program, importFrom: string, importAs: string): void {
	const expectedImportDeclaration: AstTypes.ImportDeclaration = {
		type: 'ImportDeclaration',
		source: {
			type: 'Literal',
			value: importFrom
		},
		specifiers: [
			{
				type: 'ImportDefaultSpecifier',
				local: {
					type: 'Identifier',
					name: importAs
				}
			}
		]
	};

	addImportIfNecessary(ast, expectedImportDeclaration);
}

export function addNamed(
	ast: AstTypes.Program,
	importFrom: string,
	exportedAsImportAs: Record<string, string>,
	isType = false
): void {
	const specifiers = Object.entries(exportedAsImportAs).map(([key, value]) => {
		const specifier: AstTypes.ImportSpecifier = {
			type: 'ImportSpecifier',
			imported: {
				type: 'Identifier',
				name: key
			},
			local: {
				type: 'Identifier',
				name: value
			}
		};
		return specifier;
	});

	let importDecl: AstTypes.ImportDeclaration | undefined;
	// prettier-ignore
	Walker.walk(ast as AstTypes.ASTNode, {}, {
		ImportDeclaration(node) {
			if (node.source.value === importFrom && node.specifiers) {
				importDecl = node;
			}
		},
	});

	// merge the specifiers into a single import declaration if they share a source
	if (importDecl) {
		specifiers.forEach((specifierToAdd) => {
			if (
				importDecl?.specifiers?.every(
					(existingSpecifier) =>
						existingSpecifier.type === 'ImportSpecifier' &&
						existingSpecifier.local?.name !== specifierToAdd.local?.name &&
						existingSpecifier.imported.name !== specifierToAdd.imported.name
				)
			) {
				importDecl?.specifiers?.push(specifierToAdd);
			}
		});
		return;
	}

	const expectedImportDeclaration: AstTypes.ImportDeclaration = {
		type: 'ImportDeclaration',
		source: {
			type: 'Literal',
			value: importFrom
		},
		specifiers,
		importKind: isType ? 'type' : undefined
	};

	ast.body.unshift(expectedImportDeclaration);
}

function addImportIfNecessary(
	ast: AstTypes.Program,
	expectedImportDeclaration: AstTypes.ImportDeclaration
) {
	const importDeclarations = ast.body.filter((x) => x.type == 'ImportDeclaration');
	const importDeclaration = importDeclarations.find((x) =>
		areNodesEqual(x, expectedImportDeclaration)
	);

	if (!importDeclaration) {
		ast.body.unshift(expectedImportDeclaration);
	}
}
