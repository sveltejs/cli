/** @import { AstTypes } from '../index.js' */
import * as array from './array.js';
import * as common from './common.js';

/**
 * @typedef {string | number | boolean | undefined | null} ObjectPrimitiveValues
 * @typedef {ObjectPrimitiveValues | Record<string, any> | ObjectValues[]} ObjectValues
 * @typedef {Record<string, ObjectValues | AstTypes.Expression>} ObjectMap
 */

/**
 * @template {AstTypes.Expression | AstTypes.Identifier} T
 * @param {AstTypes.ObjectExpression} node
 * @param {{ name: string; fallback: T }} options
 * @returns {T}
 */
export function property(node, options) {
	return /** @type {T} */ (propertyNode(node, options).value);
}

/**
 * @template {AstTypes.Expression | AstTypes.Identifier} T
 * @param {AstTypes.ObjectExpression} node
 * @param {{ name: string; fallback: T }} options
 * @returns {AstTypes.Property}
 */
export function propertyNode(node, options) {
	const properties = node.properties.filter(
		/** @returns {x is AstTypes.Property} */
		(x) => x.type === 'Property'
	);
	let prop = properties.find(
		(x) => /** @type {AstTypes.Identifier} */ (x.key).name === options.name
	);

	if (!prop) {
		let isShorthand = false;
		if (options.fallback.type === 'Identifier') {
			/** @type {AstTypes.Identifier} */
			const identifier = options.fallback;
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

	return /** @type {AstTypes.Property} */ (prop);
}

/**
 * @param {ObjectMap} properties
 * @returns {AstTypes.ObjectExpression}
 */
export function create(properties) {
	/** @type {AstTypes.ObjectExpression} */
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
 * @param {AstTypes.ObjectExpression} objectExpression
 * @param {ObjectMap} properties
 * @returns {void}
 */
export function overrideProperties(objectExpression, properties) {
	populateObjectExpression({
		objectExpression,
		properties,
		override: true
	});
}

/**
 * @template {AstTypes.Expression} T
 * @param {AstTypes.ObjectExpression} node
 * @param {{ name: string; value: T }} options
 * @returns {T}
 */
function overrideProperty(node, options) {
	const properties = node.properties.filter(
		/** @returns {x is AstTypes.Property} */
		(x) => x.type === 'Property'
	);
	const prop = properties.find(
		(x) => /** @type {AstTypes.Identifier} */ (x.key).name === options.name
	);

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
 * @param {{ objectExpression: AstTypes.ObjectExpression; properties: ObjectMap; override: boolean }} options
 * @returns {AstTypes.ObjectExpression}
 */
function populateObjectExpression(options) {
	/**
	 * @param {any} value
	 * @param {AstTypes.ObjectExpression} [existingExpression]
	 * @returns {AstTypes.Expression}
	 */
	const getExpression = (value, existingExpression) => {
		/** @type {AstTypes.Expression} */
		let expression;
		if (Array.isArray(value)) {
			expression = array.create();
			for (const v of value) {
				array.append(expression, getExpression(v));
			}
		} else if (typeof value === 'object' && value !== null) {
			// if the type property is defined, we assume it's an AST type
			if (value.type !== undefined) {
				expression = /** @type {AstTypes.Expression} */ (value);
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
				/** @returns {x is AstTypes.Property} */
				(x) => x.type === 'Property'
			);
			const existingProperty = existingProperties.find(
				(x) => /** @type {AstTypes.Identifier} */ (x.key).name === prop
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
