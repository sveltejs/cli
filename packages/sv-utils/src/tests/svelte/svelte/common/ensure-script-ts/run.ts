import { type SvelteAst, svelte } from '@sveltejs/sv-utils';

export function run(ast: SvelteAst.Root): void {
	svelte.ensureScript(ast, { language: 'ts' });
}
