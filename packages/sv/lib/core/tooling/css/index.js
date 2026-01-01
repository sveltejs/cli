/** @typedef {import("../index.ts").SvelteAst.CSS.StyleSheet} StyleSheet */
/** @typedef {import("../index.ts").SvelteAst.CSS.Rule} Rule */
/** @typedef {import("../index.ts").SvelteAst.CSS.Declaration} Declaration */
/** @typedef {import("../index.ts").SvelteAst.CSS.Atrule} Atrule */

/**
 * @param {StyleSheet} node
 * @param {{ selector: string }} options
 * @returns {Rule}
 */
export function addRule(node, options) {
	// we do not check for existing rules here, as the selector AST from svelte is really complex
	const rules = node.children.filter((x) => x.type === 'Rule');
	let rule = rules.find((x) => {
		const selector = x.prelude.children[0].children[0].selectors[0];
		return selector.type === 'ClassSelector' && selector.name === options.selector;
	});

	if (!rule) {
		rule = {
			type: 'Rule',
			prelude: {
				type: 'SelectorList',
				children: [
					{
						type: 'ComplexSelector',
						children: [
							{
								type: 'RelativeSelector',
								selectors: [
									{
										type: 'ClassSelector',
										name: options.selector,
										start: 0,
										end: 0
									}
								],
								combinator: null,
								start: 0,
								end: 0
							}
						],
						start: 0,
						end: 0
					}
				],
				start: 0,
				end: 0
			},
			block: { type: 'Block', children: [], start: 0, end: 0 },
			start: 0,
			end: 0
		};
		node.children.push(rule);
	}

	return rule;
}

/**
 * @param {Rule} node
 * @param {{ property: string; value: string }} options
 */
export function addDeclaration(node, options) {
	const declarations = node.block.children.filter((x) => x.type === 'Declaration');
	let declaration = declarations.find((x) => x.property === options.property);

	if (!declaration) {
		declaration = {
			type: 'Declaration',
			property: options.property,
			value: options.value,
			start: 0,
			end: 0
		};
		node.block.children.push(declaration);
	} else {
		declaration.value = options.value;
	}
}

/**
 * @param {StyleSheet} node
 * @param {{ imports: string[] }} options
 */
export function addImports(node, options) {
	let lastImportIndex = -1;

	// Find the last existing @import to insert after it
	for (let i = 0; i < node.children.length; i++) {
		const child = node.children[i];
		if (child.type === 'Atrule' && child.name === 'import') {
			lastImportIndex = i;
		}
	}

	for (const param of options.imports) {
		const found = node.children.find(
			(x) => x.type === 'Atrule' && x.name === 'import' && x.prelude === param
		);

		if (found) continue;

		/** @type {Atrule} */
		const atRule = {
			type: 'Atrule',
			name: 'import',
			prelude: param,
			block: null,
			start: 0,
			end: 0
		};

		if (lastImportIndex >= 0) {
			// Insert after the last @import
			lastImportIndex++;
			node.children.splice(lastImportIndex, 0, atRule);
		} else {
			// No existing imports, prepend at the start
			node.children.unshift(atRule);
			lastImportIndex = 0;
		}
	}
}

/**
 * @param {StyleSheet} node
 * @param {{ name: string; params: string; append: boolean }} options
 * @returns {Atrule}
 */
export function addAtRule(node, options) {
	const atRules = node.children.filter((x) => x.type === 'Atrule');
	let atRule = atRules.find((x) => x.name === options.name && x.prelude === options.params);

	if (atRule) {
		return atRule;
	}

	atRule = {
		type: 'Atrule',
		name: options.name,
		prelude: options.params,
		block: null,
		start: 0,
		end: 0
	};

	if (!options.append) {
		node.children.unshift(atRule);
	} else {
		node.children.push(atRule);
	}

	return atRule;
}
