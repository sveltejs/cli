<script>
	import { page } from '$app/state';
	import Component from '$lib/Component.svelte';

	page.url.searchParams.set('preview', 'true');
</script>

<Component />
