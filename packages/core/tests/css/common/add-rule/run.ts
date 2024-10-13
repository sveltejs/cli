import { addDeclaration, addRule } from '@sveltejs/cli-core/css';
import type { CssAst } from '@sveltejs/ast-tooling';

export function run(ast: CssAst): void {
	const barSelectorRule = addRule(ast, '.bar');
	addDeclaration(barSelectorRule, 'color', 'blue');
}
