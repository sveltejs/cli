import {
	Declaration,
	Rule,
	AtRule,
	Comment,
	type CssAst,
	type CssChildNode
} from '@sveltejs/ast-tooling';

export type { CssAst };

export function addRule(ast: CssAst, selector: string): Rule {
	const rules = ast.nodes.filter((x): x is Rule => x.type === 'rule');
	let rule = rules.find((x) => x.selector === selector);

	if (!rule) {
		rule = new Rule();
		rule.selector = selector;
		ast.nodes.push(rule);
	}

	return rule;
}

export function addDeclaration(ast: Rule | CssAst, property: string, value: string): void {
	const declarations = ast.nodes.filter((x): x is Declaration => x.type === 'decl');
	let declaration = declarations.find((x) => x.prop === property);

	if (!declaration) {
		declaration = new Declaration({ prop: property, value });
		ast.append(declaration);
	} else {
		declaration.value = value;
	}
}

export function addImports(ast: Rule | CssAst, imports: string[]): CssChildNode[] {
	let prev: CssChildNode | undefined;
	const nodes = imports.map((param) => {
		const found = ast.nodes.find(
			(x) => x.type === 'atrule' && x.name === 'import' && x.params === param
		);

		if (found) return (prev = found);

		const rule = new AtRule({ name: 'import', params: param });
		if (prev) ast.insertAfter(prev, rule);
		else ast.prepend(rule);

		return (prev = rule);
	});

	return nodes;
}

export function addAtRule(ast: CssAst, name: string, params: string, append = false): AtRule {
	const atRules = ast.nodes.filter((x): x is AtRule => x.type === 'atrule');
	let atRule = atRules.find((x) => x.name === name && x.params === params);

	if (atRule) {
		return atRule;
	}

	atRule = new AtRule({ name, params });
	if (!append) {
		ast.prepend(atRule);
	} else {
		ast.append(atRule);
	}

	return atRule;
}

export function addComment(ast: CssAst, commentValue: string): void {
	const comment = new Comment({ text: commentValue });
	ast.append(comment);
}
