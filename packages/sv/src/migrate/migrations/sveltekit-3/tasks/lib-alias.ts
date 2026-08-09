import { transforms } from '@sveltejs/sv-utils';
import { defineMigrationTask } from '../../../index.ts';

const LIB_ALIAS = /\$lib(?=\/|['"`])/g;

function libSubpathImports(libDir: string): Record<string, string> {
	return { '#lib': `./${libDir}/index.js`, '#lib/*': `./${libDir}/*` };
}

export default defineMigrationTask({
	id: 'lib-alias',
	description: 'Replace the $lib alias with #lib subpath imports',
	run: ({ sv, directory }) => {
		sv.file(
			'package.json',
			transforms.json(({ data }) => {
				data.imports = { ...libSubpathImports(directory.lib), ...data.imports };
			})
		);

		sv.files(
			{
				include: `${directory.src}/**/*.{svelte,svelte.ts,svelte.js,ts,js,svx,md}`,
				where: (content) => content.includes('$lib')
			},
			(content) => {
				const rewritten = content.replace(LIB_ALIAS, '#lib');
				return rewritten === content ? false : rewritten;
			}
		);
	}
});
