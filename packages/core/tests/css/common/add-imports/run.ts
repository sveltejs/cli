import { addImports } from '@sveltejs/cli-core/css';
import type { CssAst } from '@sveltejs/ast-tooling';

export function run(ast: CssAst): void {
	addImports(ast, ["'lib/path/file.css'"]);
}
