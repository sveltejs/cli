import { addDeclaration, addRule } from '@sveltejs/cli-core/css';
import type { CssFileEditor } from '@sveltejs/cli-core';

export function run({ ast }: CssFileEditor<any>): void {
	const barSelectorRule = addRule(ast, '.bar');
	addDeclaration(barSelectorRule, 'color', 'blue');
}
