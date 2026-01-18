import * as array from './array.js';
import * as common from './common.js';

/** @typedef {import("../index.ts").AstTypes} AstTypes */
/** @typedef {import("../index.ts").AstTypes.ObjectExpression} ObjectExpression */
/** @typedef {import("../index.ts").AstTypes.Expression} Expression */
/** @typedef {import("../index.ts").AstTypes.Identifier} Identifier */
/** @typedef {import("../index.ts").AstTypes.Property} Property */

/** @typedef {string | number | boolean | undefined | null} ObjectPrimitiveValues */
/** @typedef {ObjectValues[]} ObjectValuesArray */
/** @typedef {ObjectPrimitiveValues | Record<string, any> | ObjectValuesArray} ObjectValues */
/** @typedef {Record<string, ObjectValues | Expression>} ObjectMap */

/**
 * @template {Expression | Identifier} T
 * @param {ObjectExpression} node
 * @param {{ name: string; fallback: T }} options
 * @returns {T}
 */
export function property(node, options) {
	return /** @type {T} */ (propertyNode(node, options).value);
}

/**
 * @template {Expression | Identifier} T
 * @param {ObjectExpression} node
 * @param {{ name: string; fallback: T }} options
 * @returns {Property}
 */
export function propertyNode(node, options) {
	const properties = node.properties.filter((x) => x.type === 'Property');
	let prop = properties.find((x) => /** @type {Identifier} */ (x.key).name === options.name);

	if (!prop) {
		let isShorthand = false;
		if (options.fallback.type === 'Identifier') {
			/** @type {Identifier} */
			const identifier = options.fallback;
			isShorthand = identifier.name === options.name;
		}

		/** @type {Property} */
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

	return prop;
}

/**
 * @param {ObjectMap} properties
 * @returns {ObjectExpression}
 */
export function create(properties) {
	/** @type {ObjectExpression} */
	const objectExpression = {
		type: 'ObjectExpression',
		properties: []
	};

	return populateObjectExpression({
		objectExpression,
		properties,
		override: false
	});
}

/**
 * @param {ObjectExpression} objectExpression
 * @param {ObjectMap} properties
 */
export function overrideProperties(objectExpression, properties) {
	populateObjectExpression({
		objectExpression,
		properties,
		override: true
	});
}

/**
 * @template {Expression} T
 * @param {ObjectExpression} node
 * @param {{ name: string; value: T }} options
 * @returns {T}
 */
function overrideProperty(node, options) {
	const properties = node.properties.filter((x) => x.type === 'Property');
	const prop = properties.find((x) => /** @type {Identifier} */ (x.key).name === options.name);

	if (!prop) {
		return property(node, {
			name: options.name,
			fallback: options.value
		});
	}

	prop.value = options.value;

	return options.value;
}

/**
 * @param {{ objectExpression: ObjectExpression; properties: ObjectMap; override: boolean }} options
 * @returns {ObjectExpression}
 */
function populateObjectExpression(options) {
	const getExpression = (
		/** @type {any} */ value,
		/** @type {ObjectExpression | undefined} */ existingExpression
	) => {
		/** @type {Expression} */
		let expression;
		if (Array.isArray(value)) {
			expression = array.create();
			for (const v of value) {
				array.append(expression, getExpression(v, undefined));
			}
		} else if (typeof value === 'object' && value !== null) {
			// if the type property is defined, we assume it's an AST type
			if (value.type !== undefined) {
				expression = value;
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
				(x) => x.type === 'Property'
			);
			const existingProperty = existingProperties.find(
				(x) => /** @type {Identifier} */ (x.key).name === prop
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
				fallback: getExpression(value, undefined)
			});
		}
	}

	return options.objectExpression;
}
