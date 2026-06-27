import { describe, expect, it } from 'vitest';
import { parseScript, serializeScript } from '../tooling/index.ts';

describe('serializeScript cross-channel comment dedup', () => {
	it('does not duplicate a comment present in both the positional list and a node map', () => {
		const input = `// LEADING COMMENT\nconst a = 1;\n`;
		const { ast, comments } = parseScript(input);
		// re-homing an already-parsed (positional) comment onto the node it documents
		comments.add(ast.body[0] as never, { type: 'Line', value: ' LEADING COMMENT' });

		const output = serializeScript(ast, comments, input);
		expect(output.split('// LEADING COMMENT').length - 1, output).toBe(1);
	});

	it('keeps genuinely repeated identical comments when only one is re-homed', () => {
		const input = `// TODO\nconst a = 1;\n\n// TODO\nconst b = 2;\n`;
		const { ast, comments } = parseScript(input);
		// explicitly attach one copy to its node; the other stays purely positional
		comments.add(ast.body[0] as never, { type: 'Line', value: ' TODO' });

		const output = serializeScript(ast, comments, input);
		expect(output.split('// TODO').length - 1, output).toBe(2);
	});
});
