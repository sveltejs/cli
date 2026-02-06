import { addAtRule } from '../../../../tooling/css/index.ts';
import { type SvelteAst } from '../../../../tooling/index.ts';

export function run(ast: SvelteAst.CSS.StyleSheet): void {
	addAtRule(ast, { name: 'tailwind', params: "'lib/path/file.ext'", append: false });
	addAtRule(ast, { name: 'tailwind', params: "'lib/path/file1.ext'", append: true });
}
