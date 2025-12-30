import { parseScript, type SvelteAst } from '../index.ts';
import { parseSvelte } from '../parsers.ts';
import { appendFromString } from '../js/common.ts';

export type { SvelteAst };

type RootWithInstance = SvelteAst.Root & { instance: SvelteAst.Script };

// because we create instance if it doesn't exist, we can assert its presence
// for all further processing after calling this function.
export function ensureScript(
	ast: SvelteAst.Root,
	options?: { langTs?: boolean }
): asserts ast is RootWithInstance {
	if (ast.instance?.content) return;

	ast.instance = {
		type: 'Script',
		start: 0,
		end: 0,
		context: 'default',
		// @ts-expect-error
		attributes: options?.langTs
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
	options: { svelteVersion: string; langTs?: boolean }
): void {
	const slotSyntax =
		options.svelteVersion &&
		(options.svelteVersion.startsWith('4') || options.svelteVersion.startsWith('3'));

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

	ensureScript(ast, { langTs: options.langTs });
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

export function toFragment(content: string): SvelteAst.Fragment['nodes'] {
	const { ast } = parseSvelte(content);
	return ast.fragment.nodes;
}
