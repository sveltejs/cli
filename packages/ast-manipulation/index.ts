import { getCssAstEditor, type CssAstEditor } from './css/index.ts';
import { getHtmlAstEditor, type HtmlAstEditor } from './html/index.ts';
import { getJsAstEditor, type JsAstEditor } from './js/index.ts';

export {
	getCssAstEditor,
	getHtmlAstEditor,
	getJsAstEditor,
	type CssAstEditor,
	type HtmlAstEditor,
	type JsAstEditor
};

export type SvelteAstEditor = {
	js: JsAstEditor;
	html: HtmlAstEditor;
	css: CssAstEditor;
};
