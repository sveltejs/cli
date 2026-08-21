import { resolve as route } from '$app/paths';

declare const slug: string;

export const path = route('/blog/[slug]', { slug });
