import { addImports } from '../../../../tooling/css/index.ts';
import { type SvelteAst } from '../../../../tooling/index.ts';

export function run(ast: SvelteAst.CSS.StyleSheet): void {
	addImports(ast, {
		imports: ["'lib/path/file.css'"]
	});
}
