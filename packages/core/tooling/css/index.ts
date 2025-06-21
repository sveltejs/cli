import { Declaration, Rule, AtRule, Comment, type CssAst, type CssChildNode } from '../index.ts';

export type { CssAst };

export function addRule(node: CssAst, options: { selector: string }): Rule {
	const rules = node.nodes.filter((x): x is Rule => x.type === 'rule');
	let rule = rules.find((x) => x.selector === options.selector);

	if (!rule) {
		rule = new Rule();
		rule.selector = options.selector;
		node.nodes.push(rule);
	}

	return rule;
}

export function addDeclaration(
	node: Rule | CssAst,
	options: { property: string; value: string }
): void {
	const declarations = node.nodes.filter((x): x is Declaration => x.type === 'decl');
	let declaration = declarations.find((x) => x.prop === options.property);

	if (!declaration) {
		declaration = new Declaration({ prop: options.property, value: options.value });
		node.append(declaration);
	} else {
		declaration.value = options.value;
	}
}

export function addImports(node: Rule | CssAst, options: { imports: string[] }): CssChildNode[] {
	let prev: CssChildNode | undefined;
	const nodes = options.imports.map((param) => {
		const found = node.nodes.find(
			(x) => x.type === 'atrule' && x.name === 'import' && x.params === param
		);

		if (found) return (prev = found);

		const rule = new AtRule({ name: 'import', params: param });
		if (prev) node.insertAfter(prev, rule);
		else node.prepend(rule);

		return (prev = rule);
	});

	return nodes;
}

export function addAtRule(
	node: CssAst,
	options: { name: string; params: string; append: boolean }
): AtRule {
	const atRules = node.nodes.filter((x): x is AtRule => x.type === 'atrule');
	let atRule = atRules.find((x) => x.name === options.name && x.params === options.params);

	if (atRule) {
		return atRule;
	}

	atRule = new AtRule({ name: options.name, params: options.params });
	if (!options.append) {
		node.prepend(atRule);
	} else {
		node.append(atRule);
	}

	return atRule;
}

export function addComment(node: CssAst, options: { value: string }): void {
	const comment = new Comment({ text: options.value });
	node.append(comment);
}
