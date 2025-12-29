import { type SvelteAst, ensureScript } from '../../../../tooling/svelte/index.ts';

export function run(ast: SvelteAst.Root): void {
	ensureScript(ast, { language: 'ts' });
}
