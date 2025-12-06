import { addImports, type CssAst } from '@sveltejs/cli-core/css';

export function run(ast: CssAst): void {
	addImports(ast, {
		imports: ["'lib/path/file.css'"]
	});
}
