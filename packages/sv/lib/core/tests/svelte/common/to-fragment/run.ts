import { type SvelteAst, toFragment } from '../../../../tooling/svelte/index.ts';

export function run(ast: SvelteAst.Root): void {
	ast.fragment.nodes.push(...toFragment('<span>Appended Fragment</span>'));
}
