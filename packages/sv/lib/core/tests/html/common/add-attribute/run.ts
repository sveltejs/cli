import { addAttribute, type SvelteAst } from '../../../../tooling/html/index.ts';

export function run(ast: SvelteAst.Fragment): void {
	const element = ast.nodes[0] as SvelteAst.RegularElement;
	addAttribute(element, 'class', 'foo');
}
