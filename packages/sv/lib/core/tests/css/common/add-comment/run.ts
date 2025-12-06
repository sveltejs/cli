import { addComment, type CssAst } from '@sveltejs/cli-core/css';

export function run(ast: CssAst): void {
	addComment(ast, { value: 'foo comment' });
}
