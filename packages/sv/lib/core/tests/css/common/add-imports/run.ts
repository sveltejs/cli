import { addImports, type CssAst } from '../../../../tooling/css/index.ts';

export function run(ast: CssAst): void {
	addImports(ast, {
		imports: ["'lib/path/file.css'"]
	});
}
