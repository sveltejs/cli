import { asset, assets, base, resolve, resolveRoute as route } from '$app/paths';
import type { Asset, Pathname, RouteId } from '$app/types';

declare const slug: string;
declare const routeId: RouteId;
declare const pathname: Pathname;
declare const assetPath: Asset;

export const root = resolve('/');
export const blog = base + route('/blog/[slug]', { slug });
export const tplRoute = `${base}${route('/blog/[slug]', { slug })}`;
export const tplRouteSuffix = `${base}${route('/blog/[slug]', { slug })}#comments`;
export const image = assets + '/foo.png';
export const about = base + '/about';
export const existingImage = asset('/bar.png');
export const existingPath = resolve('/blog/hello-world');
export const resolvedRoute = resolve('/blog/[slug]', { slug });
export const dynamicRoute = route(routeId);
export const helpers = { route };
export const values = [pathname, assetPath];
