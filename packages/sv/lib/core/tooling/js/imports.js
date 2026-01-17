/** @import { AstTypes } from '../index.js' */
import { Walker } from '../../../core.js';
import { areNodesEqual } from './common.js';

/**
 * @param {AstTypes.Program} node
 * @param {{ from: string }} options
 * @returns {void}
 */
export function addEmpty(node, options) {
	/** @type {AstTypes.ImportDeclaration} */
	const expectedImportDeclaration = {
		type: 'ImportDeclaration',
		source: {
			type: 'Literal',
			value: options.from
		},
		specifiers: [],
		attributes: [],
		importKind: 'value'
	};

	addImportIfNecessary(node, expectedImportDeclaration);
}

/**
 * @param {AstTypes.Program} node
 * @param {{ from: string; as: string }} options
 * @returns {void}
 */
export function addNamespace(node, options) {
	/** @type {AstTypes.ImportDeclaration} */
	const expectedImportDeclaration = {
		type: 'ImportDeclaration',
		importKind: 'value',
		source: { type: 'Literal', value: options.from },
		specifiers: [
			{
				type: 'ImportNamespaceSpecifier',
				local: { type: 'Identifier', name: options.as }
			}
		],
		attributes: []
	};

	addImportIfNecessary(node, expectedImportDeclaration);
}

/**
 * @param {AstTypes.Program} node
 * @param {{ from: string; as: string }} options
 * @returns {void}
 */
export function addDefault(node, options) {
	/** @type {AstTypes.ImportDeclaration} */
	const expectedImportDeclaration = {
		type: 'ImportDeclaration',
		source: {
			type: 'Literal',
			value: options.from
		},
		specifiers: [
			{
				type: 'ImportDefaultSpecifier',
				local: {
					type: 'Identifier',
					name: options.as
				}
			}
		],
		attributes: [],
		importKind: 'value'
	};

	addImportIfNecessary(node, expectedImportDeclaration);
}

/**
 * @param {AstTypes.Program} node
 * @param {{ imports: Record<string, string> | string[]; from: string; isType?: boolean }} options
 * @returns {void}
 */
export function addNamed(node, options) {
	const o_imports = Array.isArray(options.imports)
		? Object.fromEntries(options.imports.map((n) => [n, n]))
		: options.imports;

	const specifiers = Object.entries(o_imports).map(([key, value]) => {
		/** @type {AstTypes.ImportSpecifier} */
		const specifier = {
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

	/** @type {AstTypes.ImportDeclaration | undefined} */
	let importDecl;

	Walker.walk(/** @type {AstTypes.Node} */ (node), null, {
		ImportDeclaration(declaration) {
			if (declaration.source.value === options.from && declaration.specifiers) {
				importDecl = declaration;
			}
		}
	});

	// merge the specifiers into a single import declaration if they share a source
	if (importDecl) {
		specifiers.forEach((specifierToAdd) => {
			const sourceExists = importDecl?.specifiers?.every(
				(existingSpecifier) =>
					existingSpecifier.type === 'ImportSpecifier' &&
					existingSpecifier.local?.name !== specifierToAdd.local?.name &&
					existingSpecifier.imported.type === 'Identifier' &&
					specifierToAdd.imported.type === 'Identifier' &&
					existingSpecifier.imported.name !== specifierToAdd.imported.name
			);
			if (sourceExists) {
				importDecl?.specifiers?.push(specifierToAdd);
			}
		});
		return;
	}

	/** @type {AstTypes.ImportDeclaration} */
	const expectedImportDeclaration = {
		type: 'ImportDeclaration',
		source: {
			type: 'Literal',
			value: options.from
		},
		specifiers,
		attributes: [],
		importKind: options.isType ? 'type' : 'value'
	};

	node.body.unshift(expectedImportDeclaration);
}

/**
 * @param {AstTypes.Program} node
 * @param {AstTypes.ImportDeclaration} expectedImportDeclaration
 */
function addImportIfNecessary(node, expectedImportDeclaration) {
	const importDeclarations = node.body.filter((item) => item.type === 'ImportDeclaration');
	const importDeclaration = importDeclarations.find((item) =>
		areNodesEqual(item, expectedImportDeclaration)
	);

	if (!importDeclaration) {
		node.body.unshift(expectedImportDeclaration);
	}
}

/**
 * @param {AstTypes.Program} ast
 * @param {{ name: string; from: string }} options
 * @returns {{ statement: AstTypes.ImportDeclaration; alias: string } | { statement: undefined; alias: undefined }}
 */
export function find(ast, options) {
	let alias = options.name;
	/** @type {AstTypes.ImportDeclaration} */
	let statement;

	Walker.walk(/** @type {AstTypes.Node} */ (ast), null, {
		ImportDeclaration(node) {
			if (node.specifiers && node.source.value === options.from) {
				const specifier = /** @type {AstTypes.ImportSpecifier | undefined} */ (
					node.specifiers.find(
						(sp) =>
							sp.type === 'ImportSpecifier' &&
							sp.imported.type === 'Identifier' &&
							sp.imported.name === options.name
					)
				);
				if (specifier) {
					statement = node;
					alias = /** @type {string} */ (specifier.local?.name ?? alias);
					return;
				}
			}
		}
	});

	// @ts-expect-error statement might be undefined
	if (statement) {
		return { statement, alias };
	}

	return { statement: undefined, alias: undefined };
}

/**
 * @param {AstTypes.Program} ast
 * @param {{ name: string; from: string; statement?: AstTypes.ImportDeclaration }} options
 * @returns {void}
 */
export function remove(ast, options) {
	const statement =
		options.statement ?? find(ast, { name: options.name, from: options.from }).statement;

	if (!statement) {
		return;
	}

	if (statement.specifiers?.length === 1) {
		const idxToRemove = ast.body.indexOf(statement);
		ast.body.splice(idxToRemove, 1);
	} else {
		// otherwise, just remove the `defineConfig` specifier
		const idxToRemove = statement.specifiers?.findIndex(
			(s) =>
				s.type === 'ImportSpecifier' &&
				s.imported.type === 'Identifier' &&
				s.imported.name === options.name
		);
		if (idxToRemove !== undefined && idxToRemove !== -1) {
			statement.specifiers?.splice(idxToRemove, 1);
		}
	}
}
