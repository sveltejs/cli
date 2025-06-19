import { type AstTypes, Walker, parseScript, serializeScript, stripAst } from '../index.ts';
import decircular from 'decircular';
import dedent from 'dedent';

export function addJsDocTypeComment(node: AstTypes.Node, options: { type: string }): void {
	const comment: AstTypes.Comment = {
		type: 'Block',
		value: `* @type {${options.type}} `
	};

	addComment(node, comment);
}

export function addJsDocComment(
	node: AstTypes.Node,
	options: { params: Record<string, string> }
): void {
	const commentLines: string[] = [];
	for (const [key, value] of Object.entries(options.params)) {
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

	const found = node.leadingComments.find(
		(item) => item.type === 'Block' && item.value === comment.value
	);
	if (!found) node.leadingComments.push(comment);
}

export function typeAnnotate(
	node: AstTypes.Expression,
	options: { type: string }
): AstTypes.TSAsExpression {
	const expression: AstTypes.TSAsExpression = {
		type: 'TSAsExpression',
		expression: node,
		typeAnnotation: {
			type: 'TSTypeReference',
			typeName: { type: 'Identifier', name: options.type }
		}
	};

	return expression;
}

export function createSatisfies(
	node: AstTypes.Expression,
	options: { type: string }
): AstTypes.TSSatisfiesExpression {
	const expression: AstTypes.TSSatisfiesExpression = {
		type: 'TSSatisfiesExpression',
		expression: node,
		typeAnnotation: {
			type: 'TSTypeReference',
			typeName: { type: 'Identifier', name: options.type }
		}
	};

	return expression;
}

export function createSpread(argument: AstTypes.Expression): AstTypes.SpreadElement {
	return {
		type: 'SpreadElement',
		argument
	};
}

export function createLiteral(value: string | number | boolean | null): AstTypes.Literal {
	const literal: AstTypes.Literal = {
		type: 'Literal',
		value: value ?? null
	};

	return literal;
}

export function areNodesEqual(node: AstTypes.Node, otherNode: AstTypes.Node): boolean {
	// We're deep cloning these trees so that we can strip the locations off of them for comparisons.
	// Without this, we'd be getting false negatives due to slight differences in formatting style.
	// These ASTs are also filled to the brim with circular references, which prevents
	// us from using `structuredCloned` directly

	const nodeClone = stripAst(decircular(node), ['loc', 'raw']);
	const otherNodeClone = stripAst(decircular(otherNode), ['loc', 'raw']);
	return serializeScript(nodeClone) === serializeScript(otherNodeClone);
}

export function createBlockStatement(): AstTypes.BlockStatement {
	const statement: AstTypes.BlockStatement = {
		type: 'BlockStatement',
		body: []
	};
	return statement;
}

export function createExpressionStatement(options: {
	expression: AstTypes.Expression;
}): AstTypes.ExpressionStatement {
	const statement: AstTypes.ExpressionStatement = {
		type: 'ExpressionStatement',
		expression: options.expression
	};
	return statement;
}

export function appendFromString(
	node: AstTypes.BlockStatement | AstTypes.Program,
	options: { code: string }
): void {
	const program = parseScript(dedent(options.code));

	for (const childNode of program.body) {
		// @ts-expect-error
		node.body.push(childNode);
	}
}

export function parseExpression(code: string): AstTypes.Expression {
	const program = parseScript(dedent(code));
	stripAst(program, ['raw']);
	const statement = program.body[0]!;
	if (statement.type !== 'ExpressionStatement') {
		throw new Error('Code provided was not an expression');
	}

	return statement.expression;
}

export function parseStatement(code: string): AstTypes.Statement {
	return parseFromString<AstTypes.Statement>(code);
}

export function parseFromString<T extends AstTypes.Node>(code: string): T {
	const program = parseScript(dedent(code));
	const statement = program.body[0]!;

	return statement as T;
}

/** Appends the statement to body of the block if it doesn't already exist */
export function appendStatement(
	node: AstTypes.BlockStatement | AstTypes.Program,
	options: { statement: AstTypes.Statement }
): void {
	if (!contains(node, options.statement)) node.body.push(options.statement);
}

/** Returns `true` if the provided node exists in the AST */
export function contains(node: AstTypes.Node, targetNode: AstTypes.Node): boolean {
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

export function hasProperty(
	node: AstTypes.TSInterfaceDeclaration['body']['body'][number],
	options: { name: string }
): boolean {
	return (
		node.type === 'TSPropertySignature' &&
		node.key.type === 'Identifier' &&
		node.key.name === options.name
	);
}
