<script>
	/** @type {{children: import('svelte').Snippet}} */
    let { children } = $props();
</script>

<svelte:html lang="en" />

{@render children()}
