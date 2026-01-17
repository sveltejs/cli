/** @import { AstTypes, Comments } from '../index.js' */
import decircular from 'decircular';
import dedent from 'dedent';

import { parseScript, serializeScript, stripAst } from '../index.js';
import { Walker } from '../../../core.js';

/**
 * @param {AstTypes.Node} node
 * @param {Comments} comments
 * @param {{ type: string }} options
 * @returns {void}
 */
export function addJsDocTypeComment(node, comments, options) {
	/** @type {AstTypes.Comment} */
	const comment = {
		type: 'Block',
		value: `* @type {${options.type}} `
	};

	comments.add(node, comment);
}

/**
 * @param {AstTypes.Node} node
 * @param {Comments} comments
 * @param {{ params: Record<string, string> }} options
 * @returns {void}
 */
export function addJsDocComment(node, comments, options) {
	/** @type {string[]} */
	const commentLines = [];
	for (const [key, value] of Object.entries(options.params)) {
		commentLines.push(`@param {${key}} ${value}`);
	}

	/** @type {AstTypes.Comment} */
	const comment = {
		type: 'Block',
		value: `*\n * ${commentLines.join('\n * ')}\n `
	};

	comments.add(node, comment);
}

/**
 * @param {AstTypes.Expression} node
 * @param {{ type: string }} options
 * @returns {AstTypes.TSAsExpression}
 */
export function typeAnnotate(node, options) {
	/** @type {AstTypes.TSAsExpression} */
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
 * @param {AstTypes.Expression} node
 * @param {{ type: string }} options
 * @returns {AstTypes.TSSatisfiesExpression}
 */
export function createSatisfies(node, options) {
	/** @type {AstTypes.TSSatisfiesExpression} */
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
 * @param {AstTypes.Expression} argument
 * @returns {AstTypes.SpreadElement}
 */
export function createSpread(argument) {
	return {
		type: 'SpreadElement',
		argument
	};
}

/**
 * @param {string | number | boolean | null} value
 * @returns {AstTypes.Literal}
 */
export function createLiteral(value) {
	/** @type {AstTypes.Literal} */
	const literal = {
		type: 'Literal',
		value: value ?? null
	};

	return literal;
}

/**
 * @param {AstTypes.Node} node
 * @param {AstTypes.Node} otherNode
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
 * @returns {AstTypes.BlockStatement}
 */
export function createBlockStatement() {
	/** @type {AstTypes.BlockStatement} */
	const statement = {
		type: 'BlockStatement',
		body: []
	};
	return statement;
}

/**
 * @param {{ expression: AstTypes.Expression }} options
 * @returns {AstTypes.ExpressionStatement}
 */
export function createExpressionStatement(options) {
	/** @type {AstTypes.ExpressionStatement} */
	const statement = {
		type: 'ExpressionStatement',
		expression: options.expression
	};
	return statement;
}

/**
 * @param {AstTypes.BlockStatement | AstTypes.Program} node
 * @param {{ code: string }} options
 * @returns {void}
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
 * @returns {AstTypes.Expression}
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
 * @returns {AstTypes.Statement}
 */
export function parseStatement(code) {
	return parseFromString(code);
}

/**
 * @template {AstTypes.Node} T
 * @param {string} code
 * @returns {T}
 */
export function parseFromString(code) {
	const { ast } = parseScript(dedent(code));
	const statement = ast.body[0];

	return /** @type {T} */ (statement);
}

/**
 * Appends the statement to body of the block if it doesn't already exist
 * @param {AstTypes.BlockStatement | AstTypes.Program} node
 * @param {{ statement: AstTypes.Statement }} options
 * @returns {void}
 */
export function appendStatement(node, options) {
	if (!contains(node, options.statement)) node.body.push(options.statement);
}

/**
 * Returns `true` if the provided node exists in the AST
 * @param {AstTypes.Node} node
 * @param {AstTypes.Node} targetNode
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
 * @param {AstTypes.TSInterfaceDeclaration['body']['body'][number]} node
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
