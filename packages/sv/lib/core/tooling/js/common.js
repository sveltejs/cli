import decircular from 'decircular';
import dedent from 'dedent';

import { parseScript, serializeScript, stripAst } from '../index.ts';
import { Walker } from '../../../core.ts';

/** @typedef {import("../index.ts").AstTypes} AstTypes */
/** @typedef {import("../index.ts").Comments} Comments */
/** @typedef {import("../index.ts").AstTypes.Comment} Comment */
/** @typedef {import("../index.ts").AstTypes.TSAsExpression} TSAsExpression */
/** @typedef {import("../index.ts").AstTypes.TSTypeReference} TSTypeReference */
/** @typedef {import("../index.ts").AstTypes.Identifier} Identifier */
/** @typedef {import("../index.ts").AstTypes.TSSatisfiesExpression} TSSatisfiesExpression */
/** @typedef {import("../index.ts").AstTypes.Expression} Expression */
/** @typedef {import("../index.ts").AstTypes.SpreadElement} SpreadElement */
/** @typedef {import("../index.ts").AstTypes.Literal} Literal */
/** @typedef {import("../index.ts").AstTypes.BlockStatement} BlockStatement */
/** @typedef {import("../index.ts").AstTypes.ExpressionStatement} ExpressionStatement */
/** @typedef {import("../index.ts").AstTypes.Program} Program */
/** @typedef {import("../index.ts").AstTypes.Statement} Statement */
/** @typedef {import("../index.ts").AstTypes.Node} Node */
/** @typedef {import("../index.ts").AstTypes.TSInterfaceDeclaration} TSInterfaceDeclaration */
/** @typedef {import("../index.ts").AstTypes.TSPropertySignature} TSPropertySignature */

/**
 * @param {Node} node
 * @param {Comments} comments
 * @param {{ type: string }} options
 */
export function addJsDocTypeComment(node, comments, options) {
	/** @type {Comment} */
	const comment = {
		type: 'Block',
		value: `* @type {${options.type}} `
	};

	comments.add(node, comment);
}

/**
 * @param {Node} node
 * @param {Comments} comments
 * @param {{ params: Record<string, string> }} options
 */
export function addJsDocComment(node, comments, options) {
	/** @type {string[]} */
	const commentLines = [];
	for (const [key, value] of Object.entries(options.params)) {
		commentLines.push(`@param {${key}} ${value}`);
	}

	/** @type {Comment} */
	const comment = {
		type: 'Block',
		value: `*\n * ${commentLines.join('\n * ')}\n `
	};

	comments.add(node, comment);
}

/**
 * @param {Expression} node
 * @param {{ type: string }} options
 * @returns {TSAsExpression}
 */
export function typeAnnotate(node, options) {
	/** @type {TSAsExpression} */
	const expression = {
		type: 'TSAsExpression',
		expression: node,
		typeAnnotation: {
			type: 'TSTypeReference',
			typeName: { type: 'Identifier', name: options.type }
		}
	};

	return expression;
}

/**
 * @param {Expression} node
 * @param {{ type: string }} options
 * @returns {TSSatisfiesExpression}
 */
export function createSatisfies(node, options) {
	/** @type {TSSatisfiesExpression} */
	const expression = {
		type: 'TSSatisfiesExpression',
		expression: node,
		typeAnnotation: {
			type: 'TSTypeReference',
			typeName: { type: 'Identifier', name: options.type }
		}
	};

	return expression;
}

/**
 * @param {Expression} argument
 * @returns {SpreadElement}
 */
export function createSpread(argument) {
	return {
		type: 'SpreadElement',
		argument
	};
}

/**
 * @param {string | number | boolean | null} value
 * @returns {Literal}
 */
export function createLiteral(value) {
	/** @type {Literal} */
	const literal = {
		type: 'Literal',
		value: value ?? null
	};

	return literal;
}

/**
 * @param {Node} node
 * @param {Node} otherNode
 * @returns {boolean}
 */
export function areNodesEqual(node, otherNode) {
	// We're deep cloning these trees so that we can strip the locations off of them for comparisons.
	// Without this, we'd be getting false negatives due to slight differences in formatting style.
	// These ASTs are also filled to the brim with circular references, which prevents
	// us from using `structuredCloned` directly

	const nodeClone = stripAst(decircular(node), ['loc', 'raw']);
	const otherNodeClone = stripAst(decircular(otherNode), ['loc', 'raw']);
	return serializeScript(nodeClone) === serializeScript(otherNodeClone);
}

/**
 * @returns {BlockStatement}
 */
export function createBlockStatement() {
	/** @type {BlockStatement} */
	const statement = {
		type: 'BlockStatement',
		body: []
	};
	return statement;
}

/**
 * @param {{ expression: Expression }} options
 * @returns {ExpressionStatement}
 */
export function createExpressionStatement(options) {
	/** @type {ExpressionStatement} */
	const statement = {
		type: 'ExpressionStatement',
		expression: options.expression
	};
	return statement;
}

/**
 * @param {BlockStatement | Program} node
 * @param {{ code: string }} options
 */
export function appendFromString(node, options) {
	const { ast } = parseScript(dedent(options.code));

	for (const childNode of ast.body) {
		// @ts-expect-error
		node.body.push(childNode);
	}
}

/**
 * @param {string} code
 * @returns {Expression}
 */
export function parseExpression(code) {
	const { ast } = parseScript(dedent(code));
	stripAst(ast, ['raw']);
	const statement = ast.body[0];
	if (statement.type !== 'ExpressionStatement') {
		throw new Error('Code provided was not an expression');
	}

	return statement.expression;
}

/**
 * @param {string} code
 * @returns {Statement}
 */
export function parseStatement(code) {
	return parseFromString(code);
}

/**
 * @template {Node} T
 * @param {string} code
 * @returns {T}
 */
export function parseFromString(code) {
	const { ast } = parseScript(dedent(code));
	const statement = ast.body[0];

	return /** @type {T} */ (statement);
}

/** Appends the statement to body of the block if it doesn't already exist */
/**
 * @param {BlockStatement | Program} node
 * @param {{ statement: Statement }} options
 */
export function appendStatement(node, options) {
	if (!contains(node, options.statement)) node.body.push(options.statement);
}

/** Returns `true` if the provided node exists in the AST */
/**
 * @param {Node} node
 * @param {Node} targetNode
 * @returns {boolean}
 */
export function contains(node, targetNode) {
	let found = false;
	Walker.walk(node, null, {
		_(currentNode, { next, stop }) {
			if (currentNode.type === targetNode.type) {
				found = areNodesEqual(currentNode, targetNode);
				if (found) stop();
			}
			next();
		}
	});

	return found;
}

/**
 * @param {TSInterfaceDeclaration['body']['body'][number]} node
 * @param {{ name: string }} options
 * @returns {boolean}
 */
export function hasTypeProperty(node, options) {
	return (
		node.type === 'TSPropertySignature' &&
		node.key.type === 'Identifier' &&
		node.key.name === options.name
	);
}
