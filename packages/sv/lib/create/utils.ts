import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import type { Common } from './index.ts';

export function mkdirp(dir: string): void {
	try {
		fs.mkdirSync(dir, { recursive: true });
	} catch (err) {
		const e: any = err;
		if (e.code === 'EEXIST') return;
		throw e;
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

const binaryExtensions = ['.png', '.svg', '.webp'];

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
		if (binaryExtensions.some((ext) => from.endsWith(ext))) {
			fs.copyFileSync(from, to);
		} else {
			fs.writeFileSync(to, replace(fs.readFileSync(from, 'utf-8'), kv));
		}
	}
}

export function dist(path: string): string {
	// we need to make this check, because vitest is making the package root the cwd,
	// but executing the cli from the command line already makes the dist folder the cwd.
	const insideDistFolder = import.meta.url.includes('dist');

	return fileURLToPath(
		new URL(`./${!insideDistFolder ? 'dist/' : ''}${path}`, import.meta.url).href
	);
}

export function getSharedFiles(): Common['files'] {
	const shared = dist('shared.json');
	const { files } = JSON.parse(fs.readFileSync(shared, 'utf-8')) as Common;
	return files;
}
