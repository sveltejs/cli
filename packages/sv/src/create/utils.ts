import fs from 'node:fs';
import path from 'node:path';
import * as walk from 'empathic/walk';
import { isNodeError } from '../core/common.ts';

/**
 * @returns an absolute path to the `dist` directory
 * containing templates and add-on content
 *
 * this function can be called during runtime or devtime
 */
const resolve_dist_dir = (): string => {
	const root = walk
		.up(import.meta.dirname)
		.find((dir) => fs.existsSync(path.join(dir, 'package.json')));
	if (!root) throw new Error('could not locate package.json');
	return path.join(root, 'dist');
};

export const dist_dir = resolve_dist_dir();

export function mkdirp(dir: string): void {
	try {
		fs.mkdirSync(dir, { recursive: true });
	} catch (err) {
		if (isNodeError(err) && err.code === 'EEXIST') return;
		throw err;
	}
}

function identity<T>(x: T): T {
	return x;
}

export function replace(contents: string, kv: Record<string, string>): string {
	for (const [key, value] of Object.entries(kv)) {
		contents = contents.replaceAll(key, value);
	}
	return contents;
}

export function kv(name: string): Record<string, string> {
	const protocolName = name.startsWith('@') ? name.split('/')[0] : name;
	return {
		'$SV-PROTOCOL-NAME-TODO$': protocolName,
		'$SV-NAME-TODO$': name
	};
}

// files that have kv's in the contents that we replace
const withReplaceExtensions = ['.md', '.js', '.ts', '.json'];

export function copy(
	from: string,
	to: string,
	rename: (basename: string) => string = identity,
	kv: Record<string, string> = {}
): void {
	if (!fs.existsSync(from)) return;
	const stats = fs.statSync(from);

	if (stats.isDirectory()) {
		fs.readdirSync(from).forEach((file) => {
			copy(path.join(from, file), path.join(to, rename(file)), rename, kv);
		});
	} else {
		mkdirp(path.dirname(to));
		if (withReplaceExtensions.some((ext) => from.endsWith(ext))) {
			fs.writeFileSync(to, replace(fs.readFileSync(from, 'utf-8'), kv));
		} else {
			fs.copyFileSync(from, to);
		}
	}
}

/** Sorted `/`-separated paths relative to `cwd` (posix even on Windows: names are matched by prefix and shipped in dist). */
export function listFiles(cwd: string): string[] {
	return fs
		.readdirSync(cwd, { recursive: true, withFileTypes: true })
		.filter((entry) => entry.isFile())
		.map(({ parentPath, name }) =>
			path.posix.join(path.relative(cwd, parentPath).replaceAll(path.sep, '/'), name)
		)
		.sort();
}

/** `DOT-` prefix so dotfiles survive publishing; renamed back at runtime by `fetchAssets()`. */
export function saveAsset({
	from,
	assetsDir,
	name,
	destName
}: {
	from: string;
	assetsDir: string;
	name: string;
	destName?: string;
}): string {
	const dest = path.join(assetsDir, (destName ?? name).replace(/^\./, 'DOT-'));
	mkdirp(path.dirname(dest));
	fs.copyFileSync(from, dest);
	return dest;
}
