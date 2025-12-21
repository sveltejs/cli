import { type SvelteAst, svelte } from '../../../../../core.ts';

export function run(ast: SvelteAst.Root): void {
	ast.fragment.nodes.push(...svelte.toFragment('<span>Appended Fragment</span>'));
}
