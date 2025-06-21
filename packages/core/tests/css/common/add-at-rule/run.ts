import { addAtRule, type CssAst } from '@sveltejs/cli-core/css';

export function run(ast: CssAst): void {
	addAtRule(ast, { name: 'tailwind', params: "'lib/path/file.ext'", append: false });
	addAtRule(ast, { name: 'tailwind', params: "'lib/path/file1.ext'", append: true });
}
