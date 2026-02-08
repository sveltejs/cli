import type { SvelteAst } from '../../../../tooling/index.ts';
import * as svelte from '../../../../tooling/svelte/index.ts';

export function run(ast: SvelteAst.Root): void {
	svelte.addSlot(ast, { svelteVersion: '5.0.0' });
}
