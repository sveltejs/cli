import { type SvelteAst } from '../../../../../core.ts';
import { ensureScript } from '../../../../tooling/svelte/index.ts';

export function run(ast: SvelteAst.Root): void {
	ensureScript(ast, { language: 'ts' });
}
