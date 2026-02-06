import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';
import * as p from '@clack/prompts';
import pc from 'picocolors';
import { bail, check_git, migration_succeeded } from '../../utils.js';
import { migrate_config } from './migrate_config.js';
import { migrate_pkg } from './migrate_pkg.js';

export async function migrate() {
	if (!fs.existsSync('svelte.config.js')) {
		bail('Please re-run this script in a directory with a svelte.config.js');
	}
	if (!fs.existsSync('package.json')) {
		bail('Please re-run this script in a directory with a package.json');
	}

	p.log.warning(
		pc.bold(
			pc.yellow('This will update your svelte.config.js and package.json in the current directory')
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

	const { default: config } = await import(pathToFileURL(path.resolve('svelte.config.js')).href);
	const has_package_config = !!config.package;

	config.package = {
		source: path.resolve(config.kit?.files?.lib ?? config.package?.source ?? 'src/lib'),
		dir: config.package?.dir ?? 'package',
		exports:
			config.package?.exports ??
			((/** @type {string} */ filepath) => !/^_|\/_|\.d\.ts$/.test(filepath)),
		files: config.package?.files ?? (() => true),
		emitTypes: config.package?.emitTypes ?? true
	};
	config.extensions = config.extensions ?? ['.svelte'];

	migrate_pkg(config);

	if (has_package_config) {
		migrate_config();
	}

	/** @type {(s: string) => string} */
	const cyan = (s) => pc.bold(pc.cyan(s));

	/** @type {string[]} */
	const tasks = [];

	if (use_git) tasks.push(cyan('git commit -m "migration to @sveltejs/package v2"'));

	tasks.push('Review the migration guide at https://github.com/sveltejs/kit/pull/8922');
	tasks.push('Read the updated docs at https://svelte.dev/docs/kit/packaging');

	migration_succeeded;
}
