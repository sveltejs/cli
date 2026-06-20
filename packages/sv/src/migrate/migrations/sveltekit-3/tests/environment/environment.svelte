<script lang="ts">
	import { browser, dev } from '$app/environment';
	import { building as isBuilding } from '$app/environment';
</script>

{#if browser && dev}
	<p>Building: {isBuilding}</p>
{/if}
