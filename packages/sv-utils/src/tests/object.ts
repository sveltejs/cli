import { describe, expect, test } from 'vitest';
import { parseScript } from '../tooling/index.ts';
import { common, object } from '../tooling/js/index.ts';

function parseObject(properties: string) {
	const { ast } = parseScript(`const value = { ${properties} };`);
	const declaration = ast.body[0];
	if (declaration?.type !== 'VariableDeclaration')
		throw new Error('Expected a variable declaration');
	const value = declaration.declarations[0]?.init;
	if (value?.type !== 'ObjectExpression') throw new Error('Expected an object expression');
	return value;
}

describe('js.object static properties', () => {
	test('finds identifier, quoted, and statically computed keys', () => {
		const value = parseObject("identifier: 1, 'quoted': 2, ['computed']: 3");

		expect(object.findProperty(value, { name: 'identifier' })).toBeDefined();
		expect(object.findProperty(value, { name: 'quoted' })).toBeDefined();
		expect(object.findProperty(value, { name: 'computed' })).toBeDefined();
	});

	test('does not treat a dynamic computed key as statically named', () => {
		const value = parseObject('[dynamic]: 1');

		expect(object.findProperty(value, { name: 'dynamic' })).toBeUndefined();
		expect(object.removeProperty(value, { name: 'dynamic' })).toBe(false);
		expect(value.properties).toHaveLength(1);
	});

	test('removes quoted static keys', () => {
		const value = parseObject("'quoted': 1, sibling: 2");

		expect(object.removeProperty(value, { name: 'quoted' })).toBe(true);
		expect(object.findProperty(value, { name: 'quoted' })).toBeUndefined();
		expect(object.findProperty(value, { name: 'sibling' })).toBeDefined();
	});

	test('get-or-create and override reuse quoted static keys', () => {
		const value = parseObject("'quoted': 1");

		const property = object.propertyNode(value, {
			name: 'quoted',
			fallback: common.createLiteral(2)
		});
		expect(property.value).toMatchObject({ type: 'Literal', value: 1 });
		expect(value.properties).toHaveLength(1);

		object.overrideProperties(value, { quoted: 3 });
		expect(property.value).toMatchObject({ type: 'Literal', value: 3 });
		expect(value.properties).toHaveLength(1);
	});

	test('override does not reuse a dynamic computed key', () => {
		const value = parseObject('[dynamic]: 1');

		object.overrideProperties(value, { dynamic: 2 });
		expect(value.properties).toHaveLength(2);
		expect(object.findProperty(value, { name: 'dynamic' })?.value).toMatchObject({
			type: 'Literal',
			value: 2
		});
	});
});
