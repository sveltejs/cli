import { describe, expect, it } from 'vitest';
import { addAtRule } from '../tooling/css/index.ts';
import { transforms } from '../tooling/transforms.ts';

describe('transforms', () => {
	describe('json', () => {
		it('roundtrip: parse → mutate → generateCode', () => {
			const input = '{"name":"old"}';
			const result = transforms.json(input, (data) => {
				data.name = 'new';
			});
			expect(JSON.parse(result)).toEqual({ name: 'new' });
		});

		it('abort: returns original content on false', () => {
			const input = '{"name":"old"}';
			expect(transforms.json(input, () => false)).toBe(input);
		});

		it('onParseError: calls handler and returns original content', () => {
			const input = 'not: json';
			let caught = false;
			const result = transforms.json(input, () => {}, {
				onParseError: () => {
					caught = true;
				}
			});
			expect(result).toBe(input);
			expect(caught).toBe(true);
		});

		it('throws on parse error without onParseError', () => {
			expect(() => transforms.json('not: json', () => {})).toThrow();
		});
	});

	describe('text', () => {
		it('transforms content', () => {
			expect(transforms.text('line1', (content) => content + '\nappended')).toBe('line1\nappended');
		});

		it('abort: returns original content on false', () => {
			const input = 'original';
			expect(transforms.text(input, () => false)).toBe(input);
		});
	});

	describe('script', () => {
		it('roundtrip: parse → mutate → generateCode', () => {
			const input = 'const x = 1;';
			const result = transforms.script(input, (ast) => {
				const decl = ast.body[0];
				if (decl.type === 'VariableDeclaration') {
					const declarator = decl.declarations[0];
					if (declarator.id.type === 'Identifier') {
						declarator.id.name = 'y';
					}
				}
			});
			expect(result).toContain('const y = 1');
		});

		it('abort: returns original content on false', () => {
			const input = 'const x = 1;';
			expect(transforms.script(input, () => false)).toBe(input);
		});

		it('onParseError: calls handler and returns original content', () => {
			let caught = false;
			const result = transforms.script('this is not valid {{{ js', () => {}, {
				onParseError: () => {
					caught = true;
				}
			});
			expect(result).toBe('this is not valid {{{ js');
			expect(caught).toBe(true);
		});
	});

	describe('svelte', () => {
		it('roundtrip: parse → mutate → generateCode', () => {
			const input = '<p>hello</p>';
			const result = transforms.svelte(input, (ast) => {
				const node = ast.fragment.nodes[0];
				if (node.type === 'RegularElement') {
					const textNode = node.fragment.nodes[0];
					if (textNode.type === 'Text') {
						textNode.data = 'world';
					}
				}
			});
			expect(result).toContain('world');
		});

		it('abort: returns original content on false', () => {
			const input = '<p>hello</p>';
			expect(transforms.svelte(input, () => false)).toBe(input);
		});
	});

	describe('css', () => {
		it('roundtrip: parse → mutate → generateCode', () => {
			const input = 'body { color: red; }';
			const result = transforms.css(input, (ast) => {
				addAtRule(ast, { name: 'import', params: "'tailwindcss'", append: false });
			});
			expect(result).toContain("@import 'tailwindcss'");
			expect(result).toContain('body');
		});

		it('abort: returns original content on false', () => {
			const input = 'body { color: red; }';
			expect(transforms.css(input, () => false)).toBe(input);
		});
	});

	describe('html', () => {
		it('roundtrip: parse → mutate → generateCode', () => {
			const input = '<div>hello</div>';
			const result = transforms.html(input, (ast) => {
				const node = ast.nodes[0];
				if (node.type === 'RegularElement') {
					const textNode = node.fragment.nodes[0];
					if (textNode.type === 'Text') {
						textNode.data = 'world';
					}
				}
			});
			expect(result).toContain('world');
		});

		it('abort: returns original content on false', () => {
			const input = '<div>hello</div>';
			expect(transforms.html(input, () => false)).toBe(input);
		});
	});

	describe('yaml', () => {
		it('roundtrip: parse → mutate → generateCode', () => {
			const input = 'name: old\n';
			const result = transforms.yaml(input, (data) => {
				data.set('name', 'new');
			});
			expect(result).toContain('name: new');
		});

		it('abort: returns original content on false', () => {
			const input = 'name: old\n';
			expect(transforms.yaml(input, () => false)).toBe(input);
		});
	});

	describe('toml', () => {
		it('roundtrip: parse → mutate → generateCode', () => {
			const input = 'name = "old"\n';
			const result = transforms.toml(input, (data) => {
				data.name = 'new';
			});
			expect(result).toContain('name = "new"');
		});

		it('abort: returns original content on false', () => {
			const input = 'name = "old"\n';
			expect(transforms.toml(input, () => false)).toBe(input);
		});
	});
});
