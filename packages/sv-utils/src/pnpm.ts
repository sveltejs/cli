import { detectPnpmMajor } from './pnpm-internals.ts';
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

export type AllowBuildsOptions = {
	/** Directory whose pnpm version should be detected. */
	cwd?: string;
	/** Explicit pnpm version; skips `pnpm --version` detection. */
	pnpmVersion?: string | number;
};

function isAllowBuildsOptions(value: unknown): value is AllowBuildsOptions {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function resolvePnpmMajor(options?: AllowBuildsOptions): number | undefined {
	if (options?.pnpmVersion !== undefined) {
		return coerceVersion(String(options.pnpmVersion)).major;
	}
	return detectPnpmMajor(options?.cwd);
}

/**
 * Returns a TransformFn for `pnpm-workspace.yaml` that adds packages to the
 * pnpm "allow builds" config.
 *
 * The helper detects the installed pnpm version (via `pnpm --version`) and:
 * - on pnpm `>= 11` writes to the unified `allowBuilds` map (`{ pkg: true }`),
 *   migrating any legacy `onlyBuiltDependencies` list into the map;
 * - on pnpm `< 11` writes to the legacy `onlyBuiltDependencies` list.
 *
 * Pass `{ cwd }` so detection uses the target project rather than the
 * invoker's working directory. Pass `{ pnpmVersion }` to skip detection.
 *
 * ```ts
 * if (packageManager === 'pnpm') {
 *   sv.file(file.findUp('pnpm-workspace.yaml'), pnpm.allowBuilds('my-native-dep', { cwd }));
 * }
 * ```
 */
export function allowBuilds(...packages: string[]): TransformFn;
export function allowBuilds(
	...args: [...packages: string[], options: AllowBuildsOptions]
): TransformFn;
export function allowBuilds(packages: string[], options?: AllowBuildsOptions): TransformFn;
export function allowBuilds(
	first?: string | string[] | AllowBuildsOptions,
	second?: string | AllowBuildsOptions,
	...rest: Array<string | AllowBuildsOptions>
): TransformFn {
	const args: Array<string | string[] | AllowBuildsOptions> = [];
	if (first !== undefined) args.push(first);
	if (second !== undefined) args.push(second);
	args.push(...rest);

	let options: AllowBuildsOptions | undefined;
	const last = args.at(-1);
	if (isAllowBuildsOptions(last)) {
		options = last;
		args.pop();
	}

	const packages = args.length === 1 && Array.isArray(args[0]) ? args[0] : (args as string[]);
	const major = resolvePnpmMajor(options);
	if (major !== undefined && major < 11) return writeLegacy(packages);
	return writeAllowBuilds(packages);
}

function writeAllowBuilds(packages: string[]): TransformFn {
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

function writeLegacy(packages: string[]): TransformFn {
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
