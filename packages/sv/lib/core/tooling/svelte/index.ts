import { type AstTypes, type SvelteAst, parseScript } from '../index.ts';
import { appendFromString } from '../js/common.ts';
import { parseSvelte } from '../parsers.ts';

export function ensureScript(
	ast: SvelteAst.Root,
	options?: { langTs?: boolean }
): AstTypes.Program {
	let scriptAst = ast.instance?.content;
	if (!scriptAst) {
		scriptAst = parseScript('').ast;
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
			content: scriptAst
		};
	}

	return scriptAst;
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

	const scriptAst = ensureScript(ast, { langTs: options.langTs });
	appendFromString(scriptAst, {
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
	ast: SvelteAst.Root,
	content: string,
	options?: {
		mode?: 'append' | 'prepend';
	}
): void {
	const { ast: fragmentAst } = parseSvelte(content);

	if (options?.mode === 'prepend') {
		ast.fragment.nodes.unshift(...fragmentAst.fragment.nodes);
	} else {
		ast.fragment.nodes.push(...fragmentAst.fragment.nodes);
	}
}
