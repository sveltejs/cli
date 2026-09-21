import { execSync } from 'node:child_process';
import path from 'node:path';
import { coerceVersion } from './semver.ts';
import { transforms, type TransformFn } from './tooling/transforms.ts';

type YamlMap = {
	get(key: string): unknown;
	set(key: string, value: unknown): void;
	has(key: string): boolean;
};

type YamlSeq = { items?: Array<{ value: string } | string> };

type YamlDoc = {
	get(key: string): unknown;
	set(key: string, value: unknown): void;
	has(key: string): boolean;
	delete(key: string): boolean;
	createNode(value: unknown, options?: { flow?: boolean }): unknown;
};

const majorByCwd = new Map<string, number | undefined>();

/**
 * Detects the major version of pnpm that would run in `cwd`. `pnpm --version` resolves
 * `packageManager` / `devEngines.packageManager` from there, so the invoker's pin does
 * not leak into the target project.
 *
 * Results are memoised per directory: pnpm self-manages versions, so a miss can download
 * a whole pnpm release before answering.
 */
export function detectPnpmMajor(cwd: string): number | undefined {
	const key = path.resolve(cwd);
	if (majorByCwd.has(key)) return majorByCwd.get(key);

	let major: number | undefined;
	try {
		const out = execSync('pnpm --version', {
			encoding: 'utf-8',
			stdio: ['ignore', 'pipe', 'ignore'],
			cwd: key
		});
		major = coerceVersion(out.trim()).major;
	} catch {
		major = undefined;
	}

	majorByCwd.set(key, major);
	return major;
}

export function writeAllowBuilds(packages: string[]): TransformFn {
	return transforms.yaml(({ data }) => {
		const doc = data as unknown as YamlDoc;

		const toMigrate: string[] = [];
		const legacy = doc.get('onlyBuiltDependencies') as YamlSeq | undefined;
		if (legacy?.items) {
			for (const item of legacy.items) {
				toMigrate.push(typeof item === 'object' ? item.value : item);
			}
		}

		let map = doc.get('allowBuilds') as YamlMap | undefined;
		if (!map || typeof map.set !== 'function') {
			map = doc.createNode({}, { flow: false }) as YamlMap;
			doc.set('allowBuilds', map);
		}

		for (const pkg of [...toMigrate, ...packages]) {
			if (!map.has(pkg)) map.set(pkg, true);
		}

		if (legacy) doc.delete('onlyBuiltDependencies');
	});
}

export function writeLegacy(packages: string[]): TransformFn {
	return transforms.yaml(({ data }) => {
		const existing = data.get('onlyBuiltDependencies') as YamlSeq | undefined;
		const items: Array<{ value: string } | string> = existing?.items ?? [];
		for (const pkg of packages) {
			if (items.includes(pkg)) continue;
			if (items.some((y) => typeof y === 'object' && y.value === pkg)) continue;
			items.push(pkg);
		}
		data.set('onlyBuiltDependencies', items);
	});
}
