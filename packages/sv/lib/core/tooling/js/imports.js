import { Walker } from '../../../core.ts';
import { areNodesEqual } from './common.js';

/** @typedef {import("../index.ts").AstTypes} AstTypes */
/** @typedef {import("../index.ts").AstTypes.Program} Program */
/** @typedef {import("../index.ts").AstTypes.ImportDeclaration} ImportDeclaration */
/** @typedef {import("../index.ts").AstTypes.ImportSpecifier} ImportSpecifier */
/** @typedef {import("../index.ts").AstTypes.Node} Node */

/**
 * @param {Program} node
 * @param {{ from: string }} options
 */
export function addEmpty(node, options) {
	/** @type {ImportDeclaration} */
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
 * @param {Program} node
 * @param {{ from: string; as: string }} options
 */
export function addNamespace(node, options) {
	/** @type {ImportDeclaration} */
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
 * @param {Program} node
 * @param {{ from: string; as: string }} options
 */
export function addDefault(node, options) {
	/** @type {ImportDeclaration} */
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
 * @param {Program} node
 * @param {{
 *   imports: Record<string, string> | string[];
 *   from: string;
 *   isType?: boolean;
 * }} options
 */
export function addNamed(node, options) {
	const o_imports = Array.isArray(options.imports)
		? Object.fromEntries(options.imports.map((n) => [n, n]))
		: options.imports;

	const specifiers = Object.entries(o_imports).map(([key, value]) => {
		/** @type {ImportSpecifier} */
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

	/** @type {ImportDeclaration | undefined} */
	let importDecl = undefined;

	Walker.walk(/** @type {Node} */ (node), null, {
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

	/** @type {ImportDeclaration} */
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
 * @param {Program} node
 * @param {ImportDeclaration} expectedImportDeclaration
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
 * @param {Program} ast
 * @param {{ name: string; from: string }} options
 * @returns {{ statement: ImportDeclaration; alias: string } | { statement: undefined; alias: undefined }}
 */
export function find(ast, options) {
	let alias = options.name;
	/** @type {ImportDeclaration | undefined} */
	let statement = undefined;

	Walker.walk(/** @type {Node} */ (ast), null, {
		ImportDeclaration(node) {
			if (node.specifiers && node.source.value === options.from) {
				const specifier = node.specifiers.find(
					(sp) =>
						sp.type === 'ImportSpecifier' &&
						sp.imported.type === 'Identifier' &&
						sp.imported.name === options.name
				);
				if (specifier) {
					statement = node;
					alias = specifier.local?.name ?? alias;
					return;
				}
			}
		}
	});

	if (statement) {
		return { statement, alias };
	}

	return { statement: undefined, alias: undefined };
}

/**
 * @param {Program} ast
 * @param {{ name: string; from: string; statement?: ImportDeclaration }} options
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
