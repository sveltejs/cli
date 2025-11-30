import { parseScript, type AstTypes, type SvelteAst } from '../index.ts';
import { parseSvelte } from '../parsers.ts';
import { appendFromString } from '../js/common.ts';

export type { SvelteAst };

export function ensureScript(ast: SvelteAst.Root): AstTypes.Program {
	let scriptAst = ast.instance?.content;
	if (!scriptAst) {
		scriptAst = parseScript('').ast;
		ast.instance = {
			type: 'Script',
			start: 0,
			end: 0,
			context: 'default',
			attributes: [],
			content: scriptAst
		};
	}

	return scriptAst;
}

export function addSlot(ast: SvelteAst.Root, options: { svelteVersion: string }): void {
	const slotSyntax =
		options.svelteVersion &&
		(options.svelteVersion.startsWith('4') || options.svelteVersion.startsWith('3'));

	if (slotSyntax) {
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

	const scriptAst = ensureScript(ast);
	appendFromString(scriptAst, {
		code: 'let { children } = $props();'
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
	// TODO write test
	const { ast } = parseSvelte(content);
	return ast.fragment.nodes;
}
