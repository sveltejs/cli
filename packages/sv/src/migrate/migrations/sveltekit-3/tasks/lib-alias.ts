import fs from 'node:fs';
import path from 'node:path';
import { transforms } from '@sveltejs/sv-utils';
import { defineMigrationTask } from '../../../index.ts';

const LIB_ALIAS = /(?<=['"`])\$lib(\/(.+)['"`]|['"`])/g;
const STYLE_TAG = /(<style\b[^>]*>)([\s\S]*?)(<\/style\s*>)/gi;

function libSubpathImports(libDir: string): Record<string, string> {
	return { '#lib': `./${libDir}/index.js`, '#lib/*': `./${libDir}/*` };
}

export default defineMigrationTask({
	id: 'lib-alias',
	description: 'Replace the $lib alias with #lib subpath imports',
	run: ({ sv, cwd, directory, dependencyVersion }) => {
		const isLibrary = Boolean(dependencyVersion('@sveltejs/package'));

		sv.file(
			'package.json',
			transforms.json(({ data }) => {
				data.imports = { ...libSubpathImports(directory.lib), ...data.imports };
			})
		);

		sv.files(
			{
				include: `**/*.{svelte,svelte.ts,svelte.js,ts,js,svx,md}`,
				where: (content) => content.includes('$lib')
			},
			(content, file) => {
				let styleLibPath = path.posix.relative(
					path.posix.dirname(file.replaceAll('\\', '/')),
					directory.lib.replaceAll('\\', '/')
				);
				if (!styleLibPath.startsWith('.')) styleLibPath = `./${styleLibPath}`;

				const rewritten = content
					.replace(
						STYLE_TAG,
						(_, open, css: string, close) =>
							`${open}${css.replace(LIB_ALIAS, (match) => match.replace('$lib', styleLibPath))}${close}`
					)
					.replace(LIB_ALIAS, (match, _, import_path) => {
						match = match.replace('$lib', '#lib');
						// Add explicit file extensions
						if (import_path && !import_path.endsWith('.js') && !import_path.endsWith('.ts')) {
							for (const ending of ['.ts', '.js', '/index.ts', '/index.js']) {
								if (fs.existsSync(path.join(cwd, directory.lib, import_path + ending))) {
									// always import as `.js` for library
									const specifier = isLibrary ? ending.replace('.ts', '.js') : ending;
									return match.slice(0, -1) + specifier + match.slice(-1);
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
