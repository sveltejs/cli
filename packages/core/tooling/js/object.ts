import type { AstTypes } from '../index.ts';
import * as array from './array.ts';
import * as common from './common.ts';

type TransformProperty = (property: AstTypes.Property) => AstTypes.Property;

export function property<T extends AstTypes.Expression | AstTypes.Identifier>(
	node: AstTypes.ObjectExpression,
	options: {
		name: string;
		fallback: T;
		transform?: TransformProperty;
	}
): T {
	const properties = node.properties.filter((x): x is AstTypes.Property => x.type === 'Property');
	let prop = properties.find((x) => (x.key as AstTypes.Identifier).name === options.name);

	if (prop) {
		if (options.transform) {
			prop = options.transform(prop);
		}
	} else {
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

		if (options.transform) {
			prop = options.transform(prop);
		}

		node.properties.push(prop);
	}

	return prop.value as T;
}

type OverridePropertyOptions<T extends AstTypes.Expression> = {
	name: string;
	value: T;
	transform?: TransformProperty;
};
function overrideProperty<T extends AstTypes.Expression>(
	node: AstTypes.ObjectExpression,
	options: OverridePropertyOptions<T>
): T {
	const properties = node.properties.filter((x): x is AstTypes.Property => x.type === 'Property');
	let prop = properties.find((x) => (x.key as AstTypes.Identifier).name === options.name);

	if (!prop) {
		return property(node, {
			name: options.name,
			fallback: options.value,
			transform: options.transform
		});
	}

	prop.value = options.value;

	if (options.transform) {
		prop = options.transform(prop);
	}

	return options.value;
}

type ObjectPrimitiveValues = string | number | boolean | undefined | null;
type ObjectValues = ObjectPrimitiveValues | Record<string, any> | ObjectValues[];
type ObjectMap = Record<string, ObjectValues | AstTypes.Expression>;

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
	properties: ObjectMap,
	transform?: TransformProperty
): void {
	populateObjectExpression({
		objectExpression,
		properties,
		override: true,
		transform
	});
}

function populateObjectExpression(options: {
	objectExpression: AstTypes.ObjectExpression;
	properties: ObjectMap;
	override: boolean;
	transform?: TransformProperty;
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
						override: options.override,
						transform: options.transform
					});
				} else {
					expression = populateObjectExpression({
						objectExpression: create({}),
						properties: value,
						override: options.override,
						transform: options.transform
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
				value: getExpression(value, existingExpression),
				transform: options.transform
			});
		} else {
			property(options.objectExpression, {
				name: prop,
				fallback: getExpression(value),
				transform: options.transform
			});
		}
	}

	return options.objectExpression;
}
