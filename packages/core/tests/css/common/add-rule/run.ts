import { addDeclaration, addRule } from '@svelte-cli/core/css';
import type { CssFileEditor } from '@svelte-cli/core';

export function run({ ast }: CssFileEditor<any>): void {
	const barSelectorRule = addRule(ast, '.bar');
	addDeclaration(barSelectorRule, 'color', 'blue');
}
