import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

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

export function copy(
	from: string,
	to: string,
	rename: (basename: string) => string = identity
): void {
	if (!fs.existsSync(from)) return;

	const stats = fs.statSync(from);

	if (stats.isDirectory()) {
		fs.readdirSync(from).forEach((file) => {
			copy(path.join(from, file), path.join(to, rename(file)));
		});
	} else {
		mkdirp(path.dirname(to));
		fs.copyFileSync(from, to);
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

export const package_manager: string = get_package_manager() || 'npm';

/**
 * Supports npm, pnpm, Yarn, cnpm, bun and any other package manager that sets the
 * npm_config_user_agent env variable.
 * Thanks to https://github.com/zkochan/packages/tree/main/which-pm-runs for this code!
 */
function get_package_manager() {
	if (!process.env.npm_config_user_agent) {
		return undefined;
	}
	const user_agent = process.env.npm_config_user_agent;
	const pm_spec = user_agent.split(' ')[0];
	const separator_pos = pm_spec.lastIndexOf('/');
	const name = pm_spec.substring(0, separator_pos);
	return name === 'npminstall' ? 'cnpm' : name;
}
