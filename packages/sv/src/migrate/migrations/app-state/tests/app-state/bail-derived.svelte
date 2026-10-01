<script>
	import { page } from '$app/stores';
	import { derived } from 'svelte/store';
	const url = derived(page, ($page) => $page.url);
</script>

{$url}
