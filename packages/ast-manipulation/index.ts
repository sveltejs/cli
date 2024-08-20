import { getCssAstEditor, type CssAstEditor } from './css/index';
import { getHtmlAstEditor, type HtmlAstEditor } from './html/index';
import { getJsAstEditor, type JsAstEditor } from './js/index';

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
