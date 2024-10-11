import { addAtRule } from '@sveltejs/cli-core/css';
import type { CssFileEditor } from '@sveltejs/cli-core';

export function run({ ast }: CssFileEditor<any>): void {
	addAtRule(ast, 'tailwind', "'lib/path/file.ext'", false);
	addAtRule(ast, 'tailwind', "'lib/path/file1.ext'", true);
}
