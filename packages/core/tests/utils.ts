import { expect, test } from 'vitest';
import dedent from 'dedent';
import {
	parseScript,
	serializeScript,
	guessIndentString,
	type AstTypes
} from '../tooling/index.ts';

test('guessIndentString - one tab', () => {
	const code = dedent`
    for(const foo of bar) {
    	console.log(foo)
    }
    `;

	expect(guessIndentString(code)).toBe('\t');
});

test('guessIndentString - two spaces', () => {
	const code = dedent`
    for(const foo of bar) {
      console.log(foo)
    }
    `;

	expect(guessIndentString(code)).toBe('  ');
});

test('guessIndentString - four spaces', () => {
	const code = dedent`
    for(const foo of bar) {
        console.log(foo)
    }
    `;

	expect(guessIndentString(code)).toBe('    ');
});

test('guessIndentString - eight spaces', () => {
	const code = dedent`
    for(const foo of bar) {
            console.log(foo)
    }
    `;

	expect(guessIndentString(code)).toBe('        ');
});

const newVariableDeclaration: AstTypes.VariableDeclaration = {
	type: 'VariableDeclaration',
	kind: 'const',
	declarations: [
		{
			type: 'VariableDeclarator',
			id: {
				type: 'Identifier',
				name: 'foobar2'
			},
			init: {
				type: 'Literal',
				value: 'test'
			}
		}
	]
};

test('integration - simple', () => {
	const code = dedent`
    import foo from 'bar';

    function bar() {
        console.log("bar");
        const foobar = "foo";
    }
    `;
	const { ast, comments } = parseScript(code);
	const method = ast.body[1] as AstTypes.FunctionDeclaration;

	method.body.body.push(newVariableDeclaration);

	// new variable is added with correct indentation and matching quotes
	expect(serializeScript(ast, comments, code)).toMatchInlineSnapshot(`
		"import foo from 'bar';

		function bar() {
		    console.log("bar");

		    const foobar = "foo";
		    const foobar2 = 'test';
		}"
	`);
});

test('integration - simple 2', () => {
	const code = dedent`
    import foo from 'bar';

    function bar() {
      console.log("bar");
      const foobar = 'foo';
    }
    `;
	const { ast, comments } = parseScript(code);
	const method = ast.body[1] as AstTypes.FunctionDeclaration;

	method.body.body.push(newVariableDeclaration);

	// new variable is added with correct indentation and matching quotes
	expect(serializeScript(ast, comments, code)).toMatchInlineSnapshot(`
		"import foo from 'bar';

		function bar() {
		  console.log("bar");

		  const foobar = 'foo';
		  const foobar2 = 'test';
		}"
	`);
});

test('integration - preserves comments', () => {
	const code = dedent`
	  /** @type {string} */
    let foo = 'bar';
    `;
	const { ast, comments } = parseScript(code);

	expect(serializeScript(ast, comments, code)).toMatchInlineSnapshot(`
		"/** @type {string} */
		let foo = 'bar';"
	`);
});
