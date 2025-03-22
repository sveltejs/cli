import { addAtRule, type CssAst } from '@sveltejs/cli-core/css';

export function run(ast: CssAst): void {
	addAtRule(ast, 'tailwind', "'lib/path/file.ext'", false);
	addAtRule(ast, 'tailwind', "'lib/path/file1.ext'", true);
}
