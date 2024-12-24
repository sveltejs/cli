import pc from 'picocolors';
import fs from 'node:fs';
import process from 'node:process';
import * as p from '@clack/prompts';
import glob from 'tiny-glob/sync.js';
import { remove_self_closing_tags } from './migrate.js';
import { pathToFileURL } from 'node:url';
import { resolve } from 'import-meta-resolve';

export async function migrate() {
	let compiler;
	try {
		compiler = await import_from_cwd('svelte/compiler');
	} catch {
		console.log(pc.bold(pc.red('❌ Could not find a local Svelte installation.')));
		return;
	}

	console.log(
		pc.bold(pc.yellow('\nThis will update .svelte files inside the current directory\n'))
	);

	const response = await p.confirm({
		message: 'Continue?',
		initialValue: false
	});

	if (p.isCancel(response) || !response) {
		process.exit(1);
	}

	const files = glob('**/*.svelte')
		.map((file) => file.replace(/\\/g, '/'))
		.filter((file) => !file.includes('/node_modules/'));

	for (const file of files) {
		try {
			const code = await remove_self_closing_tags(compiler, fs.readFileSync(file, 'utf-8'));
			fs.writeFileSync(file, code);
		} catch {
			// continue
		}
	}

	console.log(pc.bold(pc.green('✔ Your project has been updated')));
	console.log('  If using Prettier, please upgrade to the latest prettier-plugin-svelte version');
}

/** @param {string} name */
function import_from_cwd(name) {
	const cwd = pathToFileURL(process.cwd()).href;
	const url = resolve(name, cwd + '/x.js');

	return import(url);
}
