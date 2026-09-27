import { js, type AstTypes } from '@sveltejs/sv-utils';

const OLD_SOURCE = '$app/environment';
const NEW_SOURCE = '$app/env';

/** Rename `$app/environment` imports to `$app/env`. Returns whether anything changed. */
export function renameEnvNamespace(ast: AstTypes.Program): boolean {
	return js.imports.renameSource(ast, { from: OLD_SOURCE, to: NEW_SOURCE });
}
