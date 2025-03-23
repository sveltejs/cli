import * as tools from './tools.ts';
import MagicString from 'magic-string';

type ParseBase = {
	source: string;
	generateCode(): string;
};

export function parseScript(source: string): { ast: tools.AstTypes.Program } & ParseBase {
	const ast = tools.parseScript(source);
	const generateCode = () => tools.serializeScript(ast, source);

	return { ast, source, generateCode };
}

export function parseCss(source: string): { ast: tools.CssAst } & ParseBase {
	const ast = tools.parseCss(source);
	const generateCode = () => ast.toString();

	return { ast, source, generateCode };
}

export function parseHtml(source: string): { ast: tools.HtmlDocument } & ParseBase {
	const ast = tools.parseHtml(source);
	const generateCode = () => tools.serializeHtml(ast);

	return { ast, source, generateCode };
}

export function parseJson(source: string): { data: any } & ParseBase {
	if (!source) source = '{}';
	const data = tools.parseJson(source);
	const generateCode = () => tools.serializeJson(source, data);

	return { data, source, generateCode };
}

type SvelteGenerator = (code: {
	script?: string;
	module?: string;
	css?: string;
	template?: string;
}) => string;
export function parseSvelte(
	source: string,
	options?: { typescript?: boolean }
): {
	script: ReturnType<typeof parseScript>;
	module: ReturnType<typeof parseScript>;
	css: ReturnType<typeof parseCss>;
	template: ReturnType<typeof parseHtml>;
	generateCode: SvelteGenerator;
} {
	// `xTag` captures the whole tag block (ex: <script>...</script>)
	// `xSource` is the contents within the tags
	const scripts = extractScripts(source);
	// instance block
	const { tag: scriptTag = '', src: scriptSource = '' } =
		scripts.find(({ attrs }) => !attrs.includes('module')) ?? {};
	// module block
	const { tag: moduleScriptTag = '', src: moduleSource = '' } =
		scripts.find(({ attrs }) => attrs.includes('module')) ?? {};
	// style block
	const { styleTag, cssSource } = extractStyle(source);
	// rest of the template
	// TODO: needs more testing
	const templateSource = source
		.replace(moduleScriptTag, '')
		.replace(scriptTag, '')
		.replace(styleTag, '')
		.trim();

	const script = parseScript(scriptSource);
	const module = parseScript(moduleSource);
	const css = parseCss(cssSource);
	const template = parseHtml(templateSource);

	const generateCode: SvelteGenerator = (code) => {
		const ms = new MagicString(source);
		// TODO: this is imperfect and needs adjustments
		if (code.script !== undefined) {
			if (scriptSource.length === 0) {
				const ts = options?.typescript ? ' lang="ts"' : '';
				const indented = code.script.split('\n').join('\n\t');
				const script = `<script${ts}>\n\t${indented}\n</script>\n\n`;
				ms.prepend(script);
			} else {
				const { start, end } = locations(source, scriptSource);
				const formatted = indent(code.script, ms.getIndentString());
				ms.update(start, end, formatted);
			}
		}
		if (code.module !== undefined) {
			if (moduleSource.length === 0) {
				const ts = options?.typescript ? ' lang="ts"' : '';
				const indented = code.module.split('\n').join('\n\t');
				// TODO: make a svelte 5 variant
				const module = `<script${ts} context="module">\n\t${indented}\n</script>\n\n`;
				ms.prepend(module);
			} else {
				const { start, end } = locations(source, moduleSource);
				const formatted = indent(code.module, ms.getIndentString());
				ms.update(start, end, formatted);
			}
		}
		if (code.css !== undefined) {
			if (cssSource.length === 0) {
				const indented = code.css.split('\n').join('\n\t');
				const style = `\n<style>\n\t${indented}\n</style>\n`;
				ms.append(style);
			} else {
				const { start, end } = locations(source, cssSource);
				const formatted = indent(code.css, ms.getIndentString());
				ms.update(start, end, formatted);
			}
		}
		if (code.template !== undefined) {
			if (templateSource.length === 0) {
				ms.appendLeft(0, code.template);
			} else {
				const { start, end } = locations(source, templateSource);
				ms.update(start, end, code.template);
			}
		}
		return ms.toString();
	};

	return {
		script: { ...script, source: scriptSource },
		module: { ...module, source: moduleSource },
		css: { ...css, source: cssSource },
		template: { ...template, source: templateSource },
		generateCode
	};
}

function locations(source: string, search: string): { start: number; end: number } {
	const start = source.indexOf(search);
	const end = start + search.length;
	return { start, end };
}

function indent(content: string, indent: string): string {
	const indented = indent + content.split('\n').join(`\n${indent}`);
	return `\n${indented}\n`;
}

// sourced from Svelte: https://github.com/sveltejs/svelte/blob/0d3d5a2a85c0f9eccb2c8dbbecc0532ec918b157/packages/svelte/src/compiler/preprocess/index.js#L253-L256
const regexScriptTags =
	/<!--[^]*?-->|<script((?:\s+[^=>'"/\s]+=(?:"[^"]*"|'[^']*'|[^>\s]+)|\s+[^=>'"/\s]+)*\s*)(?:\/>|>([\S\s]*?)<\/script>)/;
const regexStyleTags =
	/<!--[^]*?-->|<style((?:\s+[^=>'"/\s]+=(?:"[^"]*"|'[^']*'|[^>\s]+)|\s+[^=>'"/\s]+)*\s*)(?:\/>|>([\S\s]*?)<\/style>)/;

type Script = { tag: string; attrs: string; src: string };
function extractScripts(source: string): Script[] {
	const scripts = [];
	const [tag = '', attrs = '', src = ''] = regexScriptTags.exec(source) ?? [];
	if (tag) {
		const stripped = source.replace(tag, '');
		scripts.push({ tag, attrs, src }, ...extractScripts(stripped));
		return scripts;
	}

	return [];
}

function extractStyle(source: string) {
	const [styleTag = '', attributes = '', cssSource = ''] = regexStyleTags.exec(source) ?? [];
	return { styleTag, attributes, cssSource };
}
