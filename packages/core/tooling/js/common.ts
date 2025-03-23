import { type AstTypes, Walker, parseScript, serializeScript, stripAst } from '../utils.ts';
import decircular from 'decircular';
import dedent from 'dedent';

export function addJsDocTypeComment(node: AstTypes.Node, type: string): void {
	const comment: AstTypes.Comment = {
		type: 'Block',
		value: `* @type {${type}} `
	};

	addComment(node, comment);
}

export function addJsDocComment(node: AstTypes.Node, params: Record<string, string>): void {
	const commentLines: string[] = [];
	for (const [key, value] of Object.entries(params)) {
		commentLines.push(`@param {${key}} ${value}`);
	}

	const comment: AstTypes.Comment = {
		type: 'Block',
		value: `*\n * ${commentLines.join('\n * ')}\n `
	};

	addComment(node, comment);
}

function addComment(node: AstTypes.Node, comment: AstTypes.Comment) {
	node.leadingComments ??= [];

	const found = node.leadingComments.find((n) => n.type === 'Block' && n.value === comment.value);
	if (!found) node.leadingComments.push(comment);
}

export function typeAnnotateExpression(
	node: AstTypes.Expression,
	type: string
): AstTypes.TSAsExpression {
	const expression: AstTypes.TSAsExpression = {
		type: 'TSAsExpression',
		expression: node,
		typeAnnotation: { type: 'TSTypeReference', typeName: { type: 'Identifier', name: type } }
	};

	return expression;
}

export function satisfiesExpression(
	node: AstTypes.Expression,
	type: string
): AstTypes.TSSatisfiesExpression {
	const expression: AstTypes.TSSatisfiesExpression = {
		type: 'TSSatisfiesExpression',
		expression: node,
		typeAnnotation: { type: 'TSTypeReference', typeName: { type: 'Identifier', name: type } }
	};

	return expression;
}

export function createSpreadElement(expression: AstTypes.Expression): AstTypes.SpreadElement {
	return {
		type: 'SpreadElement',
		argument: expression
	};
}

export function createLiteral(value: string | number | boolean | null = null): AstTypes.Literal {
	const literal: AstTypes.Literal = {
		type: 'Literal',
		value
	};

	return literal;
}

export function areNodesEqual(ast1: AstTypes.Node, ast2: AstTypes.Node): boolean {
	// We're deep cloning these trees so that we can strip the locations off of them for comparisons.
	// Without this, we'd be getting false negatives due to slight differences in formatting style.
	// These ASTs are also filled to the brim with circular references, which prevents
	// us from using `structuredCloned` directly

	const ast1Clone = stripAst(decircular(ast1), ['loc', 'raw']);
	const ast2Clone = stripAst(decircular(ast2), ['loc', 'raw']);
	return serializeScript(ast1Clone) === serializeScript(ast2Clone);
}

export function blockStatement(): AstTypes.BlockStatement {
	const statement: AstTypes.BlockStatement = {
		type: 'BlockStatement',
		body: []
	};
	return statement;
}

export function expressionStatement(expression: AstTypes.Expression): AstTypes.ExpressionStatement {
	const statement: AstTypes.ExpressionStatement = {
		type: 'ExpressionStatement',
		expression
	};
	return statement;
}

export function addFromString(
	ast: AstTypes.BlockStatement | AstTypes.Program,
	value: string
): void {
	const program = parseScript(dedent(value));

	for (const childNode of program.body) {
		// @ts-expect-error
		ast.body.push(childNode);
	}
}

export function expressionFromString(value: string): AstTypes.Expression {
	const program = parseScript(dedent(value));
	const statement = program.body[0]!;
	if (statement.type !== 'ExpressionStatement') {
		throw new Error('value passed was not an expression');
	}

	return statement.expression;
}

export function statementFromString(value: string): AstTypes.Statement {
	return fromString<AstTypes.Statement>(value);
}

export function fromString<T extends AstTypes.Node>(value: string): T {
	const program = parseScript(dedent(value));
	const statement = program.body[0]!;

	return statement as T;
}

/** Appends the statement to body of the block if it doesn't already exist */
export function addStatement(
	ast: AstTypes.BlockStatement | AstTypes.Program,
	statement: AstTypes.Statement
): void {
	if (!hasNode(ast, statement)) ast.body.push(statement);
}

/** Returns `true` if the provided node exists in the AST */
export function hasNode(ast: AstTypes.Node, nodeToMatch: AstTypes.Node): boolean {
	let found = false;
	Walker.walk(ast, null, {
		_(node, { next, stop }) {
			if (node.type === nodeToMatch.type) {
				found = areNodesEqual(node, nodeToMatch);
				if (found) stop();
			}
			next();
		}
	});

	return found;
}

export function hasTypeProp(
	name: string,
	node: AstTypes.TSInterfaceDeclaration['body']['body'][number]
): boolean {
	return (
		node.type === 'TSPropertySignature' && node.key.type === 'Identifier' && node.key.name === name
	);
}
