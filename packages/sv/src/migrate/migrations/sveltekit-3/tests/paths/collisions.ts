import { asset, resolve } from './other.ts';
import { assets, base } from '$app/paths';

export const other = [resolve('/untouched'), asset('/untouched.png')];
export const href = base + '/about';
export const image = assets + '/foo.png';

export function shadowed(base: string, assets: string, resolvePath: (path: string) => string) {
	return [base + '/local', assets + '/local.png', resolvePath('/local')];
}
