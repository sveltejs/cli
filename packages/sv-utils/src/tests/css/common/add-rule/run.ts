import { addDeclaration, addRule } from '../../../../tooling/css/index.ts';
import { type SvelteAst } from '../../../../tooling/index.ts';

export function run(ast: SvelteAst.CSS.StyleSheet): void {
	const barSelectorRule = addRule(ast, {
		selector: 'bar'
	});
	addDeclaration(barSelectorRule, {
		property: 'color',
		value: 'blue'
	});
}
