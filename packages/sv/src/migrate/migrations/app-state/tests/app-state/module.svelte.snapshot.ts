import { page } from '$app/state';
import { get } from 'svelte/store';

export function currentPath() {
	// @migration-task replace `get(page)` - read the value directly (no longer a store)
	return get(page).url.pathname;
}

// @migration-task convert `page.subscribe(...)` to a rune (`$derived`/`$effect`)
page.subscribe((value) => {
	console.log(value.url);
});
