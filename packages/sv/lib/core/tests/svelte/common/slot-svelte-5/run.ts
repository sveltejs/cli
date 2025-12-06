import { type SvelteAst, addSlot } from '@sveltejs/cli-core/svelte';

export function run(ast: SvelteAst.Root): void {
	addSlot(ast, { svelteVersion: '5.0.0' });
}
