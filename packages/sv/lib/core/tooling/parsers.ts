import * as utils from './index.ts';

type ParseBase = {
	source: string;
	generateCode(): string;
};

export function parseScript(source: string): {
	ast: utils.AstTypes.Program;
	comments: utils.Comments;
} & ParseBase {
	const { ast, comments } = utils.parseScript(source);
	const generateCode = () => utils.serializeScript(ast, comments, source);

	return { ast, comments, source, generateCode };
}

export function parseCss(source: string): { ast: utils.SvelteAst.CSS.StyleSheet } & ParseBase {
	const ast = utils.parseCss(source);
	const generateCode = () => utils.serializeCss(ast);

	return { ast, source, generateCode };
}

export function parseHtml(source: string): { ast: utils.HtmlDocument } & ParseBase {
	const ast = utils.parseHtml(source);
	const generateCode = () => utils.serializeHtml(ast);

	return { ast, source, generateCode };
}

export function parseJson(source: string): { data: any } & ParseBase {
	if (!source) source = '{}';
	const data = utils.parseJson(source);
	const generateCode = () => utils.serializeJson(source, data);

	return { data, source, generateCode };
}

export function parseYaml(
	source: string
): { data: ReturnType<typeof utils.parseYaml> } & ParseBase {
	if (!source) source = '';
	const data = utils.parseYaml(source);
	const generateCode = () => utils.serializeYaml(data);

	return { data, source, generateCode };
}

export function parseSvelte(source: string): { ast: utils.SvelteAst.Root } & ParseBase {
	const ast = utils.parseSvelte(source);
	const generateCode = () => utils.serializeSvelte(ast);

	return {
		ast,
		source,
		generateCode
	};
}
