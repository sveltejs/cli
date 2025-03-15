#!/usr/bin/env node
import fs from 'node:fs';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import pc from 'picocolors';
import * as p from '@clack/prompts';

const migration = process.argv[2];
const dir = fileURLToPath(new URL('.', import.meta.url));

const migrations = fs
	.readdirSync(`${dir}/migrations`)
	.filter((migration) => fs.existsSync(`${dir}/migrations/${migration}/index.js`));

const pkg = JSON.parse(fs.readFileSync(`${dir}/package.json`, 'utf8'));

p.intro(`Welcome to the svelte-migrate CLI! ${pc.gray(`(v${pkg.version})`)}`);

if (migrations.includes(migration)) {
	await run_migration(migration);
} else {
	if (migration) p.log.warning(pc.yellow(`Invalid migration "${migration}" provided.`));

	const selectedMigration = await p.select({
		message: 'Which migration would you like to run?',
		options: migrations.map((x) => ({ value: x, label: x }))
	});

	if (!p.isCancel(selectedMigration)) await run_migration(selectedMigration);
}

p.outro("You're all set!");

/**
 * @param {string} migration
 */
async function run_migration(migration) {
	const { migrate } = await import(`./migrations/${migration}/index.js`);
	await migrate();
}
