import type { AstTypes, Comments } from '../../../../tooling/index.ts';
import { kit } from '../../../../tooling/js/index.ts';

export function run(ast: AstTypes.Program, comments: Comments): void {
	kit.addHooksHandle(ast, {
		language: 'ts',
		newHandleName: 'handleFoo',
		handleContent: 'i18n.handle()',
		comments
	});
}
