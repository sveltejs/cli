import type { Reroute } from '@sveltejs/kit';
import { deLocalizeUrl } from '#lib/paraglide/runtime.js';

export const reroute: Reroute = (request) => deLocalizeUrl(request.url).pathname;
