import { type SvelteAst, toFragment } from '@sveltejs/cli-core/svelte';

export function run(ast: SvelteAst.Root): void {
	ast.fragment.nodes.push(...toFragment('<span>Appended Fragment</span>'));
}
