import { kit, type AstTypes, type Comments } from '../../../../tooling/js/index.ts';

export function run(ast: AstTypes.Program, comments: Comments): void {
	kit.addHooksHandle(ast, {
		language: 'ts',
		newHandleName: 'handleFoo',
		handleContent: 'i18n.handle()',
		comments
	});
}
