import { asset, resolve } from '$app/paths';
import type { RouteId, AssetPath, Path } from '$app/types';

declare const slug: string;
declare const routeId: RouteId;
declare const pathname: Path;
declare const assetPath: AssetPath;

export const root = resolve('/');
export const blog = resolve('/blog/[slug]', { slug });
export const tplRoute = resolve('/blog/[slug]', { slug });
export const tplRouteSuffix = `${resolve('/blog/[slug]', { slug })}#comments`;
export const image = asset('foo.png');
export const about = resolve('about');
export const existingImage = asset('bar.png');
export const existingPath = resolve('blog/hello-world');
export const resolvedRoute = resolve('/blog/[slug]', { slug });
export const dynamicRoute = resolve(routeId);
export const helpers = { route: resolve };
export const values = [pathname, assetPath];
