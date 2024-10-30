import {
	type AstKinds,
	type AstTypes,
	Walker,
	parseScript,
	serializeScript,
	stripAst
} from '@sveltejs/ast-tooling';
import decircular from 'decircular';
import dedent from 'dedent';

export function addJsDocTypeComment(node: AstTypes.Node, type: string): void {
	const comment: AstTypes.CommentBlock = {
		type: 'CommentBlock',
		value: `* @type {${type}} `,
		leading: true
	};

	addComment(node, comment);
}

export function addJsDocComment(node: AstTypes.Node, params: Record<string, string>): void {
	const commentLines: string[] = [];
	for (const [key, value] of Object.entries(params)) {
		commentLines.push(`@param {${key}} ${value}`);
	}

	const comment: AstTypes.CommentBlock = {
		type: 'CommentBlock',
		value: `*\n * ${commentLines.join('\n * ')}\n `,
		leading: true
	};

	addComment(node, comment);
}

function addComment(node: AstTypes.Node, comment: AstTypes.CommentBlock) {
	node.comments ??= [];

	const found = node.comments.find((n) => n.type === 'CommentBlock' && n.value === comment.value);
	if (!found) node.comments.push(comment);
}

export function typeAnnotateExpression(
	node: AstKinds.ExpressionKind,
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
	node: AstKinds.ExpressionKind,
	type: string
): AstTypes.TSSatisfiesExpression {
	const expression: AstTypes.TSSatisfiesExpression = {
		type: 'TSSatisfiesExpression',
		expression: node,
		typeAnnotation: { type: 'TSTypeReference', typeName: { type: 'Identifier', name: type } }
	};

	return expression;
}

export function createSpreadElement(expression: AstKinds.ExpressionKind): AstTypes.SpreadElement {
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

export function areNodesEqual(ast1: AstTypes.ASTNode, ast2: AstTypes.ASTNode): boolean {
	// We're deep cloning these trees so that we can strip the locations off of them for comparisons.
	// Without this, we'd be getting false negatives due to slight differences in formatting style.
	// These ASTs are also filled to the brim with circular references, which prevents
	// us from using `structuredCloned` directly
	const ast1Clone = stripAst(decircular(ast1), 'loc');
	const ast2Clone = stripAst(decircular(ast2), 'loc');
	return serializeScript(ast1Clone) === serializeScript(ast2Clone);
}

export function blockStatement(): AstTypes.BlockStatement {
	const statement: AstTypes.BlockStatement = {
		type: 'BlockStatement',
		body: []
	};
	return statement;
}

export function expressionStatement(
	expression: AstKinds.ExpressionKind
): AstTypes.ExpressionStatement {
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
		ast.body.push(childNode);
	}
}

export function expressionFromString(value: string): AstKinds.ExpressionKind {
	const program = parseScript(dedent(value));
	const statement = program.body[0]!;
	if (statement.type !== 'ExpressionStatement') {
		throw new Error('value passed was not an expression');
	}

	return statement.expression;
}

export function statementFromString(value: string): AstKinds.StatementKind {
	const program = parseScript(dedent(value));
	const statement = program.body[0]!;

	return statement;
}

/** Appends the statement to body of the block if it doesn't already exist */
export function addStatement(
	ast: AstTypes.BlockStatement | AstTypes.Program,
	statement: AstKinds.StatementKind
): void {
	if (!hasNode(ast, statement)) ast.body.push(statement);
}

/** Returns `true` if the provided node exists in the AST */
export function hasNode(ast: AstTypes.ASTNode, nodeToMatch: AstTypes.ASTNode): boolean {
	let found = false;
	// prettier-ignore
	// this gets needlessly butchered by prettier
	Walker.walk(ast, {}, {
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
