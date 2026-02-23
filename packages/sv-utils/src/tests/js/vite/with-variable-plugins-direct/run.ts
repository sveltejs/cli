import { array, common, object, vite, type AstTypes } from '../../../../tooling/js/index.ts';

export function run(ast: AstTypes.Program): void {
	// This mimics the vitest addon pattern: getConfig + object.property + array.append
	const config = vite.getConfig(ast);
	const plugins = object.property(config, {
		name: 'plugins',
		fallback: array.create(),
		resolveFrom: ast
	});
	array.append(plugins, common.parseExpression('myPlugin()'));
}
