import { js, type AstTypes } from '@sveltejs/sv-utils';

const OLD_SOURCE = '$app/environment';
const NEW_SOURCE = '$app/env';

/** Rename `$app/environment` imports to `$app/env`. Returns whether anything changed. */
export function renameEnvNamespace(ast: AstTypes.Program): boolean {
	let modified = false;

	for (const { sourceNode } of js.imports.findAll(ast, { from: OLD_SOURCE })) {
		sourceNode.value = NEW_SOURCE;
		sourceNode.raw = undefined;
		modified = true;
	}

	return modified;
}
