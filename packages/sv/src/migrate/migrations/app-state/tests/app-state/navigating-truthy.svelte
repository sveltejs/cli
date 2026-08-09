<script>
	import { navigating } from '$app/stores';
</script>

{#if $navigating}
	<p>navigating</p>
{/if}

{#if $navigating && $navigating.to}
	<p>loading {$navigating.to.url.pathname}</p>
{/if}

<p class:active={$navigating ? 'yes' : 'no'}></p>
