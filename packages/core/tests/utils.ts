import { describe, expect, test } from 'vitest';
import dedent from 'dedent';
import {
	parseScript,
	serializeScript,
	guessIndentString,
	type AstTypes,
	serializeYaml,
	parseYaml
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
	const { ast, commentState } = parseScript(code);
	const method = ast.body[1] as AstTypes.FunctionDeclaration;

	method.body.body.push(newVariableDeclaration);

	// new variable is added with correct indentation and matching quotes
	expect(serializeScript(ast, commentState, code)).toMatchInlineSnapshot(`
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
	const { ast, commentState } = parseScript(code);
	const method = ast.body[1] as AstTypes.FunctionDeclaration;

	method.body.body.push(newVariableDeclaration);

	// new variable is added with correct indentation and matching quotes
	expect(serializeScript(ast, commentState, code)).toMatchInlineSnapshot(`
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
	const { ast, commentState } = parseScript(code);

	expect(serializeScript(ast, commentState, code)).toMatchInlineSnapshot(`
		"/** @type {string} */
		let foo = 'bar';"
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

// TODO: fix https://github.com/rolldown/tsdown/issues/575 to remove the `skip`
test.skip('tsdown escapes script tags in bundled source code', async () => {
	const { execSync } = await import('node:child_process');
	const fs = await import('node:fs');
	const path = await import('node:path');

	const testDir = path.join('../..', '.test-output', `tsdown-test`);
	fs.rmSync(testDir, { recursive: true, force: true });
	fs.mkdirSync(testDir, { recursive: true });

	// Create a test file that uses dedent with script tags
	const testFileLiteral = path.join(testDir, 'testLiteral.ts');
	fs.writeFileSync(
		testFileLiteral,
		`import dedent from 'dedent';

export const result = dedent\`
	<script lang="ts">
		console.log('Hello Literal');
	</script>
\`;
`
	);

	const testFileFunction = path.join(testDir, 'testFunction.ts');
	fs.writeFileSync(
		testFileFunction,
		`import dedent from 'dedent';

export const result = dedent(\`
	<script lang="ts">
		console.log('Hello Function');
	</script>
\`);
`
	);

	// Create a tsdown config
	const configFile = path.join(testDir, 'tsdown.config.ts');
	fs.writeFileSync(
		configFile,
		`import { defineConfig } from 'tsdown';

export default defineConfig({
	entry: ['testLiteral.ts', 'testFunction.ts'],
	format: ['esm'],
	outDir: 'dist',
});
`
	);

	// Create package.json with tsdown
	const pkgJson = {
		name: 'test',
		type: 'module',
		devDependencies: {
			tsdown: '^0.15.2',
			dedent: '^1.6.0'
		}
	};
	fs.writeFileSync(path.join(testDir, 'package.json'), JSON.stringify(pkgJson, null, 2));

	// Install dependencies and build
	execSync('npm install', { cwd: testDir, stdio: 'pipe' });
	execSync('npx tsdown', { cwd: testDir, stdio: 'pipe' });

	// Read the bundled output
	const bundledFileLiteral = path.join(testDir, 'dist', 'testLiteral.js');
	const bundledFileFunction = path.join(testDir, 'dist', 'testFunction.js');
	const bundledCodeLiteral = fs.readFileSync(bundledFileLiteral, 'utf-8');
	const bundledCodeFunction = fs.readFileSync(bundledFileFunction, 'utf-8');

	// Check if the bundled code contains escaped script tags
	const hasEscapedScriptTagLiteral = bundledCodeLiteral.includes('<\\/script>');
	const hasEscapedScriptTagFunction = bundledCodeFunction.includes('<\\/script>');

	// This test demonstrates the issue: tsdown escapes </script> in the bundled source
	// Expected: Bundled code should NOT contain escaped script tags
	// Actual: Bundled code contains <\/script> when using dedent`...` syntax
	expect(hasEscapedScriptTagLiteral).toBe(false);
	expect(hasEscapedScriptTagFunction).toBe(false);
}, 30000); // 30s timeout for npm install and build
