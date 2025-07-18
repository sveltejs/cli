import { imports, vite, type AstTypes } from '@sveltejs/cli-core/js';

export function run(ast: AstTypes.Program): void {
	const pMiddle = 'middlePlugin';
	imports.addDefault(ast, { as: pMiddle, from: 'middle-plugin' });
	vite.addPlugin(ast, { code: `${pMiddle}()` });

	const pLast = 'lastPlugin';
	imports.addDefault(ast, { as: pLast, from: 'last-plugin' });
	[...Array(10)].forEach((_, i) => {
		vite.addPlugin(ast, { code: `${pLast}(${i})` });
	});

	const pFirst = 'firstPlugin';
	imports.addNamed(ast, { imports: { [pFirst]: pFirst }, from: 'first-plugin' });
	vite.addPlugin(ast, { code: `${pFirst}()`, mode: 'prepend' });
}
