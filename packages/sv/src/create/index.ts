import fs from 'node:fs';
import path from 'node:path';
import { sanitizeName } from '@sveltejs/sv-utils';
import { filePaths, type PackageJSON } from '../core/common.ts';
import { mkdirp, copy, dist_dir, replace, kv } from './utils.ts';

const publicTemplateTypes = ['minimal', 'demo', 'library', 'addon'] as const;
export type TemplateType = (typeof publicTemplateTypes)[number] | 'svelte';
export type LanguageType = 'typescript' | 'checkjs' | 'none';

export type Options = {
	cwd: string;
	name: string;
	template: TemplateType;
	types: LanguageType;
};

export type File = {
	name: string;
	contents: string;
};

export function create({ cwd, ...options }: Options): void {
	mkdirp(cwd);

	write_template_files(options.template, options.types, options.name, cwd);

	// 'svelte' comes verbatim from create-vite
	if (options.template !== 'svelte') {
		finalize_package_json(cwd, options.name);
	}

	// Files that are not relevant for 'addon' template
	if (options.template === 'addon') {
		for (const name of [
			'svelte.config.js',
			'svelte.config.ts',
			'vite.config.js',
			'vite.config.ts'
		]) {
			fs.rmSync(path.join(cwd, name), { force: true });
		}
	}
}

export type TemplateMetadata = { name: TemplateType; title: string; description: string };
export const templates: TemplateMetadata[] = publicTemplateTypes.map((dir) => {
	const meta_file = path.join(dist_dir, 'templates', dir, 'meta.json');
	const { title, description } = JSON.parse(fs.readFileSync(meta_file, 'utf8'));

	return {
		name: dir,
		title,
		description
	};
});

function write_template_files(template: string, types: LanguageType, name: string, cwd: string) {
	const dir = path.join(dist_dir, 'templates', template);
	copy(`${dir}/assets`, cwd, (name: string) => name.replace('DOT-', '.'), kv(name));
	copy(`${dir}/package.json`, `${cwd}/package.json`, undefined, kv(name));

	const manifest = `${dir}/files.types=${types}.json`;
	const files = JSON.parse(fs.readFileSync(manifest, 'utf-8')) as File[];

	files.forEach((file) => {
		const dest = path.join(cwd, file.name);
		mkdirp(path.dirname(dest));
		fs.writeFileSync(dest, replace(file.contents, kv(name)));
	});
}

function finalize_package_json(cwd: string, name: string) {
	const pkg_file = path.join(cwd, filePaths.packageJson);
	const pkg: PackageJSON = JSON.parse(fs.readFileSync(pkg_file, 'utf-8'));

	pkg.dependencies = sort_keys(pkg.dependencies);
	pkg.devDependencies = sort_keys(pkg.devDependencies);
	pkg.name = sanitizeName(name, 'package');

	fs.writeFileSync(pkg_file, JSON.stringify(pkg, null, '\t') + '\n');
}

function sort_keys<T>(obj?: Record<string, T>) {
	if (!obj) return;

	return Object.keys(obj)
		.sort()
		.reduce<Record<string, T>>((sorted, key) => {
			sorted[key] = obj[key];
			return sorted;
		}, {});
}
