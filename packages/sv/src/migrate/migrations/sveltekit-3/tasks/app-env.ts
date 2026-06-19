import { transforms, type AstTypes } from '@sveltejs/sv-utils';
import { defineMigrationTask } from '../../../index.ts';

const OLD_SOURCE = '$app/environment';
const NEW_SOURCE = '$app/env';

export default defineMigrationTask({
	id: 'app-env',
	description: 'Rename $app/environment imports to $app/env',
	run: ({ sv, language }) => {
		sv.files(
			{ include: '**/*.{ts,js,svelte}', where: (content) => content.includes(OLD_SOURCE) },
			(content, path) => {
				if (path.endsWith('.svelte')) {
					return transforms.svelteScript({ language }, ({ ast }) => {
						return renameAppEnvironmentImports(ast.instance.content);
					})(content);
				}

				return transforms.script(({ ast }) => renameAppEnvironmentImports(ast))(content);
			}
		);
	}
});

function renameAppEnvironmentImports(ast: AstTypes.Program): false | void {
	let modified = false;

	for (const node of ast.body) {
		if (node.type !== 'ImportDeclaration') continue;
		if (node.source.value !== OLD_SOURCE) continue;

		node.source.value = NEW_SOURCE;
		node.source.raw = undefined;
		modified = true;
	}

	if (!modified) return false;
}
