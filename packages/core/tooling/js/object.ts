import type { AstTypes } from '../index.ts';
import * as array from './array.ts';
import * as common from './common.ts';

type ObjectPrimitiveValues = string | number | boolean | undefined | null;
type ObjectValues = ObjectPrimitiveValues | Record<string, any> | ObjectValues[];
type ObjectMap = Record<string, ObjectValues | AstTypes.Expression>;

export function property<T extends AstTypes.Expression | AstTypes.Identifier>(
	node: AstTypes.ObjectExpression,
	options: { name: string; fallback: T }
): T {
	return propertyNode(node, options).value as T;
}

export function propertyNode<T extends AstTypes.Expression | AstTypes.Identifier>(
	node: AstTypes.ObjectExpression,
	options: { name: string; fallback: T }
): AstTypes.Property {
	const properties = node.properties.filter((x): x is AstTypes.Property => x.type === 'Property');
	let prop = properties.find((x) => (x.key as AstTypes.Identifier).name === options.name);

	if (!prop) {
		let isShorthand = false;
		if (options.fallback.type === 'Identifier') {
			const identifier: AstTypes.Identifier = options.fallback;
			isShorthand = identifier.name === options.name;
		}

		prop = {
			type: 'Property',
			shorthand: isShorthand,
			key: {
				type: 'Identifier',
				name: options.name
			},
			value: options.fallback,
			kind: 'init',
			computed: false,
			method: false
		};

		node.properties.push(prop);
	}

	return prop as AstTypes.Property;
}

export function create(properties: ObjectMap): AstTypes.ObjectExpression {
	const objectExpression: AstTypes.ObjectExpression = {
		type: 'ObjectExpression',
		properties: []
	};

	return populateObjectExpression({
		objectExpression,
		properties,
		override: false
	});
}

export function overrideProperties(
	objectExpression: AstTypes.ObjectExpression,
	properties: ObjectMap
): void {
	populateObjectExpression({
		objectExpression,
		properties,
		override: true
	});
}

function overrideProperty<T extends AstTypes.Expression>(
	node: AstTypes.ObjectExpression,
	options: { name: string; value: T }
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

function populateObjectExpression(options: {
	objectExpression: AstTypes.ObjectExpression;
	properties: ObjectMap;
	override: boolean;
}): AstTypes.ObjectExpression {
	const getExpression = (
		value: any,
		existingExpression?: AstTypes.ObjectExpression
	): AstTypes.Expression => {
		let expression: AstTypes.Expression;
		if (Array.isArray(value)) {
			expression = array.create();
			for (const v of value) {
				array.append(expression, getExpression(v));
			}
		} else if (typeof value === 'object' && value !== null) {
			// if the type property is defined, we assume it's an AST type
			if (value.type !== undefined) {
				expression = value as AstTypes.Expression;
			} else {
				// If we're overriding and there's an existing object expression, merge with it
				if (
					options.override &&
					existingExpression &&
					existingExpression.type === 'ObjectExpression'
				) {
					expression = populateObjectExpression({
						objectExpression: existingExpression,
						properties: value,
						override: options.override
					});
				} else {
					expression = populateObjectExpression({
						objectExpression: create({}),
						properties: value,
						override: options.override
					});
				}
			}
		} else {
			expression = common.createLiteral(value);
		}
		return expression;
	};

	for (const [prop, value] of Object.entries(options.properties)) {
		if (value === undefined) continue;

		if (options.override) {
			// Get existing property to potentially merge with
			const existingProperties = options.objectExpression.properties.filter(
				(x): x is AstTypes.Property => x.type === 'Property'
			);
			const existingProperty = existingProperties.find(
				(x) => (x.key as AstTypes.Identifier).name === prop
			);
			const existingExpression =
				existingProperty?.value.type === 'ObjectExpression' ? existingProperty.value : undefined;

			overrideProperty(options.objectExpression, {
				name: prop,
				value: getExpression(value, existingExpression)
			});
		} else {
			property(options.objectExpression, {
				name: prop,
				fallback: getExpression(value)
			});
		}
	}

	return options.objectExpression;
}
