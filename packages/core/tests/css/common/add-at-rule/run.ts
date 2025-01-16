import { addAtRule } from '@sveltejs/cli-core/css';
import type { CssAst } from '@sveltejs/ast-tooling';

export function run(ast: CssAst): void {
	addAtRule(ast, 'tailwind', "'lib/path/file.ext'", false);
	addAtRule(ast, 'tailwind', "'lib/path/file1.ext'", true);
}
