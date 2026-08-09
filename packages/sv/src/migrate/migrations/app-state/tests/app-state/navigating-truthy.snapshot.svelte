<script>
	import { navigating } from '$app/state';
</script>

{#if navigating.to}
	<p>navigating</p>
{/if}

{#if navigating.to && navigating.to}
	<p>loading {navigating.to.url.pathname}</p>
{/if}

<p class:active={navigating.to ? 'yes' : 'no'}></p>
