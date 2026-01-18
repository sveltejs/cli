import { common, exports, type AstTypes } from '../../../../tooling/js/index.js';

export function run(ast: AstTypes.Program): void {
	exports.createDefault(ast, {
		fallback: common.parseExpression(`
			defineConfig({
				path: "some/string/as/path.js",
				valid: true
			})
		`)
	});
}
