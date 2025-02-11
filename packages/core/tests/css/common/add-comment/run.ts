import { addComment } from '@sveltejs/cli-core/css';
import type { CssAst } from '@sveltejs/ast-tooling';

export function run(ast: CssAst): void {
	addComment(ast, 'foo comment');
}
