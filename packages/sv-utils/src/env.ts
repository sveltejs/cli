import { coerceVersion } from './semver.ts';

export type EnvMode = 'declared' | 'legacy';

export function resolveEnvMode({
	kitRange,
	explicitEnvFlag
}: {
	kitRange: string | undefined;
	explicitEnvFlag: boolean;
}): EnvMode {
	if (!kitRange) return 'legacy';
	if (kitRange === 'next') return 'declared';
	const { major } = coerceVersion(kitRange);
	if (major !== undefined && major >= 3) return 'declared';
	if (major === 2 && explicitEnvFlag) return 'declared';
	return 'legacy';
}
