import pc from 'picocolors';
import fs from 'node:fs';
import process from 'node:process';
import * as p from '@clack/prompts';
import glob from 'tiny-glob/sync.js';
import {
	bail,
	check_git,
	migration_succeeded,
	update_js_file,
	update_svelte_file
} from '../../utils.js';
import { transform_code, transform_svelte_code, update_pkg_json } from './migrate.js';

export async function migrate() {
	if (!fs.existsSync('package.json')) {
		bail('Please re-run this script in a directory with a package.json');
	}

	p.log.warning(
		pc.bold(pc.yellow('This will update files in the current directory.')) +
			'\n' +
			pc.bold(
				pc.yellow(
					"If you're inside a monorepo, don't run this in the root directory, rather run it in all projects independently."
				)
			)
	);

	const use_git = check_git();

	const response = await p.confirm({
		message: 'Continue?',
		initialValue: false
	});

	if (p.isCancel(response) || !response) {
		process.exit(1);
	}

	const folders = await p.multiselect({
		message: 'Which folders should be migrated?',
		options: fs
			.readdirSync('.')
			.filter(
				(dir) => fs.statSync(dir).isDirectory() && dir !== 'node_modules' && !dir.startsWith('.')
			)
			.map((dir) => ({ title: dir, value: dir, selected: true }))
	});

	if (p.isCancel(folders) || !folders?.length) {
		process.exit(1);
	}

	const migrate_transition = await p.confirm({
		message:
			'Add the `|global` modifier to currently global transitions for backwards compatibility? More info at https://svelte.dev/docs/svelte/v4-migration-guide#transitions-are-local-by-default',
		initialValue: true
	});

	if (p.isCancel(migrate_transition)) {
		process.exit(1);
	}

	update_pkg_json();

	// const { default: config } = fs.existsSync('svelte.config.js')
	// 	? await import(pathToFileURL(path.resolve('svelte.config.js')).href)
	// 	: { default: {} };

	/** @type {string[]} */
	const svelte_extensions = /* config.extensions ?? - disabled because it would break .svx */ [
		'.svelte'
	];
	const extensions = [...svelte_extensions, '.ts', '.js'];
	// For some reason {folders.join(',')} as part of the glob doesn't work and returns less files
	const files = folders.flatMap(
		/** @param {string} folder */ (folder) =>
			glob(`${folder}/**`, { filesOnly: true, dot: true })
				.map((file) => file.replace(/\\/g, '/'))
				.filter((file) => !file.includes('/node_modules/'))
	);

	for (const file of files) {
		if (extensions.some((ext) => file.endsWith(ext))) {
			if (svelte_extensions.some((ext) => file.endsWith(ext))) {
				update_svelte_file(file, transform_code, (code) =>
					transform_svelte_code(code, migrate_transition)
				);
			} else {
				update_js_file(file, transform_code);
			}
		}
	}

	/** @type {(s: string) => string} */
	const cyan = (s) => pc.bold(pc.cyan(s));

	const tasks = [
		use_git && cyan('git commit -m "migration to Svelte 4"'),
		'Review the migration guide at https://svelte.dev/docs/svelte/v4-migration-guide',
		'Read the updated docs at https://svelte.dev/docs/svelte',
		use_git && `Run ${cyan('git diff')} to review changes.`
	].filter(Boolean);

	migration_succeeded(tasks);
}
