import pc from 'picocolors';
import fs from 'node:fs';
import process from 'node:process';
import * as p from '@clack/prompts';
import semver from 'semver';
import glob from 'tiny-glob/sync.js';
import { bail, check_git, update_svelte_file } from '../../utils.js';
import { transform_svelte_code, update_pkg_json } from './migrate.js';

export async function migrate() {
	if (!fs.existsSync('package.json')) {
		bail('Please re-run this script in a directory with a package.json');
	}

	const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));

	const svelte_dep = pkg.devDependencies?.svelte ?? pkg.dependencies?.svelte;
	if (svelte_dep && semver.validRange(svelte_dep) && semver.gtr('5.0.0', svelte_dep)) {
		console.log(
			pc.bold(
				pc.red('\nYou need to upgrade to Svelte version 5 first (`npx sv migrate svelte-5`).\n')
			)
		);
		process.exit(1);
	}

	const kit_dep = pkg.devDependencies?.['@sveltejs/kit'] ?? pkg.dependencies?.['@sveltejs/kit'];
	if (kit_dep && semver.validRange(kit_dep) && semver.gtr('2.0.0', kit_dep)) {
		console.log(
			pc.bold(
				pc.red(
					'\nYou need to upgrade to SvelteKit version 2 first (`npx sv migrate sveltekit-2`).\n'
				)
			)
		);
		process.exit(1);
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

	update_pkg_json();

	// For some reason {folders.value.join(',')} as part of the glob doesn't work and returns less files
	const files = folders.flatMap(
		/** @param {string} folder */ (folder) =>
			glob(`${folder}/**`, { filesOnly: true, dot: true })
				.map((file) => file.replace(/\\/g, '/'))
				.filter(
					(file) =>
						!file.includes('/node_modules/') &&
						// We're not transforming usage inside .ts/.js files since you can't use the $store syntax there,
						// and therefore have to either subscribe or pass it along, which we can't auto-migrate
						file.endsWith('.svelte')
				)
	);

	for (const file of files) {
		update_svelte_file(
			file,
			(code) => code,
			(code) => transform_svelte_code(code)
		);
	}

	console.log(pc.bold(pc.green('✔ Your project has been migrated')));

	console.log('\nRecommended next steps:\n');

	/** @type {(s: string) => string} */
	const cyan = (s) => pc.bold(pc.cyan(s));

	const tasks = [
		"install the updated dependencies ('npm i' / 'pnpm i' / etc) " + use_git &&
			cyan('git commit -m "migration to $app/state"')
	].filter(Boolean);

	tasks.forEach((task, i) => {
		console.log(`  ${i + 1}: ${task}`);
	});

	console.log('');

	if (use_git) {
		console.log(`Run ${cyan('git diff')} to review changes.\n`);
	}
}
