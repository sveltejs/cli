import { addDeclaration, addRule, type CssAst } from '@sveltejs/cli-core/css';

export function run(ast: CssAst): void {
	const barSelectorRule = addRule(ast, {
		selector: '.bar'
	});
	addDeclaration(barSelectorRule, {
		property: 'color',
		value: 'blue'
	});
}
