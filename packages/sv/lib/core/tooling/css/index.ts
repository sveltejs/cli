import type { SvelteAst } from '../index.ts';

export function addRule(
	node: SvelteAst.CSS.StyleSheetRules,
	options: { selector: string }
): SvelteAst.CSS.Rule {
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

export function addDeclaration(
	node: SvelteAst.CSS.Rule,
	options: { property: string; value: string }
): void {
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

export function addImports(
	node: SvelteAst.CSS.StyleSheetRules,
	options: { imports: string[] }
): void {
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

		const atRule: SvelteAst.CSS.Atrule = {
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

export function addAtRule(
	node: SvelteAst.CSS.StyleSheetRules,
	options: { name: string; params: string; append: boolean }
): SvelteAst.CSS.Atrule {
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
