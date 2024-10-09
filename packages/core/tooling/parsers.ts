import * as tools from '@svelte-cli/ast-tooling';
import MagicString from 'magic-string';

type ParseBase = {
	source: string;
	generateCode(): string;
};

export function parseScript(source: string): { ast: tools.AstTypes.Program } & ParseBase {
	const ast = tools.parseScript(source);
	const generateCode = () => tools.serializeScript(ast);

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
	const data = tools.parseJson(source);
	const generateCode = () => tools.serializeJson(source, data);

	return { data, source, generateCode };
}

// sourced from Svelte: https://github.com/sveltejs/svelte/blob/0d3d5a2a85c0f9eccb2c8dbbecc0532ec918b157/packages/svelte/src/compiler/preprocess/index.js#L253-L256
const regexStyleTags =
	/<!--[^]*?-->|<style((?:\s+[^=>'"/\s]+=(?:"[^"]*"|'[^']*'|[^>\s]+)|\s+[^=>'"/\s]+)*\s*)(?:\/>|>([\S\s]*?)<\/style>)/g;
const regexScriptTags =
	/<!--[^]*?-->|<script((?:\s+[^=>'"/\s]+=(?:"[^"]*"|'[^']*'|[^>\s]+)|\s+[^=>'"/\s]+)*\s*)(?:\/>|>([\S\s]*?)<\/script>)/g;

type SvelteGenerator = (code: {
	script?: string;
	css?: string;
	template?: string;
	typescript?: boolean;
}) => string;
export function parseSvelte(source: string): {
	script: ReturnType<typeof parseScript>;
	css: ReturnType<typeof parseCss>;
	template: ReturnType<typeof parseHtml>;
	generateCode: SvelteGenerator;
} {
	// `xTag` captures the whole tag block (ex: <script>...</script>)
	// `xSource` is just the contents within the tags
	const [scriptTag = '', , scriptSource = ''] = regexScriptTags.exec(source) ?? [];
	const [styleTag = '', , cssSource = ''] = regexStyleTags.exec(source) ?? [];
	const templateSource = source.replace(scriptTag, '').replace(styleTag, '');

	const script = parseScript(scriptSource);
	const css = parseCss(cssSource);
	const template = parseHtml(templateSource);

	const generateCode: SvelteGenerator = (code) => {
		const ms = new MagicString(source);
		// TODO: this is imperfect and needs adjustments
		if (code.script !== undefined) {
			if (scriptSource.length === 0) {
				const ts = code.typescript ? ' lang="ts"' : '';
				const indented = code.script.split('\n').join('\n\t');
				const script = `<script${ts}>\n\t${indented}\n</script>\n\n`;
				ms.appendLeft(0, script);
			} else {
				const { start, end } = locations(source, scriptSource);
				ms.overwrite(start, end, code.script);
			}
		}
		if (code.css !== undefined) {
			if (cssSource.length === 0) {
				const indented = code.css.split('\n').join('\n\t');
				const style = `\n<style>\n\t${indented}\n</style>\n`;
				ms.append(style);
			} else {
				const { start, end } = locations(source, cssSource);
				ms.overwrite(start, end, code.css);
			}
		}
		if (code.template !== undefined) {
			if (templateSource.length === 0) {
				ms.appendLeft(0, code.template);
			} else {
				const { start, end } = locations(source, templateSource);
				ms.overwrite(start, end, code.template);
			}
		}
		return ms.toString();
	};

	return {
		script: { ...script, source: scriptSource },
		css: { ...css, source: scriptSource },
		template: { ...template, source: templateSource },
		generateCode
	};
}

function locations(source: string, search: string) {
	const start = source.indexOf(search);
	const end = start + search.length;
	return { start, end };
}
