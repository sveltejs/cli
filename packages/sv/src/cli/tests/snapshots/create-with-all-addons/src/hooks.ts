import { deLocalizeUrl } from '$lib/paraglide/runtime';

export const reroute = (request: { url: URL }) => deLocalizeUrl(request.url).pathname;
