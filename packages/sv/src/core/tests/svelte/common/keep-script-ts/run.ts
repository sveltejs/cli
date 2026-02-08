import { type SvelteAst, svelte } from '../../../../../core.ts';

export function run(ast: SvelteAst.Root): void {
	svelte.ensureScript(ast);
}
