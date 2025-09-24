import fs from 'node:fs';
import path from 'node:path';
import { mkdirp, copy, dist } from './utils.ts';

export type TemplateType = (typeof templateTypes)[number];
export type LanguageType = (typeof languageTypes)[number];

const templateTypes = ['minimal', 'demo', 'library', 'addon'] as const;
const languageTypes = ['typescript', 'checkjs', 'none'] as const;

export type Options = {
	name: string;
	template: TemplateType;
	types: LanguageType;
};

export type File = {
	name: string;
	contents: string;
};

export type Condition = TemplateType | LanguageType;

export type Common = {
	files: Array<{
		name: string;
		include: Condition[];
		exclude: Condition[];
		contents: string;
	}>;
};

export function create(cwd: string, options: Options): void {
	mkdirp(cwd);

	write_template_files(options.template, options.types, options.name, cwd);
	write_common_files(cwd, options, options.name);
}

export type TemplateMetadata = { name: TemplateType; title: string; description: string };
export const templates: TemplateMetadata[] = templateTypes.map((dir) => {
	const meta_file = dist(`templates/${dir}/meta.json`);
	const { title, description } = JSON.parse(fs.readFileSync(meta_file, 'utf8'));

	return {
		name: dir,
		title,
		description
	};
});

function write_template_files(template: string, types: LanguageType, name: string, cwd: string) {
	const dir = dist(`templates/${template}`);
	copy(`${dir}/assets`, cwd, (name: string) => name.replace('DOT-', '.'));
	copy(`${dir}/package.json`, `${cwd}/package.json`);

	const manifest = `${dir}/files.types=${types}.json`;
	const files = JSON.parse(fs.readFileSync(manifest, 'utf-8')) as File[];

	files.forEach((file) => {
		const dest = path.join(cwd, file.name);
		mkdirp(path.dirname(dest));

		fs.writeFileSync(dest, file.contents.replace(/~SV-NAME-TODO~/g, name));
	});
}

function write_common_files(cwd: string, options: Options, name: string) {
	const shared = dist('shared.json');
	const { files } = JSON.parse(fs.readFileSync(shared, 'utf-8')) as Common;

	const pkg_file = path.join(cwd, 'package.json');
	const pkg = /** @type {any} */ JSON.parse(fs.readFileSync(pkg_file, 'utf-8'));

	sort_files(files).forEach((file) => {
		const include = file.include.every((condition) => matches_condition(condition, options));
		const exclude = file.exclude.some((condition) => matches_condition(condition, options));

		if (exclude || !include) return;

		if (file.name === 'package.json') {
			const new_pkg = JSON.parse(file.contents);
			merge(pkg, new_pkg);
		} else {
			const dest = path.join(cwd, file.name);
			mkdirp(path.dirname(dest));
			fs.writeFileSync(dest, file.contents.replace(/~SV-NAME-TODO~/g, name));
		}
	});

	pkg.dependencies = sort_keys(pkg.dependencies);
	pkg.devDependencies = sort_keys(pkg.devDependencies);
	pkg.name = to_valid_package_name(name);

	fs.writeFileSync(pkg_file, JSON.stringify(pkg, null, '\t') + '\n');
}

function matches_condition(condition: Condition, options: Options) {
	if (templateTypes.includes(condition as TemplateType)) {
		return options.template === condition;
	}
	if (languageTypes.includes(condition as LanguageType)) {
		return options.types === condition;
	}
	return Boolean(options[condition as never]);
}

function merge(target: any, source: any) {
	for (const key in source) {
		if (key in target) {
			const target_value = target[key];
			const source_value = source[key];

			if (
				typeof source_value !== typeof target_value ||
				Array.isArray(source_value) !== Array.isArray(target_value)
			) {
				throw new Error('Mismatched values');
			}

			if (typeof source_value === 'object') {
				merge(target_value, source_value);
			} else {
				target[key] = source_value;
			}
		} else {
			target[key] = source[key];
		}
	}
}

function sort_keys(obj: Record<string, any>) {
	if (!obj) return;

	const sorted: Record<string, any> = {};
	Object.keys(obj)
		.sort()
		.forEach((key) => {
			sorted[key] = obj[key];
		});

	return sorted;
}

/**
 * Sort files so that those which apply more generically come first so they
 * can be overwritten by files for more precise cases later.
 */
function sort_files(files: Common['files']) {
	return files.sort((f1, f2) => {
		const f1_more_generic =
			f1.include.every((include) => f2.include.includes(include)) &&
			f1.exclude.every((exclude) => f2.exclude.includes(exclude));
		const f2_more_generic =
			f2.include.every((include) => f1.include.includes(include)) &&
			f2.exclude.every((exclude) => f1.exclude.includes(exclude));
		const same = f1_more_generic && f2_more_generic;
		const different = !f1_more_generic && !f2_more_generic;
		return same || different ? 0 : f1_more_generic ? -1 : 1;
	});
}

function to_valid_package_name(name: string) {
	return name
		.trim()
		.toLowerCase()
		.replace(/\s+/g, '-')
		.replace(/^[._]/, '')
		.replace(/[^a-z0-9~.-]+/g, '-');
}
