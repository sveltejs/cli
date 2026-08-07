import { base, resolveRoute as route } from '$app/paths';

declare const slug: string;

export const path = base + route('/blog/[slug]', { slug });
