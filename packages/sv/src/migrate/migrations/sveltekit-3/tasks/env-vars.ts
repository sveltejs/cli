import { transforms, type AstTypes } from '@sveltejs/sv-utils';
import { defineMigrationTask } from '../../../index.ts';

export default defineMigrationTask({
	id: 'env-vars',
	description: 'tbd - migrate environment variables to the new format',
	run: ({ sv, language }) => {
		// TODO: find a way to combine both calls because it still duplicates some stuff
sv.files(
	{ include: '**/*.svelte', where: (content) => content.includes('$env/') },
	transforms.svelteScript({ language }, ({ ast }) => {
		return changeImports(ast.instance.content);
	})
);
		sv.files(
			{ include: '**/*.{ts,js}', where: (content) => content.includes('$env/') },
			transforms.script(({ ast }) => {
				return changeImports(ast);
			})
		);

		// TODO: Rename $app/environment to $app/env
		// Explicit environment variables will become the default in SvelteKit 3. The $env/* modules, along with $app/environment, will be removed.
	}
});

function changeImports(ast: AstTypes.Program): void | false {
	const imports = ast.body.filter((node) => node.type === 'ImportDeclaration');
	const envImports = imports.filter(
		(i) => typeof i.source.value === 'string' && i.source.value.startsWith('$env')
	);

	if (envImports.length === 0) {
		return false; // no env imports, skip;
	}
}
