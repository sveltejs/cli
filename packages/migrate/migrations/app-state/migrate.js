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
	if (!import_match || import_match.index === undefined) return code; // nothing to do

	const stores = import_match[1].split(',').map((i) => {
		const str = i.trim();
		const [name, alias] = str.split(' as ').map((s) => s.trim());
		return [name, alias || name];
	});
	let modified = code.replace('$app/stores', '$app/state');

	let needs_navigating_migration_task = false;
	const import_start = import_match.index;
	const from_pos_in_original = code.indexOf('from', import_start);

	for (const [store, alias] of stores) {
		// if someone uses that they're deep into stores and we better not touch this file
		if (store === 'getStores') return code;

		const regex = new RegExp(`\\b${alias}\\b`, 'g');
		let match;

		while ((match = regex.exec(modified)) !== null) {
			const before = modified.slice(0, match.index);
			const after = modified.slice(match.index + alias.length);

			// Skip if inside a comment (check if // appears on the same line before the match)
			const line_start = before.lastIndexOf('\n') + 1;
			const line_before_match = before.slice(line_start);
			if (line_before_match.includes('//')) {
				continue;
			}

			// Skip if inside a string (odd number of quotes before match on same line)
			const single_quotes = (line_before_match.match(/'/g) || []).length;
			const double_quotes = (line_before_match.match(/"/g) || []).length;
			if (single_quotes % 2 === 1 || double_quotes % 2 === 1) {
				continue;
			}

			if (before.slice(-1) !== '$') {
				if (/[_'"/]/.test(before.slice(-1))) continue; // false positive (part of identifier, string, or path)

				if (store === 'updated' && after.startsWith('.check()')) {
					continue; // this stays as is
				}

				if (match.index >= import_start && match.index < from_pos_in_original) {
					continue; // this is the import statement
				}

				// Check if we're inside a script tag - only bail if inside script (store usage like page.subscribe)
				// Outside script, plain text like "Nice page!" should be ignored
				const script_open = before.lastIndexOf('<script');
				const script_close = before.lastIndexOf('</script>');
				const inside_script = script_open > script_close;

				if (inside_script) {
					return code;
				}
				continue;
			}

			if (store === 'navigating' && after[0] !== '.') {
				needs_navigating_migration_task = true;
			}

			modified = before.slice(0, -1) + alias + (store === 'updated' ? '.current' : '') + after;
		}
	}

	if (needs_navigating_migration_task) {
		modified = `<!-- @migration task: review uses of \`navigating\` -->\n${modified}`;
	}

	return modified;
}
