import { asset, resolve } from './other.ts';
import { asset as assetPath, resolve as resolvePath } from '$app/paths';

export const other = [resolve('/untouched'), asset('/untouched.png')];
export const href = resolvePath('about');
export const image = assetPath('foo.png');

export function shadowed(base: string, assets: string, resolvePath: (path: string) => string) {
	return [base + '/local', assets + '/local.png', resolvePath('/local')];
}
