<script lang="ts">
	import { greet } from './greet';

	let { host = 'SvelteKit', guest = 'Vitest' }: { host: string; guest: string } = $props();
</script>

<h1>{greet(host)}</h1>
<p>{greet(guest)}</p>
