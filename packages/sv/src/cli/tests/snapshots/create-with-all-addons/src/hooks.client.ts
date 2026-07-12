import type { ClientInit } from '@sveltejs/kit';
import { Locale } from '$lib/paraglide.svelte';

export const init: ClientInit = () => {
	new Locale();
};
