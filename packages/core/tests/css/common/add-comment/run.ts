import { addComment } from '@svelte-cli/core/css';
import type { CssFileEditor } from '@svelte-cli/core';

export function run({ ast }: CssFileEditor<any>): void {
	addComment(ast, 'foo comment');
}
