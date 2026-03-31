import { describe, expect, it } from 'vitest';
import { transforms } from '../tooling/transforms.ts';

describe('transforms', () => {
	describe('json', () => {
		it('roundtrip: parse -> mutate -> generateCode', () => {
			const input = '{"name":"old"}';
			const result = transforms.json(({ data }) => {
				data.name = 'new';
			})(input);
			expect(JSON.parse(result)).toEqual({ name: 'new' });
		});

		it('abort: returns original content on false', () => {
			const input = '{"name":"old"}';
			expect(transforms.json(() => false)(input)).toBe(input);
		});

		it('onError: calls handler and returns original content', () => {
			const input = 'not: json';
			let caught = false;
			const result = transforms.json(() => {}, {
				onError: () => {
					caught = true;
				}
			})(input);
			expect(result).toBe(input);
			expect(caught).toBe(true);
		});

		it('throws on parse error without onError', () => {
			expect(() => transforms.json(() => {})('not: json')).toThrow();
		});
	});

	describe('text', () => {
		it('transforms content', () => {
			expect(transforms.text(({ content }) => content + '\nappended')('line1')).toBe(
				'line1\nappended'
			);
		});

		it('abort: returns original content on false', () => {
			const input = 'original';
			expect(transforms.text(() => false)(input)).toBe(input);
		});
	});

	describe('script', () => {
		it('roundtrip: parse -> mutate -> generateCode', () => {
			const input = 'const x = 1;';
			const result = transforms.script(({ ast }) => {
				const decl = ast.body[0];
				if (decl.type === 'VariableDeclaration') {
					const declarator = decl.declarations[0];
					if (declarator.id.type === 'Identifier') {
						declarator.id.name = 'y';
					}
				}
			})(input);
			expect(result).toContain('const y = 1');
		});

		it('abort: returns original content on false', () => {
			const input = 'const x = 1;';
			expect(transforms.script(() => false)(input)).toBe(input);
		});

		it('onError: calls handler and returns original content', () => {
			let caught = false;
			const result = transforms.script(() => {}, {
				onError: () => {
					caught = true;
				}
			})('this is not valid {{{ js');
			expect(result).toBe('this is not valid {{{ js');
			expect(caught).toBe(true);
		});
	});

	describe('svelte', () => {
		it('roundtrip: parse -> mutate -> generateCode', () => {
			const input = '<p>hello</p>';
			const result = transforms.svelte(({ ast }) => {
				const node = ast.fragment.nodes[0];
				if (node.type === 'RegularElement') {
					const textNode = node.fragment.nodes[0];
					if (textNode.type === 'Text') {
						textNode.data = 'world';
					}
				}
			})(input);
			expect(result).toContain('world');
		});

		it('abort: returns original content on false', () => {
			const input = '<p>hello</p>';
			expect(transforms.svelte(() => false)(input)).toBe(input);
		});
	});

	describe('css', () => {
		it('roundtrip: parse -> mutate -> generateCode', () => {
			const input = 'body { color: red; }';
			const result = transforms.css(({ ast, css }) => {
				css.addAtRule(ast, { name: 'import', params: "'tailwindcss'", append: false });
			})(input);
			expect(result).toContain("@import 'tailwindcss'");
			expect(result).toContain('body');
		});

		it('abort: returns original content on false', () => {
			const input = 'body { color: red; }';
			expect(transforms.css(() => false)(input)).toBe(input);
		});
	});

	describe('html', () => {
		it('roundtrip: parse -> mutate -> generateCode', () => {
			const input = '<div>hello</div>';
			const result = transforms.html(({ ast }) => {
				const node = ast.nodes[0];
				if (node.type === 'RegularElement') {
					const textNode = node.fragment.nodes[0];
					if (textNode.type === 'Text') {
						textNode.data = 'world';
					}
				}
			})(input);
			expect(result).toContain('world');
		});

		it('abort: returns original content on false', () => {
			const input = '<div>hello</div>';
			expect(transforms.html(() => false)(input)).toBe(input);
		});
	});

	describe('yaml', () => {
		it('roundtrip: parse -> mutate -> generateCode', () => {
			const input = 'name: old\n';
			const result = transforms.yaml(({ data }) => {
				data.set('name', 'new');
			})(input);
			expect(result).toContain('name: new');
		});

		it('abort: returns original content on false', () => {
			const input = 'name: old\n';
			expect(transforms.yaml(() => false)(input)).toBe(input);
		});
	});

	describe('toml', () => {
		it('roundtrip: parse -> mutate -> generateCode', () => {
			const input = 'name = "old"\n';
			const result = transforms.toml(({ data }) => {
				data.name = 'new';
			})(input);
			expect(result).toContain('name = "new"');
		});

		it('abort: returns original content on false', () => {
			const input = 'name = "old"\n';
			expect(transforms.toml(() => false)(input)).toBe(input);
		});
	});
});
