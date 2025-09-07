import { object, type AstTypes } from '@sveltejs/cli-core/js';
import { getTestObjectExpression } from '../objectTestHelper.ts';

export function run(ast: AstTypes.Program): void {
	const obj = getTestObjectExpression(ast);

	// Create the nested structure a.b.c = '007'
	object.overrideProperties(obj, {
		a: { b: { c: '007' } }
	});

	// Transform the 'c' property to add a comment using nested structure
	object.transformProperty(obj, {
		a: {
			b: {
				c: (property) => {
					property.leadingComments = [{ type: 'Block', value: 'aka: bond, james bond' }];
					return property;
				}
			}
		}
	});
}
