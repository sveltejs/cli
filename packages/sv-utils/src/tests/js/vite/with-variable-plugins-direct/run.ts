import { array, common, vite, type AstTypes } from '../../../../tooling/js/index.ts';

export function run(ast: AstTypes.Program): void {
	// This mimics the vitest addon pattern: getConfig + configProperty + array.append
	const config = vite.getConfig(ast);
	const plugins = vite.configProperty(ast, config, {
		name: 'plugins',
		fallback: array.create()
	});
	array.append(plugins, common.parseExpression('myPlugin()'));
}
