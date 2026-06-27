<script>
	import { page } from '$app/stores';
</script>

<div>{$page.url}</div>
<button onclick={() => {
	console.log($page.state);
}}></button>
