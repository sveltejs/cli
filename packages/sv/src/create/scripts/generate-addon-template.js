import fs from 'node:fs';
import path from 'node:path';
import { saveAsset, listFiles, mkdirp } from '../utils.ts';

const addonsDir = path.resolve(import.meta.dirname, '../../addons');

/**
 * @param {string} dist
 */
export function generate_addon_content(dist) {
	const folders = fs
		.readdirSync(addonsDir, { withFileTypes: true })
		.filter(
			(entry) =>
				entry.isDirectory() &&
				!entry.name.startsWith('.') &&
				fs.existsSync(path.join(addonsDir, `${entry.name}.ts`))
		)
		.map((entry) => entry.name)
		.sort();

	const addonsDist = path.join(dist, 'addons');
	mkdirp(addonsDist);

	for (const folder of folders) {
		const contentDir = path.join(addonsDir, folder);

		const names = listFiles(contentDir);

		const files = [];
		for (const name of names) {
			if (name === 'assets' || name.startsWith(`assets${path.sep}`)) {
				// Same as templates: verbatim copy, `DOT-` prefix so dotfiles
				// survive publishing. Runtime renames back via `fetchAssets()`.
				saveAsset({
					from: path.join(contentDir, name),
					assetsDir: path.join(addonsDist, folder, 'assets'),
					name: path.relative('assets', name)
				});
				continue;
			}
			files.push({ name, contents: fs.readFileSync(path.join(contentDir, name), 'utf8') });
		}

		fs.writeFileSync(
			path.join(addonsDist, `${folder}.json`),
			JSON.stringify({ files }, null, '\t')
		);
	}
}
