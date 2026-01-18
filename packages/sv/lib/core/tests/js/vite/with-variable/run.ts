import { imports, vite, type AstTypes } from '../../../../tooling/js/index.js';

export function run(ast: AstTypes.Program): void {
	const vitePluginName = 'myPlugin';
	imports.addDefault(ast, { as: vitePluginName, from: 'my-plugin' });
	vite.addPlugin(ast, { code: `${vitePluginName}()` });
}
