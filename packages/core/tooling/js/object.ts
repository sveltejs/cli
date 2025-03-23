import type { AstTypes } from '../tools.ts';

export function property<T extends AstTypes.Expression | AstTypes.Identifier>(
	ast: AstTypes.ObjectExpression,
	name: string,
	fallback: T
): T {
	const objectExpression = ast;
	const properties = objectExpression.properties.filter(
		(x): x is AstTypes.Property => x.type === 'Property'
	);
	let property = properties.find((x) => (x.key as AstTypes.Identifier).name === name);
	let propertyValue: T;

	if (property) {
		propertyValue = property.value as T;
	} else {
		let isShorthand = false;
		if (fallback.type === 'Identifier') {
			const identifier: AstTypes.Identifier = fallback;
			isShorthand = identifier.name === name;
		}

		propertyValue = fallback;
		property = {
			type: 'Property',
			shorthand: isShorthand,
			key: {
				type: 'Identifier',
				name
			},
			value: propertyValue,
			kind: 'init',
			computed: false,
			method: false
		};

		objectExpression.properties.push(property);
	}

	return propertyValue;
}

export function overrideProperty<T extends AstTypes.Expression>(
	ast: AstTypes.ObjectExpression,
	name: string,
	value: T
): T {
	const objectExpression = ast;
	const properties = objectExpression.properties.filter(
		(x): x is AstTypes.Property => x.type === 'Property'
	);
	const prop = properties.find((x) => (x.key as AstTypes.Identifier).name === name);

	if (!prop) {
		return property(ast, name, value);
	}

	prop.value = value;

	return value;
}

export function overrideProperties<T extends AstTypes.Expression>(
	ast: AstTypes.ObjectExpression,
	obj: Record<string, T | undefined>
): void {
	for (const [prop, value] of Object.entries(obj)) {
		if (value === undefined) continue;
		overrideProperty(ast, prop, value);
	}
}

export function properties<T extends AstTypes.Expression>(
	ast: AstTypes.ObjectExpression,
	obj: Record<string, T | undefined>
): void {
	for (const [prop, value] of Object.entries(obj)) {
		if (value === undefined) continue;
		property(ast, prop, value);
	}
}

export function removeProperty(ast: AstTypes.ObjectExpression, property: string): void {
	const properties = ast.properties.filter((x): x is AstTypes.Property => x.type === 'Property');
	const propIdx = properties.findIndex((x) => (x.key as AstTypes.Identifier).name === property);

	if (propIdx !== -1) {
		ast.properties.splice(propIdx, 1);
	}
}

export function create<T extends AstTypes.Expression>(
	obj: Record<string, T | undefined>
): AstTypes.ObjectExpression {
	const objExpression = createEmpty();

	for (const [prop, value] of Object.entries(obj)) {
		if (value === undefined) continue;
		property(objExpression, prop, value);
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
