import { type SvelteAst, svelte } from '../../../../../index.ts';

export function run(ast: SvelteAst.Root): void {
	const [pre, , button] = ast.fragment.nodes as SvelteAst.RegularElement[];

	// no whitespace is added inside an element, it would change what's rendered
	svelte.addFragment(pre, '<b>line 1 continued</b>');
	svelte.addFragment(button, 'Save');
	svelte.addFragment(button, '<b>Unsaved</b>', { mode: 'prepend' });
}
