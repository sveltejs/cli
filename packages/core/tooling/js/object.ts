import type { Expression } from 'estree';
import type { AstTypes } from '../index.ts';
import * as array from './array.ts';
import * as common from './common.ts';

export function property<T extends AstTypes.Expression | AstTypes.Identifier>(
	node: AstTypes.ObjectExpression,
	options: {
		name: string;
		fallback: T;
	}
): T {
	const properties = node.properties.filter((x): x is AstTypes.Property => x.type === 'Property');
	let prop = properties.find((x) => (x.key as AstTypes.Identifier).name === options.name);
	let propertyValue: T;

	if (prop) {
		propertyValue = prop.value as T;
	} else {
		let isShorthand = false;
		if (options.fallback.type === 'Identifier') {
			const identifier: AstTypes.Identifier = options.fallback;
			isShorthand = identifier.name === options.name;
		}

		propertyValue = options.fallback;
		prop = {
			type: 'Property',
			shorthand: isShorthand,
			key: {
				type: 'Identifier',
				name: options.name
			},
			value: propertyValue,
			kind: 'init',
			computed: false,
			method: false
		};

		node.properties.push(prop);
	}

	return propertyValue;
}

export function overrideProperty<T extends AstTypes.Expression>(
	node: AstTypes.ObjectExpression,
	options: {
		name: string;
		value: T;
	}
): T {
	const properties = node.properties.filter((x): x is AstTypes.Property => x.type === 'Property');
	const prop = properties.find((x) => (x.key as AstTypes.Identifier).name === options.name);

	if (!prop) {
		return property(node, {
			name: options.name,
			fallback: options.value
		});
	}

	prop.value = options.value;

	return options.value;
}

export function overrideProperties<T extends AstTypes.Expression>(
	node: AstTypes.ObjectExpression,
	options: {
		properties: Record<string, T | undefined>;
	}
): void {
	for (const [prop, value] of Object.entries(options.properties)) {
		if (value === undefined) continue;
		overrideProperty(node, { name: prop, value });
	}
}

export function addProperties<T extends AstTypes.Expression>(
	node: AstTypes.ObjectExpression,
	options: {
		properties: Record<string, T | undefined>;
	}
): void {
	for (const [prop, value] of Object.entries(options.properties)) {
		if (value === undefined) continue;
		property(node, {
			name: prop,
			fallback: value
		});
	}
}

export function removeProperty(
	node: AstTypes.ObjectExpression,
	options: {
		name: string;
	}
): void {
	const properties = node.properties.filter((x): x is AstTypes.Property => x.type === 'Property');
	const propIdx = properties.findIndex((x) => (x.key as AstTypes.Identifier).name === options.name);

	if (propIdx !== -1) {
		node.properties.splice(propIdx, 1);
	}
}

export function create<T extends AstTypes.Expression>(
	properties: Record<string, T | undefined>
): AstTypes.ObjectExpression {
	const objExpression = createEmpty();

	for (const [prop, value] of Object.entries(properties)) {
		if (value === undefined) continue;
		property(objExpression, {
			name: prop,
			fallback: value
		});
	}

	return objExpression;
}

type ObjectPrimitiveValues = string | number | boolean | undefined;
type ObjectValues = ObjectPrimitiveValues | ObjectMap | ObjectValues[];
type ObjectMap = { [property: string]: ObjectValues };

// todo: potentially make this the default `create` method in the future
export function createFromPrimitives(properties: ObjectMap): AstTypes.ObjectExpression {
	const objExpression = createEmpty();
	const getExpression = (value: ObjectValues) => {
		let expression: Expression;
		if (Array.isArray(value)) {
			expression = array.create();
			for (const v of value) {
				array.append(expression, getExpression(v));
			}
		} else if (typeof value === 'object' && value !== null) {
			expression = createFromPrimitives(value);
		} else {
			expression = common.createLiteral({ value: value ?? null });
		}
		return expression;
	};

	for (const [prop, value] of Object.entries(properties)) {
		if (value === undefined) continue;

		property(objExpression, {
			name: prop,
			fallback: getExpression(value)
		});
	}

	return objExpression;
}

export function createEmpty(): AstTypes.ObjectExpression {
	const objectExpression: AstTypes.ObjectExpression = {
		type: 'ObjectExpression',
		properties: []
	};
	return objectExpression;
}
