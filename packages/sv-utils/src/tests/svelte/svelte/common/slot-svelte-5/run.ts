import { type SvelteAst, svelte } from '../../../../../index.ts';

export function run(ast: SvelteAst.Root): void {
	svelte.addSlot(ast, { svelteVersion: '5.0.0' });
}
