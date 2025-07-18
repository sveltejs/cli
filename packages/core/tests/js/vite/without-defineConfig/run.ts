import { imports, vite, type AstTypes } from '@sveltejs/cli-core/js';

export function run(ast: AstTypes.Program): void {
	vite.addPlugin(ast, ({ prepend }) => {
		const vitePluginName = 'myPlugin';
		imports.addDefault(ast, { as: vitePluginName, from: 'my-plugin' });
		prepend({ code: `${vitePluginName}()` });
	});
}
