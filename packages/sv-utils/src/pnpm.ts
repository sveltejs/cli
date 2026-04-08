import { transforms, type TransformFn } from './tooling/transforms.ts';

/**
 * Returns a TransformFn for `pnpm-workspace.yaml` that adds packages to `onlyBuiltDependencies`.
 *
 * Use with `sv.file`:
 * ```ts
 * if (packageManager === 'pnpm') {
 *   sv.file(file.findUp('pnpm-workspace.yaml'), pnpm.onlyBuiltDependencies('my-native-dep'));
 * }
 * ```
 */
export function onlyBuiltDependencies(...packages: string[]): TransformFn {
	return transforms.yaml(({ data }) => {
		const existing = data.get('onlyBuiltDependencies') as
			| { items?: Array<{ value: string } | string> }
			| undefined;
		const items: Array<{ value: string } | string> = existing?.items ?? [];
		for (const pkg of packages) {
			if (items.includes(pkg)) continue;
			if (items.some((y) => typeof y === 'object' && y.value === pkg)) continue;
			items.push(pkg);
		}
		data.set('onlyBuiltDependencies', items);
	});
}
