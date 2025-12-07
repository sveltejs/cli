import { type SvelteAst, addSlot } from '../../../../tooling/svelte/index.ts';

export function run(ast: SvelteAst.Root): void {
	addSlot(ast, { svelteVersion: '5.0.0' });
}
