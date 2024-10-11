import { addComment } from '@sveltejs/cli-core/css';
import type { CssFileEditor } from '@sveltejs/cli-core';

export function run({ ast }: CssFileEditor<any>): void {
	addComment(ast, 'foo comment');
}
