import { type SvelteAst, svelte } from '@sveltejs/sv-utils';

export function run(ast: SvelteAst.Root): void {
	svelte.addSlot(ast, { svelteVersion: '4.0.0' });
}
