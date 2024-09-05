import type { CssAstEditor } from '@svelte-cli/ast-manipulation';

export function run({ ast, addComment }: CssAstEditor): void {
	addComment(ast, 'foo comment');
}
