import { coerceVersion } from '../../semver.ts';
import { parseScript, type SvelteAst } from '../index.ts';
import { appendFromString } from '../js/common.ts';
import { parseSvelte } from '../parsers.ts';

export type RootWithInstance = SvelteAst.Root & { instance: SvelteAst.Script };

// because we create instance if it doesn't exist, we can assert its presence
// for all further processing after calling this function.
export function ensureScript(
	ast: SvelteAst.Root,
	options?: { language?: 'ts' | 'js' }
): asserts ast is RootWithInstance {
	if (ast.instance?.content) return;

	ast.instance = {
		type: 'Script',
		start: 0,
		end: 0,
		context: 'default',
		// @ts-expect-error
		attributes:
			options?.language === 'ts'
				? [
						{
							type: 'Attribute',
							start: 8,
							end: 17,
							name: 'lang',
							value: [{ start: 14, end: 16, type: 'Text', raw: 'ts', data: 'ts' }]
						}
					]
				: [],
		content: parseScript('').ast
	};
}

export function addSlot(
	ast: SvelteAst.Root,
	options: { svelteVersion: string; language?: 'ts' | 'js' }
): void {
	const svelteVersionMajor = options.svelteVersion && coerceVersion(options.svelteVersion).major;
	const slotSyntax = svelteVersionMajor === 4 || svelteVersionMajor === 3;

	if (slotSyntax) {
		// @ts-expect-error
		ast.fragment.nodes.push({
			type: 'SlotElement',
			attributes: [],
			fragment: {
				type: 'Fragment',
				nodes: []
			},
			name: 'slot',
			start: 0,
			end: 0
		});

		return;
	}

	ensureScript(ast, { language: options.language });
	appendFromString(ast.instance.content, {
		code: 'const { children } = $props();'
	});

	ast.fragment.nodes.push({
		type: 'RenderTag',
		expression: {
			type: 'CallExpression',
			callee: {
				type: 'Identifier',
				name: 'children',
				start: 0,
				end: 0
			},
			optional: false,
			arguments: []
		},
		start: 0,
		end: 0
	});
}

export function addFragment(
	ast: SvelteAst.Root | SvelteAst.BaseElement,
	content: string,
	options?: {
		mode?: 'append' | 'prepend';
		language?: 'ts' | 'js';
	}
): void {
	if (options?.language === 'ts' && ast.type === 'Root')
		ensureScript(ast as SvelteAst.Root, { language: 'ts' });

	const source = options?.language === 'ts' ? `<script lang="ts"></script>${content}` : content;
	const { ast: fragmentAst } = parseSvelte(source);

	const added = fragmentAst.fragment.nodes;
	const existing = ast.fragment.nodes;
	if (added.length === 0) return;

	// The printer only breaks a line where the nodes are separated by whitespace.
	// Whitespace between nodes is rendered, so it's only added at the top level:
	// inside an element it would put a space into text or a line break into a `<pre>`.
	const separate = ast.type === 'Root' && existing.length > 0;
	const newline: SvelteAst.Text = { type: 'Text', data: '\n', raw: '\n', start: 0, end: 0 };

	if (options?.mode === 'prepend') {
		if (separate && !isWhitespace(added.at(-1)) && !isWhitespace(existing[0])) {
			existing.unshift(newline);
		}
		existing.unshift(...added);
	} else {
		if (separate && !isWhitespace(existing.at(-1)) && !isWhitespace(added[0])) {
			existing.push(newline);
		}
		existing.push(...added);
	}
}

function isWhitespace(node: SvelteAst.Fragment['nodes'][number] | undefined): boolean {
	return node?.type === 'Text' && node.data.trim() === '';
}
