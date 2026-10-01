<script lang="ts">
	import { env } from '$env/dynamic/public';

	let { name }: { name: string } = $props();
</script>

<p>{env[name]}</p>
