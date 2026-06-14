import { env } from '$env/dynamic/private';
import type { Handle } from '@sveltejs/kit';

export const handle: Handle = async ({ event, resolve }) => {
	if (event.url.pathname.startsWith(env.API_BASE_PATH)) {
		return new Response('custom response');
	}

	const response = await resolve(event);
	return response;
};
