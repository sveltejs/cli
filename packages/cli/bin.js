#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import * as p from '@clack/prompts';
import { bold, cyan, gray, yellow } from 'picocolors';
import { create } from './index.js';
import { dist, package_manager } from './utils.js';

const { version } = JSON.parse(fs.readFileSync(new URL('package.json', import.meta.url), 'utf-8'));
let cwd = process.argv[2] || '.';

console.log(`
${gray(`create-svelte version ${version}`)}
`);

p.intro('Welcome to SvelteKit!');

if (cwd === '.') {
	const dir = await p.text({
		message: 'Where should we create your project?',
		placeholder: '  (hit Enter to use current directory)'
	});

	if (p.isCancel(dir)) process.exit(1);

	if (dir) {
		cwd = /** @type {string} */ (dir);
	}
}

if (fs.existsSync(cwd)) {
	if (fs.readdirSync(cwd).length > 0) {
		const force = await p.confirm({
			message: 'Directory not empty. Continue?',
			initialValue: false
		});

		// bail if `force` is `false` or the user cancelled with Ctrl-C
		if (force !== true) {
			process.exit(1);
		}
	}
}

const options = await p.group(
	{
		template: (_) =>
			p.select({
				message: 'Which Svelte app template?',
				options: fs.readdirSync(dist('templates')).map((dir) => {
					const meta_file = dist(`templates/${dir}/meta.json`);
					const { title, description } = JSON.parse(fs.readFileSync(meta_file, 'utf8'));

					return {
						label: title,
						hint: description,
						value: dir
					};
				})
			}),

		types: ({ results }) =>
			p.select({
				message: 'Add type checking with TypeScript?',
				initialValue: /** @type {'checkjs' | 'typescript' | null} */ (
					results.template === 'skeletonlib' ? 'checkjs' : 'typescript'
				),
				options: [
					{
						label: 'Yes, using TypeScript syntax',
						value: 'typescript'
					},
					{
						label: 'Yes, using JavaScript with JSDoc comments',
						value: 'checkjs'
					},
					{ label: 'No', value: null }
				]
			})
	},
	{ onCancel: () => process.exit(1) }
);

await create(cwd, {
	name: path.basename(path.resolve(cwd)),
	template: /** @type {'default' | 'skeleton' | 'skeletonlib'} */ (options.template),
	types: /** @type {'checkjs' | 'typescript' | null} */ (options.types)
});

p.outro('Your project is ready!');

if (!options.types && options.template === 'skeletonlib') {
	const warning = yellow('▲');
	console.log(
		`${warning} You chose to not add type checking, but TypeScript will still be installed in order to generate type definitions when building the library\n`
	);
}

console.log('Install more integrations with:');
console.log(bold(cyan('  npx svelte-add')));

console.log('\nNext steps:');
let i = 1;

const relative = path.relative(process.cwd(), cwd);
if (relative !== '') {
	console.log(`  ${i++}: ${bold(cyan(`cd ${relative}`))}`);
}

console.log(`  ${i++}: ${bold(cyan(`${package_manager} install`))}`);
// prettier-ignore
console.log(`  ${i++}: ${bold(cyan('git init && git add -A && git commit -m "Initial commit"'))} (optional)`);
console.log(`  ${i++}: ${bold(cyan(`${package_manager} run dev -- --open`))}`);

console.log(`\nTo close the dev server, hit ${bold(cyan('Ctrl-C'))}`);
console.log(`\nStuck? Visit us at ${cyan('https://svelte.dev/chat')}`);
