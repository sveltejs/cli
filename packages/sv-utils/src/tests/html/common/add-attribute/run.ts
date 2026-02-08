import { addAttribute } from '../../../../tooling/html/index.ts';
import type { SvelteAst } from '../../../../tooling/index.ts';

export function run(ast: SvelteAst.Fragment): void {
	const element = ast.nodes[0] as SvelteAst.RegularElement;
	addAttribute(element, 'class', 'foo');
}
