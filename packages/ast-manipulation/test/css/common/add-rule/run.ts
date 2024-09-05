import type { CssAstEditor } from '@svelte-cli/ast-manipulation';

export function run({ ast, addRule, addDeclaration }: CssAstEditor): void {
	const barSelectorRule = addRule(ast, '.bar');
	addDeclaration(barSelectorRule, 'color', 'blue');
}
