import { common, object, type AstTypes } from '@sveltejs/cli-core/js';
import { getTestObjectExpression } from '../objectTestHelper.ts';

export function run(ast: AstTypes.Program): void {
	const obj = getTestObjectExpression(ast);

	// Create & Transform the 'c' property to add a comment using nested structure
	object.transformProperty(obj, {
		a: {
			b: {
				c: (property) => {
					property.value = common.createLiteral(true);
					property.leadingComments = [{ type: 'Block', value: 'aka: bond, james bond' }];
					return property;
				}
			}
		}
	});
}
