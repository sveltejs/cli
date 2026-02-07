import * as p from '@clack/prompts';
import fs from 'node:fs';
import process from 'node:process';
import { detect, resolveCommand } from 'package-manager-detector';
import pc from 'picocolors';
import semver from 'semver';
import glob from 'tiny-glob/sync.js';
import {
	bail,
	check_git,
	migration_succeeded,
	update_js_file,
	update_svelte_file,
	update_tsconfig
} from '../../utils.js';
import { migrate as migrate_svelte_4 } from '../svelte-4/index.js';
import {
	transform_code,
	update_pkg_json,
	update_svelte_config,
	update_tsconfig_content
} from './migrate.js';

export async function migrate() {
	if (!fs.existsSync('package.json')) {
		bail('Please re-run this script in a directory with a package.json');
	}

	if (!fs.existsSync('svelte.config.js')) {
		bail('Please re-run this script in a directory with a svelte.config.js');
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

	const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
	const svelte_dep = pkg.devDependencies?.svelte ?? pkg.dependencies?.svelte;
	if (svelte_dep === undefined) {
		bail('Please install Svelte before continuing');
	}

	if (semver.validRange(svelte_dep) && semver.gtr('4.0.0', svelte_dep)) {
		p.log.warning(
			pc.bold(
				pc.yellow(
					'SvelteKit 2 requires Svelte 4 or newer. We recommend running the `svelte-4` migration first (`npx sv migrate svelte-4`).'
				)
			)
		);
		const response = await p.confirm({
			message: 'Run `svelte-4` migration now?',
			initialValue: false
		});
		if (p.isCancel(response) || !response) {
			process.exit(1);
		} else {
			await migrate_svelte_4();
			p.log.success(
				pc.bold(pc.green('`svelte-4` migration complete. Continue with `sveltekit-2` migration?\n'))
			);
			const response = await p.confirm({
				message: 'Continue?',
				initialValue: false
			});
			if (p.isCancel(response) || !response) {
				process.exit(1);
			}
		}
	}

	const folders = await p.multiselect({
		message: 'Which folders should be migrated?',
		options: fs
			.readdirSync('.')
			.filter(
				(dir) =>
					fs.statSync(dir).isDirectory() &&
					dir !== 'node_modules' &&
					dir !== 'dist' &&
					!dir.startsWith('.')
			)
			.map((dir) => ({ title: dir, value: dir, selected: dir === 'src' }))
	});

	if (p.isCancel(folders) || !folders?.length) {
		process.exit(1);
	}

	update_pkg_json();
	update_tsconfig(update_tsconfig_content);
	update_svelte_config();

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
				update_svelte_file(file, transform_code, (code) => code);
			} else {
				update_js_file(file, transform_code);
			}
		}
	}

	/** @type {(s: string) => string} */
	const cyan = (s) => pc.bold(pc.cyan(s));

	const detected = await detect({ cwd: process.cwd() });
	const pm = detected?.name ?? 'npm';
	const cmd = /** @type {import('package-manager-detector').ResolvedCommand} */ (
		resolveCommand(pm, 'install', [])
	);

	const tasks = [
		`Install the updated dependencies by running ${cyan(`${cmd.command} ${cmd.args.join(' ')}`)}`,
		use_git && cyan('git commit -m "migration to SvelteKit 2"'),
		'Review the migration guide at https://svelte.dev/docs/kit/migrating-to-sveltekit-2',
		'Read the updated docs at https://svelte.dev/docs/kit',
		use_git && `Run ${cyan('git diff')} to review changes.`
	].filter(Boolean);

	migration_succeeded(tasks);
}
