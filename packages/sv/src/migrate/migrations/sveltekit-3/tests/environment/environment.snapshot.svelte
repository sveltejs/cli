<script lang="ts">
	import { browser, dev } from '$app/env';
	import { building as isBuilding } from '$app/env';
</script>

{#if browser && dev}
	<p>Building: {isBuilding}</p>
{/if}
