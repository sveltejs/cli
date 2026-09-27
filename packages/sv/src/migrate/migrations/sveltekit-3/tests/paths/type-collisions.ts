import type { Asset, Pathname } from '$app/types';

type Path = string;
type AssetPath = string;

declare const pathname: Pathname;
declare const asset: Asset;

export const values: [Path, AssetPath] = [pathname, asset];
