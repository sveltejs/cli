<script lang="ts">
	import { env } from '$env/dynamic/public';

	let { name }: { name: string } = $props();
</script>

<!-- @migration-task Rewrite dynamic env lookup manually. -->
<p>{env[name]}</p>
