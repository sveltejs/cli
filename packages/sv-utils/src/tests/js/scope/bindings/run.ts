import { parseScript, type AstTypes } from '../../../../tooling/index.ts';
import { scope } from '../../../../tooling/js/index.ts';

export function run(_ast: AstTypes.Program): void {
	const program = parseScript(`
		import value, { named as alias } from 'module';
		export const { a: local, b: [item], ...rest } = value;
		export function top() {}
		interface Shape {}
		namespace Space {}
		function outer(param: string, { option = true }) {
			const nested = param;
			if (nested) {
				let block;
				class Inner {}
			}
			try { work(); } catch (error) {}
			return (arrow: string) => arrow;
		}
	`).ast;
	const declaration = (program.body[1] as AstTypes.ExportNamedDeclaration)
		.declaration as AstTypes.VariableDeclaration;
	const patternNames = scope.collectPatternNames(declaration.declarations[0]!.id);
	const topLevel = [...scope.topLevelBindings([program])];
	const nested = [...scope.nestedBindingNames(program.body)].sort();
	const expectedNested = ['Inner', 'arrow', 'block', 'error', 'nested', 'option', 'param'];

	if (patternNames.join() !== 'local,item,rest') throw new Error('Unexpected pattern names');
	if (topLevel.join() !== 'value,alias,local,item,rest,top,Shape,Space,outer') {
		throw new Error('Unexpected top-level bindings');
	}
	if (nested.join() !== expectedNested.join()) throw new Error('Unexpected nested bindings');
}
