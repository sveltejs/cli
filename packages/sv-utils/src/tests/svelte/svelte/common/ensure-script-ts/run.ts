import { type SvelteAst, svelte } from '../../../../../index.ts';

export function run(ast: SvelteAst.Root): void {
	svelte.ensureScript(ast, { language: 'ts' });
}
