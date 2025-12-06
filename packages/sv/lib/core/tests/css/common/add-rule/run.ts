import { addDeclaration, addRule, type CssAst } from '../../../../tooling/css/index.ts';

export function run(ast: CssAst): void {
	const barSelectorRule = addRule(ast, {
		selector: '.bar'
	});
	addDeclaration(barSelectorRule, {
		property: 'color',
		value: 'blue'
	});
}
