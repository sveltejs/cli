import type { AssetPath as AppAssetPath, Path as AppPath } from '$app/types';

type Path = string;
type AssetPath = string;

declare const pathname: AppPath;
declare const asset: AppAssetPath;

export const values: [Path, AssetPath] = [pathname, asset];
