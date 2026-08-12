import { transforms } from '@sveltejs/sv-utils';
import fs from 'node:fs';
import { defineMigrationTask } from '../../../index.ts';

const LIB_ALIAS = /(?<=['"`])\$lib(\/(.+)['"`]|['"`])/g;

function libSubpathImports(libDir: string): Record<string, string> {
	return { '#lib': `./${libDir}/index.js`, '#lib/*': `./${libDir}/*` };
}

export default defineMigrationTask({
	id: 'lib-alias',
	description: 'Replace the $lib alias with #lib subpath imports',
	run: ({ sv, cwd, directory }) => {
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
				const rewritten = content.replace(LIB_ALIAS, (match, _, import_path) => {
					match = match.replace('$lib', '#lib');
					// Add explicit file extensions
					if (import_path && !import_path.endsWith('.js') && !import_path.endsWith('.ts')) {
						for (const ending of ['.js', '.ts', '/index.js', '/index.ts']) {
							if (fs.existsSync(`${cwd}/${directory.lib}/${import_path}${ending}`)) {
								// By default TS wants .js file endings even if it's actually a .ts file
								return match.slice(0, -1) + ending.replace('.ts', '.js') + match.slice(-1);
							}
						}
					}
					return match;
				});
				return rewritten === content ? false : rewritten;
			}
		);
	}
});
