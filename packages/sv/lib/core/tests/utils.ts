import { describe, expect, test } from 'vitest';
import dedent from 'dedent';
import {
	parseScript,
	serializeScript,
	guessIndentString,
	type AstTypes,
	serializeYaml,
	parseYaml,
	guessQuoteStyle
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

test('guessQuoteStyle - single simple', () => {
	const code = dedent`
    console.log('asd');
    `;
	const { ast } = parseScript(code);

	expect(guessQuoteStyle(ast)).toBe('single');
});

test('guessQuoteStyle - single complex', () => {
	const code = dedent`
    import foo from 'bar';

    console.log("bar");
    const foobar = 'foo';
    `;
	const { ast } = parseScript(code);

	expect(guessQuoteStyle(ast)).toBe('single');
});

test('guessQuoteStyle - double simple', () => {
	const code = dedent`
    console.log("asd");
    `;
	const { ast } = parseScript(code);

	expect(guessQuoteStyle(ast)).toBe('double');
});

test('guessQuoteStyle - double complex', () => {
	const code = dedent`
    import foo from 'bar';

    console.log("bar");
    const foobar = "foo";
    `;
	const { ast } = parseScript(code);

	expect(guessQuoteStyle(ast)).toBe('double');
});

test('guessQuoteStyle - no quotes', () => {
	const code = dedent`
    const foo = true;
    `;
	const { ast } = parseScript(code);

	expect(guessQuoteStyle(ast)).toBe(undefined);
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
		    const foobar2 = "test";
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

test('integration - removes comments', () => {
	const code = dedent`
		let foo = {
			/** @type {string} */
			bar: 'baz',
			/** @type {number} */
			baz: 1,
		};
    `;
	const { ast, comments } = parseScript(code);
	comments.remove((c) => c.value.includes('number'));
	expect(serializeScript(ast, comments, code)).toMatchInlineSnapshot(`
		"let foo = {
			/** @type {string} */
			bar: 'baz',
			baz: 1
		};"
	`);
});

describe('yaml', () => {
	test('read and write', () => {
		const input = dedent`foo:  
 - bar
 - baz`;
		const output = serializeYaml(parseYaml(input));
		expect(output).toMatchInlineSnapshot(`
			"foo:
			  - bar
			  - baz
			"
		`);
	});

	test('edit object', () => {
		const input = dedent`foo:  
 # nice comment
 - bar
 - baz`;
		const doc = parseYaml(input);
		const foo = doc.get('foo');
		if (foo) foo.add('yop');
		else doc.set('foo', ['yop']);
		expect(serializeYaml(doc)).toMatchInlineSnapshot(`
			"foo:
			  # nice comment
			  - bar
			  - baz
			  - yop
			"
		`);
	});

	test('add to array (keeping comments)', () => {
		const input = dedent`foo:
 - bar 
 # com 
 - baz`;
		const doc = parseYaml(input);
		const toAdd = ['bar', 'yop1', 'yop2', 'yop1'];
		const foo = doc.get('foo');
		const items: Array<{ value: string } | string> = foo?.items ?? [];
		for (const item of toAdd) {
			if (items.includes(item)) continue;
			if (items.some((y) => typeof y === 'object' && y.value === item)) continue;
			items.push(item);
		}
		doc.set('foo', new Set(items));
		expect(serializeYaml(doc)).toMatchInlineSnapshot(`
			"foo:
			  - bar
			  # com 
			  - baz
			  - yop1
			  - yop2
			"
		`);
	});

	test('create object', () => {
		const input = dedent`# this is my file`;
		const doc = parseYaml(input);
		const foo = doc.get('foo');
		if (foo) foo.add('yop');
		else doc.set('foo', ['yop']);
		expect(serializeYaml(doc)).toMatchInlineSnapshot(`
			"# this is my file

			foo:
			  - yop
			"
		`);
	});

	test('array of foo', () => {
		const input = dedent`foo:  # nice comment - bar - baz`;
		const output = serializeYaml(parseYaml(input));
		expect(output).toMatchInlineSnapshot(`
			"foo: # nice comment - bar - baz
			"
		`);
	});
});
