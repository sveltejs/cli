import { imports, vite, type AstTypes } from '@sveltejs/cli-core/js';

export function run(ast: AstTypes.Program): void {
	vite.addPluginToViteConfig(ast, ({ add }) => {
		const vitePluginName = 'myPlugin';
		imports.addDefault(ast, { as: vitePluginName, from: 'my-plugin' });
		add({
			code: `${vitePluginName}()`,
			mode: 'prepend'
		});
	});
}
