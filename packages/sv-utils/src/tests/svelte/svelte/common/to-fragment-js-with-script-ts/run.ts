import { type SvelteAst, svelte } from '../../../../../index.ts';

export function run(ast: SvelteAst.Root): void {
	svelte.addFragment(ast, '<span>{1 + 2}</span>');
}
