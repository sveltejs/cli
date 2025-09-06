import type { AstTypes } from '../index.ts';
import * as array from './array.ts';
import * as common from './common.ts';

export function property<T extends AstTypes.Expression | AstTypes.Identifier>(
	node: AstTypes.ObjectExpression,
	options: {
		name: string;
		fallback: T;
		transform?: (property: AstTypes.Property) => AstTypes.Property;
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
	value: T;
	transform?: (property: AstTypes.Property) => AstTypes.Property;
} & ({ name: string; path?: never } | { name?: never; path: string[] });
export function overrideProperty<T extends AstTypes.Expression>(
	node: AstTypes.ObjectExpression,
	options: OverridePropertyOptions<T>
): T {
	if (options.path) {
		return ensureNestedProperty(node, options);
	}

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

export function overrideProperties<T extends AstTypes.Expression>(
	node: AstTypes.ObjectExpression,
	options: Array<OverridePropertyOptions<T>>
): void {
	for (const option of options) {
		overrideProperty(node, option);
	}
}

// internal helper function
function ensureNestedProperty<T extends AstTypes.Expression>(
	node: AstTypes.ObjectExpression,
	options: {
		path: string[];
		value: T;
		transform?: (property: AstTypes.Property) => AstTypes.Property;
	}
): T {
	let current = node;

	// Navigate/create the path, stopping at the last level
	for (let i = 0; i < options.path.length - 1; i++) {
		const pathSegment = options.path[i];

		let nextNode = property(current, {
			name: pathSegment,
			fallback: create({})
		});

		// Ensure the next level exists as an ObjectExpression
		if (nextNode.type !== 'ObjectExpression') {
			nextNode = create({});
			overrideProperty(current, {
				name: pathSegment,
				value: nextNode
			});
		}

		current = nextNode;
	}

	// Set the final property
	const finalPropertyName = options.path[options.path.length - 1];
	return overrideProperty(current, {
		name: finalPropertyName,
		value: options.value,
		transform: options.transform
	});
}

type ObjectPrimitiveValues = string | number | boolean | undefined | null;
type ObjectValues = ObjectPrimitiveValues | Record<string, any> | ObjectValues[];
type ObjectMap = Record<string, ObjectValues | AstTypes.Expression>;

export function create(properties: ObjectMap): AstTypes.ObjectExpression {
	const objExpression: AstTypes.ObjectExpression = {
		type: 'ObjectExpression',
		properties: []
	};

	const getExpression = (value: any): AstTypes.Expression => {
		let expression: AstTypes.Expression;
		if (Array.isArray(value)) {
			expression = array.create();
			for (const v of value) {
				array.append(expression, getExpression(v));
			}
		} else if (typeof value === 'object' && value !== null) {
			// if the type property is defined, we assume it's an AST type
			expression = value.type !== undefined ? (value as AstTypes.Expression) : create(value);
		} else {
			expression = common.createLiteral(value);
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
