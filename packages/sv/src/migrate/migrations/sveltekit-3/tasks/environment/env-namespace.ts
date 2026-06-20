import { type AstTypes } from '@sveltejs/sv-utils';

const OLD_SOURCE = '$app/environment';
const NEW_SOURCE = '$app/env';

/** Rename `$app/environment` imports to `$app/env`. Returns whether anything changed. */
export function renameEnvNamespace(ast: AstTypes.Program): boolean {
	let modified = false;

	for (const node of ast.body) {
		if (node.type !== 'ImportDeclaration') continue;
		if (node.source.value !== OLD_SOURCE) continue;

		node.source.value = NEW_SOURCE;
		node.source.raw = undefined;
		modified = true;
	}

	return modified;
}
