import { type SvelteAst, ensureScript } from '@sveltejs/cli-core/svelte';

export function run(ast: SvelteAst.Root): void {
	ensureScript(ast, { langTs: true });
}
