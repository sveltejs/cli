import { isVersionUnsupportedBelow } from './semver.ts';
import type { TransformFn } from './tooling/transforms.ts';
import * as transforms from './tooling/transforms.ts';

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

/** Before 10.5, `pnpm-workspace.yaml` must list `packages`, so a settings-only one breaks `pnpm install`. */
export function readsWorkspaceSettings(version: string | undefined): boolean {
	return !version || !isVersionUnsupportedBelow(version, '10.5.0');
}

/** `allowBuilds` landed in pnpm 10.26, older versions only read `onlyBuiltDependencies`. */
export function allowBuildsByVersion(version: string | undefined, packages: string[]): TransformFn {
	if (!readsWorkspaceSettings(version)) return () => false;
	if (version && isVersionUnsupportedBelow(version, '10.26.0')) return writeLegacy(packages);
	return writeAllowBuilds(packages);
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
