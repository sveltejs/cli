import { page } from '$app/stores';
import { get } from 'svelte/store';

export function currentPath() {
	return get(page).url.pathname;
}

page.subscribe((value) => {
	console.log(value.url);
});
