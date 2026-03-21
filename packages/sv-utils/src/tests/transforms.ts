import { describe, expect, it } from 'vitest';
import { addAtRule } from '../tooling/css/index.ts';
import { isTransform, transforms } from '../tooling/transforms.ts';

describe('transforms', () => {
	describe('json', () => {
		it('roundtrip: parse → mutate → generateCode', () => {
			const input = '{"name":"old"}';
			const fn = transforms.json((data) => {
				data.name = 'new';
			});
			const result = fn(input);
			expect(JSON.parse(result)).toEqual({ name: 'new' });
		});

		it('abort: returns original content on false', () => {
			const input = '{"name":"old"}';
			const fn = transforms.json(() => false);
			expect(fn(input)).toBe(input);
		});

		it('onParseError: calls handler and returns original content', () => {
			const input = 'not: json';
			let caught = false;
			const fn = transforms.json(() => {}, {
				onParseError: () => {
					caught = true;
				}
			});
			expect(fn(input)).toBe(input);
			expect(caught).toBe(true);
		});

		it('throws on parse error without onParseError', () => {
			const fn = transforms.json(() => {});
			expect(() => fn('not: json')).toThrow();
		});
	});

	describe('text', () => {
		it('transforms content', () => {
			const fn = transforms.text((content) => content + '\nappended');
			expect(fn('line1')).toBe('line1\nappended');
		});

		it('abort: returns original content on false', () => {
			const input = 'original';
			const fn = transforms.text(() => false);
			expect(fn(input)).toBe(input);
		});
	});

	describe('script', () => {
		it('roundtrip: parse → mutate → generateCode', () => {
			const input = 'const x = 1;';
			const fn = transforms.script((ast) => {
				const decl = ast.body[0];
				if (decl.type === 'VariableDeclaration') {
					const declarator = decl.declarations[0];
					if (declarator.id.type === 'Identifier') {
						declarator.id.name = 'y';
					}
				}
			});
			expect(fn(input)).toContain('const y = 1');
		});

		it('abort: returns original content on false', () => {
			const input = 'const x = 1;';
			const fn = transforms.script(() => false);
			expect(fn(input)).toBe(input);
		});

		it('onParseError: calls handler and returns original content', () => {
			let caught = false;
			const fn = transforms.script(() => {}, {
				onParseError: () => {
					caught = true;
				}
			});
			expect(fn('this is not valid {{{ js')).toBe('this is not valid {{{ js');
			expect(caught).toBe(true);
		});
	});

	describe('svelte', () => {
		it('roundtrip: parse → mutate → generateCode', () => {
			const input = '<p>hello</p>';
			const fn = transforms.svelte((ast) => {
				const node = ast.fragment.nodes[0];
				if (node.type === 'RegularElement') {
					const textNode = node.fragment.nodes[0];
					if (textNode.type === 'Text') {
						textNode.data = 'world';
					}
				}
			});
			expect(fn(input)).toContain('world');
		});

		it('abort: returns original content on false', () => {
			const input = '<p>hello</p>';
			const fn = transforms.svelte(() => false);
			expect(fn(input)).toBe(input);
		});
	});

	describe('css', () => {
		it('roundtrip: parse → mutate → generateCode', () => {
			const input = 'body { color: red; }';
			const fn = transforms.css((ast) => {
				addAtRule(ast, { name: 'import', params: "'tailwindcss'", append: false });
			});
			const result = fn(input);
			expect(result).toContain("@import 'tailwindcss'");
			expect(result).toContain('body');
		});

		it('abort: returns original content on false', () => {
			const input = 'body { color: red; }';
			const fn = transforms.css(() => false);
			expect(fn(input)).toBe(input);
		});
	});

	describe('html', () => {
		it('roundtrip: parse → mutate → generateCode', () => {
			const input = '<div>hello</div>';
			const fn = transforms.html((ast) => {
				const node = ast.nodes[0];
				if (node.type === 'RegularElement') {
					const textNode = node.fragment.nodes[0];
					if (textNode.type === 'Text') {
						textNode.data = 'world';
					}
				}
			});
			expect(fn(input)).toContain('world');
		});

		it('abort: returns original content on false', () => {
			const input = '<div>hello</div>';
			const fn = transforms.html(() => false);
			expect(fn(input)).toBe(input);
		});
	});

	describe('yaml', () => {
		it('roundtrip: parse → mutate → generateCode', () => {
			const input = 'name: old\n';
			const fn = transforms.yaml((data) => {
				data.set('name', 'new');
			});
			expect(fn(input)).toContain('name: new');
		});

		it('abort: returns original content on false', () => {
			const input = 'name: old\n';
			const fn = transforms.yaml(() => false);
			expect(fn(input)).toBe(input);
		});
	});

	describe('toml', () => {
		it('roundtrip: parse → mutate → generateCode', () => {
			const input = 'name = "old"\n';
			const fn = transforms.toml((data) => {
				data.name = 'new';
			});
			expect(fn(input)).toContain('name = "new"');
		});

		it('abort: returns original content on false', () => {
			const input = 'name = "old"\n';
			const fn = transforms.toml(() => false);
			expect(fn(input)).toBe(input);
		});
	});

	describe('isTransform', () => {
		it('returns true for branded transform', () => {
			expect(isTransform(transforms.json(() => {}))).toBe(true);
		});

		it('returns false for plain function', () => {
			expect(isTransform((content: string) => content)).toBe(false);
		});
	});

	describe('default context', () => {
		it('defaults to js language', () => {
			let receivedLanguage: string | undefined;
			const fn = transforms.script((_ast, _comments, ctx) => {
				receivedLanguage = ctx.language;
			});
			fn('const x = 1;');
			expect(receivedLanguage).toBe('js');
		});

		it('accepts custom context', () => {
			let receivedLanguage: string | undefined;
			const fn = transforms.script((_ast, _comments, ctx) => {
				receivedLanguage = ctx.language;
			});
			fn('const x = 1;', { language: 'ts' });
			expect(receivedLanguage).toBe('ts');
		});
	});
});
