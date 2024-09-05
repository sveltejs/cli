import type { CssAstEditor } from '@svelte-cli/ast-manipulation';

export function run({ ast, addAtRule }: CssAstEditor): void {
	addAtRule(ast, 'tailwind', "'lib/path/file.ext'", false);
	addAtRule(ast, 'tailwind', "'lib/path/file1.ext'", true);
}
