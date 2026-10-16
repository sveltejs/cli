import type { AstTypes } from '../index.ts';
import * as array from './array.ts';
import * as common from './common.ts';

type ObjectPrimitiveValues = string | number | boolean | undefined | null;
type ObjectValues = ObjectPrimitiveValues | Record<string, any> | ObjectValues[];
type ObjectMap = Record<string, ObjectValues | AstTypes.Expression>;

/** Returns a property's statically known name, excluding dynamic computed keys. */
export function propertyName(property: AstTypes.Property): string | undefined {
	if (property.key.type === 'Identifier') {
		return property.computed ? undefined : property.key.name;
	}
	if (property.key.type === 'Literal' && typeof property.key.value === 'string') {
		return property.key.value;
	}
}

/** Finds a statically named property without creating it. */
export function findProperty(
	node: AstTypes.ObjectExpression,
	options: { name: string }
): AstTypes.Property | undefined {
	return node.properties.find(
		(property): property is AstTypes.Property =>
			property.type === 'Property' && propertyName(property) === options.name
	);
}

/** Removes a statically named property. Returns whether it existed. */
export function removeProperty(
	node: AstTypes.ObjectExpression,
	options: { name: string }
): boolean {
	const property = findProperty(node, options);
	if (!property) return false;
	node.properties.splice(node.properties.indexOf(property), 1);
	return true;
}

// Used to disambiguate user-supplied objects (which may have a `type` property)
// from actual AST Expression nodes when populating an ObjectExpression.
const AST_EXPRESSION_TYPES = new Set([
	'ArrayExpression',
	'ArrowFunctionExpression',
	'AssignmentExpression',
	'AwaitExpression',
	'BinaryExpression',
	'CallExpression',
	'ChainExpression',
	'ClassExpression',
	'ConditionalExpression',
	'FunctionExpression',
	'Identifier',
	'ImportExpression',
	'Literal',
	'LogicalExpression',
	'MemberExpression',
	'MetaProperty',
	'NewExpression',
	'ObjectExpression',
	'SequenceExpression',
	'TaggedTemplateExpression',
	'TemplateLiteral',
	'ThisExpression',
	'UnaryExpression',
	'UpdateExpression',
	'YieldExpression',
	'TSAsExpression',
	'TSInstantiationExpression',
	'TSNonNullExpression',
	'TSSatisfiesExpression',
	'TSTypeAssertion'
]);

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
	let prop = findProperty(node, options);

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
	const prop = findProperty(node, options);

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
			// only treat as an AST node if `type` matches a known AST expression type,
			// so plain objects like `{ type: 'foo' }` are still serialized as data
			if (typeof value.type === 'string' && AST_EXPRESSION_TYPES.has(value.type)) {
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
			const existingProperty = findProperty(options.objectExpression, { name: prop });
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
