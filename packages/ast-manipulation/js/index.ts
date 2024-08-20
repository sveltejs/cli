import * as ArrayUtils from './array';
import * as ObjectUtils from './object';
import * as CommonUtils from './common';
import * as FunctionUtils from './function';
import * as ImportUtils from './imports';
import * as VariableUtils from './variables';
import * as ExportUtils from './exports';
import type { AstTypes } from '@svelte-cli/ast-tooling';

export type JsAstEditor = {
	ast: AstTypes.Program;
	common: typeof CommonUtils;
	array: typeof ArrayUtils;
	object: typeof ObjectUtils;
	functions: typeof FunctionUtils;
	imports: typeof ImportUtils;
	variables: typeof VariableUtils;
	exports: typeof ExportUtils;
};

export function getJsAstEditor(ast: AstTypes.Program): JsAstEditor {
	const astEditor: JsAstEditor = {
		ast,
		object: ObjectUtils,
		common: CommonUtils,
		array: ArrayUtils,
		functions: FunctionUtils,
		imports: ImportUtils,
		variables: VariableUtils,
		exports: ExportUtils
	};

	return astEditor;
}
