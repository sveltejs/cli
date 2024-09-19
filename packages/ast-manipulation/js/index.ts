import * as ArrayUtils from './array.ts';
import * as ObjectUtils from './object.ts';
import * as CommonUtils from './common.ts';
import * as FunctionUtils from './function.ts';
import * as ImportUtils from './imports.ts';
import * as VariableUtils from './variables.ts';
import * as ExportUtils from './exports.ts';
import type { AstTypes } from '@svelte-cli/ast-tooling';

export type JsAstEditor = {
	ast: AstTypes.Program;
	source: string;
	common: typeof CommonUtils;
	array: typeof ArrayUtils;
	object: typeof ObjectUtils;
	functions: typeof FunctionUtils;
	imports: typeof ImportUtils;
	variables: typeof VariableUtils;
	exports: typeof ExportUtils;
};

export function getJsAstEditor(ast: AstTypes.Program, source: string): JsAstEditor {
	const astEditor: JsAstEditor = {
		ast,
		source,
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
