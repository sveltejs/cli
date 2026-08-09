<script>
	import { page } from '$app/stores';
	import { derived } from 'svelte/store';
	const url = derived(page, ($page) => $page.url);
</script>

<!-- @migration-task could not auto-migrate `$app/stores` to `$app/state`: `derived(...)` store; migrate manually -->
{$url}
