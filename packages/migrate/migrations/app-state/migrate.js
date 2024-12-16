import fs from 'node:fs';
import { update_pkg } from '../../utils.js';

export function update_pkg_json() {
	fs.writeFileSync(
		'package.json',
		update_pkg_json_content(fs.readFileSync('package.json', 'utf8'))
	);
}

/**
 * @param {string} content
 */
export function update_pkg_json_content(content) {
	return update_pkg(content, [['@sveltejs/kit', '^2.12.0']]);
}

/**
 * @param {string} code
 */
export function transform_svelte_code(code) {
	// Quick check if nothing to do
	if (!code.includes('$app/stores')) return code;

	// Check if file is using legacy APIs - if so, we can't migrate since reactive statements would break
	const lines = code.split('\n');
	if (lines.some((line) => /^\s*(export let|\$:) /.test(line))) {
		return code;
	}

	const import_match = code.match(/import\s*{([^}]+)}\s*from\s*("|')\$app\/stores\2/);
	if (!import_match) return code; // nothing to do

	const stores = import_match[1].split(',').map((i) => {
		const str = i.trim();
		const [name, alias] = str.split(' as ').map((s) => s.trim());
		return [name, alias || name];
	});
	let modified = code.replace('$app/stores', '$app/state');

	for (const [store, alias] of stores) {
		// if someone uses that they're deep into stores and we better not touch this file
		if (store === 'getStores') return code;

		const regex = new RegExp(`\\b${alias}\\b`, 'g');
		let match;
		let count_removed = 0;

		while ((match = regex.exec(modified)) !== null) {
			const before = modified.slice(0, match.index);
			const after = modified.slice(match.index + alias.length);

			if (before.slice(-1) !== '$') {
				if (/[_'"]/.test(before.slice(-1))) continue; // false positive

				if (store === 'updated' && after.startsWith('.check()')) {
					continue; // this stays as is
				}

				if (
					match.index - count_removed > /** @type {number} */ (import_match.index) &&
					match.index - count_removed <
						/** @type {number} */ (import_match.index) + import_match[0].length
				) {
					continue; // this is the import statement
				}

				return code;
			}

			modified = before.slice(0, -1) + alias + (store === 'page' ? '' : '.current') + after;
			count_removed++;
		}
	}

	return modified;
}
