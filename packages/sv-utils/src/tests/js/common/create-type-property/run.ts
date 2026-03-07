import type { AstTypes } from '../../../../tooling/index.ts';
import { common, kit } from '../../../../tooling/js/index.ts';

export function run(ast: AstTypes.Program): void {
	const platform = kit.addGlobalAppInterface(ast as AstTypes.TSProgram, { name: 'Platform' });
	platform.body.body.push(
		common.createTypeProperty('env', 'Env'),
		common.createTypeProperty('ctx', 'ExecutionContext'),
		common.createTypeProperty('cf', 'IncomingRequestCfProperties', true)
	);
}
