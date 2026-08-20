import type { AstTypes } from '../../../../tooling/index.ts';
import { common, identifiers } from '../../../../tooling/js/index.ts';

export function run(ast: AstTypes.Program): void {
	identifiers.replaceReferences(
		[ast],
		['target', 'alias', 'shorthand', 'targetFunction', 'targetParam'],
		() => common.parseExpression('source.value')
	);
}
