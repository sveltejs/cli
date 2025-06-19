import { common, exports, type AstTypes } from '@sveltejs/cli-core/js';

export function run(ast: AstTypes.Program): void {
	exports.createDefault(ast, {
		fallback: common.parseExpression({
			code: `
					defineConfig({
						path: "some/string/as/path.js",
						valid: true
					})
				`
		})
	});
}
